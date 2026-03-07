const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Plan config: limits and Stripe Price IDs (set real ones in config.env)
const PLANS = {
  starter:    { limit: 15,       priceId: process.env.STRIPE_PRICE_STARTER },
  pro:        { limit: 50,       priceId: process.env.STRIPE_PRICE_PRO },
  enterprise: { limit: Infinity, priceId: process.env.STRIPE_PRICE_ENTERPRISE }
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return require('stripe')(key);
}

// @route   POST /api/payments/create-checkout-session
// @desc    Create a Stripe Checkout Session for the chosen plan
// @access  Private (Teachers only)
router.post('/create-checkout-session', [auth, authorize('teacher', 'admin')], async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) {
      return res.status(400).json({ status: 'error', message: 'Invalid plan selected' });
    }

    const stripe = getStripe();
    const consultant = await User.findById(req.user.userId).select('email subscription');

    // Reuse existing Stripe customer if available
    let customerId = consultant.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: consultant.email });
      customerId = customer.id;
      await User.findByIdAndUpdate(req.user.userId, {
        'subscription.stripeCustomerId': customerId
      });
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://neurolex.tech';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:  `${baseUrl}/pricing.html`,
      metadata: { consultantId: req.user.userId, plan }
    });

    res.json({ status: 'success', sessionUrl: session.url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Server error' });
  }
});

// @route   GET /api/payments/success
// @desc    Called after Stripe redirects back — upgrades consultant plan
// @access  Private (Teachers only)
router.get('/success', [auth, authorize('teacher', 'admin')], async (req, res) => {
  try {
    const { session_id, plan } = req.query;
    if (!session_id || !PLANS[plan]) {
      return res.status(400).json({ status: 'error', message: 'Invalid parameters' });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(402).json({ status: 'error', message: 'Payment not completed' });
    }

    const limit = PLANS[plan].limit === Infinity ? 999999 : PLANS[plan].limit;

    await User.findByIdAndUpdate(req.user.userId, {
      'subscription.plan':               plan,
      'subscription.status':             'active',
      'subscription.studentLimit':       limit,
      'subscription.stripeSubscriptionId': session.subscription,
      'subscription.currentPeriodStart': new Date(),
      'subscription.currentPeriodEnd':   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    res.json({ status: 'success', message: `Upgraded to ${plan} plan`, plan, studentLimit: limit });
  } catch (error) {
    console.error('Payment success error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   POST /api/payments/webhook
// @desc    Stripe webhook — handles subscription renewals, cancellations, failures
// @access  Public (verified via Stripe signature)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subId);
        const plan = sub.metadata?.plan;
        if (plan && PLANS[plan]) {
          const limit = PLANS[plan].limit === Infinity ? 999999 : PLANS[plan].limit;
          await User.findOneAndUpdate(
            { 'subscription.stripeSubscriptionId': subId },
            {
              'subscription.status': 'active',
              'subscription.studentLimit': limit,
              'subscription.currentPeriodStart': new Date(sub.current_period_start * 1000),
              'subscription.currentPeriodEnd':   new Date(sub.current_period_end   * 1000)
            }
          );
        }
        break;
      }

      case 'invoice.payment_failed':
      case 'customer.subscription.deleted': {
        const obj = event.data.object;
        const subId = obj.subscription || obj.id;
        await User.findOneAndUpdate(
          { 'subscription.stripeSubscriptionId': subId },
          {
            'subscription.status': 'inactive',
            'subscription.plan':   'free',
            'subscription.studentLimit': 3
          }
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// @route   POST /api/payments/cancel
// @desc    Cancel active Stripe subscription (downgrades to free)
// @access  Private (Teachers only)
router.post('/cancel', [auth, authorize('teacher', 'admin')], async (req, res) => {
  try {
    const consultant = await User.findById(req.user.userId).select('subscription');
    const subId = consultant?.subscription?.stripeSubscriptionId;

    if (!subId) {
      return res.status(400).json({ status: 'error', message: 'No active subscription' });
    }

    const stripe = getStripe();
    await stripe.subscriptions.cancel(subId);

    await User.findByIdAndUpdate(req.user.userId, {
      'subscription.plan':   'free',
      'subscription.status': 'inactive',
      'subscription.studentLimit': 3,
      'subscription.stripeSubscriptionId': null
    });

    res.json({ status: 'success', message: 'Subscription cancelled. You are now on the Free plan.' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;
