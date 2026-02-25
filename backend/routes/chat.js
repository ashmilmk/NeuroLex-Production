const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User'); // In case we need user details

// Middleware to check if user is authenticated (mocked or checks header/session if available)
// For now, we'll assume the frontend sends a userId or we extract it from token if auth middleware was applied globaly
// But the plan implies a simple integration. Let's try to reuse auth middleware if possible, 
// or just pass userId in body for simplicity if auth is complex.
// Looking at server.js, there is specific auth routes. We might need to handle auth, but for "Support" often it's open.
// However, to track user history, we need ID.
// Let's assume the request body will contain { userId, message }.

// In-memory session store (resets on server restart)
const sessions = {};

// Advanced Keyword/Regex Chat Logic with Context
const generateResponse = (message, userId) => {
    const lowerMsg = message.toLowerCase().trim();
    const userName = userId ? userId.toString() : 'guest';

    // Initialize session if not exists
    if (!sessions[userName]) {
        console.log(`[Chat] New session for ${userName}`);
        sessions[userName] = {
            state: 'normal',
            lastTopic: null
        };
    }

    const session = sessions[userName];
    console.log(`[Chat] User: ${userName}, State: ${session.state}, Msg: ${lowerMsg}`);

    // 1. Context: Follow-up on specific states
    console.log(`[Chat] Checking context for state: ${session.state}`);
    if (session.state === 'awaiting_details') {
        console.log('[Chat] Hit awaiting_details block');
        session.state = 'normal'; // Reset state
        return {
            text: "Thanks for the details! I've logged that for the consultant. They will be able to see this message too. Is there anything else?",
            flag: true // Flag this message as it contains the details
        };
    }

    // 2. Patterns
    const patterns = [
        {
            regex: /\b(problem|bug|error|crash|broken|fail|stuck|help|support)\b/i,
            response: "I'm sorry to hear that. Could you describe the problem in a bit more detail for me?",
            flag: true,
            newState: 'awaiting_details'
        },
        {
            regex: /\b(name|who am i)\b/i,
            response: "You are a valued student at DysLearn!",
            flag: false
        },
        {
            regex: /\b(hello|hi|hey|good morning|good afternoon|greetings)\b/i,
            response: "Hello there! Welcome to DysLearn. How are you finding the exercises today?",
            flag: false
        },
        {
            regex: /\b(score|progress|grade|result|mark)\b/i,
            response: "You're doing great! You can view your detailed progress and assessment results in the 'Progress' tab on your dashboard.",
            flag: false
        },
        {
            regex: /\b(play|start game|begin|adventure)\b/i,
            response: "Ready to play? Just click the 'Start Game' button on your dashboard to begin your learning adventure!",
            flag: false
        },
        {
            regex: /\b(bad|hard|difficult|cant do it|confused)\b/i,
            response: "Don't worry, it takes time to learn new things! Try taking a short break and coming back. I'll let your teacher know you're finding it a bit tough.",
            flag: true
        },
        {
            regex: /\b(good|great|easy|fun|awesome)\b/i,
            response: "That's wonderful to hear! Keep up the amazing work!",
            flag: false
        },
        {
            regex: /\b(thank|thanks)\b/i,
            response: "You're very welcome! Happy learning!",
            flag: false
        },
        {
            regex: /\b(who are you|what are you)\b/i,
            response: "I'm the DysLearn Support Assistant. I'm here to help you navigate the platform and solve any issues!",
            flag: false
        },
        {
            regex: /\b(bye|goodbye|cya)\b/i,
            response: "Goodbye! Come back soon to continue your adventure!",
            flag: false
        }
    ];

    // Check patterns
    for (const pattern of patterns) {
        if (pattern.regex.test(lowerMsg)) {
            if (pattern.newState) {
                session.state = pattern.newState;
            }
            return {
                text: pattern.response,
                flag: pattern.flag
            };
        }
    }

    // Default fallback
    return {
        text: "I'm always learning! If you have a specific problem, simply say 'problem' so I can help.",
        flag: false
    };
};

// @route   POST /api/chat
// @desc    User sends a message, AI responds
// @access  Private (but we rely on passed userId for now, ideally use middleware)
router.post('/', async (req, res) => {
    try {
        const { userId, message } = req.body;

        if (!message) {
            return res.status(400).json({ status: 'error', message: 'Message is required' });
        }

        // 1. Generate AI Response
        const aiResult = generateResponse(message, userId);

        // 2. Save Chat to DB
        const newChat = new Chat({
            userId: userId || null, // Handle anonymous chat if needed (though schema requires ID)
            message,
            response: aiResult.text,
            isFlagged: aiResult.flag
        });

        await newChat.save();

        res.status(201).json({
            status: 'success',
            data: newChat
        });

    } catch (err) {
        console.error('Chat Error:', err);
        res.status(500).json({ status: 'error', message: 'Server Error' });
    }
});

// @route   GET /api/chat/history/:userId
// @desc    Get chat history for a user
router.get('/history/:userId', async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.params.userId }).sort({ createdAt: 1 });
        res.json({
            status: 'success',
            data: chats
        });
    } catch (err) {
        console.error('Chat History Error:', err);
        res.status(500).json({ status: 'error', message: 'Server Error: ' + err.message });
    }
});

// @route   GET /api/chat/admin/flagged
// @desc    Get all flagged messages for Admin/Consultant
router.get('/admin/flagged', async (req, res) => {
    try {
        console.log('Admin accessing flagged chats...');
        // Populate user details to know who is having the problem
        const flaggedChats = await Chat.find({ isFlagged: true })
            .populate('userId', 'firstName lastName email studentId')
            .sort({ createdAt: -1 });

        console.log(`Found ${flaggedChats.length} flagged chats.`);

        // Sanity check: ensure populate worked even if user deleted
        const sanitizedChats = flaggedChats.map(chat => {
            const doc = chat.toObject();
            if (!doc.userId) {
                doc.userId = { firstName: 'Anonymous/Removed', lastName: 'Student', email: 'N/A' };
            }
            return doc;
        });

        res.json({
            status: 'success',
            data: sanitizedChats
        });
    } catch (err) {
        console.error('Admin Chat Error:', err);
        res.status(500).json({ status: 'error', message: 'Server Error: ' + err.message });
    }
});

module.exports = router;
