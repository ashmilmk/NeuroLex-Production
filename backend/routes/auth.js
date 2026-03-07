const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['student', 'teacher']).withMessage('Role must be student or teacher'),
  body('studentId').optional().trim(),
  // body('employeeId').optional().trim(), // Deprecated for new registrations
  body('consultantPhone').optional().trim()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0].msg || 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password, role, studentId, consultantPhone } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Validate role-specific fields
    if (role === 'student' && !studentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Student ID is required for student registration'
      });
    }

    if (role === 'teacher' && !consultantPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required for consultant registration'
      });
    }

    // Create user object
    const userData = {
      firstName,
      lastName,
      email,
      password,
      role: role || 'student'
    };

    // Add role-specific fields
    if (role === 'student') {
      userData.studentId = studentId;
    } else if (role === 'teacher') {
      // Generate sequential Consultant ID: CNS0001, CNS0002, ...
      let isUnique = false;
      let consultantId = '';
      while (!isUnique) {
        const allIds = await User.find({ role: 'teacher', consultantId: /^CNS\d+$/ }, 'consultantId').lean();
        const nums = allIds.map(u => parseInt(u.consultantId.replace('CNS', ''))).filter(n => !isNaN(n));
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        consultantId = `CNS${String(next).padStart(4, '0')}`;
        const existing = await User.findOne({ consultantId });
        if (!existing) isUnique = true;
      }
      userData.consultantId = consultantId;
      userData.consultantPhone = consultantPhone;
    }

    // Create new user
    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    const userProfile = user.getProfile();

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      token,
      user: userProfile
    });

  } catch (error) {
    console.error('Registration error:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: 'error',
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findByEmail(email).select('+password');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Update last active
    user.progress.lastActive = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    const userProfile = user.getProfile();

    res.json({
      status: 'success',
      message: 'Login successful',
      token,
      user: userProfile
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      user: user.getProfile()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, (req, res) => {
  res.json({
    status: 'success',
    message: 'Logout successful'
  });
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', [
  auth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId).select('+password');

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      status: 'success',
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/student-login
// @desc    Login student using studentId and consultantId
// @access  Public
router.post('/student-login', [
  body('studentId').trim().notEmpty().withMessage('Student ID is required'),
  body('consultantId').trim().notEmpty().withMessage('Consultant ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { studentId, consultantId } = req.body;

    // Find the student by studentId
    const student = await User.findOne({ studentId, role: 'student' });
    if (!student) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid Student ID'
      });
    }

    // Verify consultant exists with the given consultantId
    const consultant = await User.findOne({
      $or: [{ consultantId }, { employeeId: consultantId }],
      role: 'teacher'
    });
    if (!consultant) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid Consultant ID'
      });
    }

    // Check if student is active
    if (!student.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Student account is deactivated'
      });
    }

    // Update last active
    student.progress.lastActive = new Date();
    await student.save();

    // Generate token for the student
    const token = generateToken(student._id);

    res.json({
      status: 'success',
      message: 'Student login successful',
      token,
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        studentId: student.studentId,
        grade: student.grade,
        email: student.email
      }
    });

  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error during student login'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Please enter a valid email address'
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal whether the email exists for security
      return res.json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save to user
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 300000; // 5 minutes
    await user.save({ validateBeforeSave: false });

    // Build reset URL
    const protocol = req.protocol;
    const host = req.get('host');
    const resetUrl = `${protocol}://${host}/reset-password.html?token=${resetToken}`;

    // Send email
    try {
      // Create transporter — uses Ethereal for dev (works without real SMTP credentials)
      let transporter;
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Production: use configured SMTP
        transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
      } else {
        // Dev fallback: Ethereal test account
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      }

      const mailOptions = {
        from: process.env.EMAIL_USER || '"NeuroLex Support" <noreply@neurolex.com>',
        to: user.email,
        subject: 'NeuroLex — Password Reset Request',
        html: `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:520px;margin:auto;padding:2rem;border:1px solid #e5e7eb;border-radius:16px;">
            <div style="text-align:center;margin-bottom:1.5rem;">
              <h1 style="color:#7c3aed;font-size:1.5rem;margin:0;">🧠 NeuroLex</h1>
              <p style="color:#6b7280;font-size:.9rem;">Password Reset Request</p>
            </div>
            <p style="color:#374151;font-size:.95rem;line-height:1.6;">
              Hi <strong>${user.firstName}</strong>,
            </p>
            <p style="color:#374151;font-size:.95rem;line-height:1.6;">
              We received a request to reset your password. Click the button below to set a new password:
            </p>
            <div style="text-align:center;margin:1.5rem 0;">
              <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#4c1d95);color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:.95rem;">
                Reset Password
              </a>
            </div>
            <p style="color:#9ca3af;font-size:.82rem;line-height:1.5;">
              This link will expire in <strong>5 minutes</strong>. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:1.5rem 0;">
            <p style="color:#9ca3af;font-size:.75rem;text-align:center;">
              NeuroLex Dyslexia Detection Platform<br>
              &copy; 2026 NeuroLex. All rights reserved.
            </p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('[Forgot Password] Email sent:', info.messageId);

      // If using Ethereal, log the preview URL to the console
      if (!process.env.EMAIL_USER) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log('[Forgot Password] Preview URL:', previewUrl);
      }

    } catch (emailErr) {
      console.error('[Forgot Password] Email send failed:', emailErr);
      // Still respond success for security
    }

    res.json({
      status: 'success',
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error. Please try again later.'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0].msg
      });
    }

    const { token, newPassword } = req.body;

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid (non-expired) token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token. Please request a new reset link.'
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({
      status: 'success',
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error. Please try again later.'
    });
  }
});

module.exports = router;





