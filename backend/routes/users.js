const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
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
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
  body('grade').optional().trim(),
  body('department').optional().trim()
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

    const { firstName, lastName, grade, department } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (grade) user.grade = grade;
    if (department) user.department = department;

    await user.save();

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      user: user.getProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/learning-profile
// @desc    Update learning profile
// @access  Private
router.put('/learning-profile', [
  auth,
  body('dyslexiaType').optional().isIn(['dyslexia', 'dyscalculia', 'dysgraphia', 'dysphasia', 'none']),
  body('severity').optional().isIn(['mild', 'moderate', 'severe']),
  body('accommodations').optional().isArray()
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

    const { dyslexiaType, severity, accommodations } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update learning profile
    if (dyslexiaType !== undefined) user.learningProfile.dyslexiaType = dyslexiaType;
    if (severity !== undefined) user.learningProfile.severity = severity;
    if (accommodations !== undefined) user.learningProfile.accommodations = accommodations;

    await user.save();

    res.json({
      status: 'success',
      message: 'Learning profile updated successfully',
      user: user.getProfile()
    });
  } catch (error) {
    console.error('Update learning profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/students
// @desc    Get all students (teachers only)
// @access  Private (Teachers only)
router.get('/students', [auth, authorize('teacher', 'admin')], async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    // Build search query — scope to this consultant unless admin
    const searchQuery = {
      role: 'student',
      isActive: true
    };

    if (req.user.role !== 'admin') {
      searchQuery.createdBy = req.user.userId;
    }

    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(searchQuery);

    res.json({
      status: 'success',
      students,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/students/:id
// @desc    Get student by ID (teachers only)
// @access  Private (Teachers only)
router.get('/students/:id', [auth, authorize('teacher', 'admin')], async (req, res) => {
  try {
    const ownerFilter = req.user.role !== 'admin' ? { createdBy: req.user.userId } : {};
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      ...ownerFilter
    }).select('-password');

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    res.json({
      status: 'success',
      student
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/progress-summary
// @desc    Get user progress summary
// @access  Private
router.get('/progress-summary', auth, async (req, res) => {
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
      progress: user.progress
    });
  } catch (error) {
    console.error('Get progress summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Deactivate account instead of deleting
    user.isActive = false;
    await user.save();

    res.json({
      status: 'success',
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/users/students
// @desc    Create a new student (teachers only)
// @access  Private (Teachers only)
router.post('/students', [
  auth,
  authorize('teacher', 'admin'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('studentId').optional().trim(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('grade').optional().trim(),
  body('severity').optional().isIn(['mild', 'moderate', 'severe']),
  body('parentName').optional().trim(),
  body('parentPhone').optional().trim(),
  body('parentAddress').optional().trim()
], async (req, res) => {
  try {
    console.log('--- CREATE STUDENT DEBUG ---', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      firstName, lastName, email, studentId, password, grade,
      dyslexiaType, severity, parentName, parentPhone, parentAddress
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already in use'
      });
    }

    // Auto-generate studentId if not provided, always guarantee uniqueness
    let finalStudentId = studentId;
    if (!finalStudentId) {
      // Find the highest existing STU number and increment
      let unique = false;
      while (!unique) {
        const allIds = await User.find({ role: 'student', studentId: /^STU\d+$/ }, 'studentId').lean();
        const nums = allIds.map(u => parseInt(u.studentId.replace('STU', ''))).filter(n => !isNaN(n));
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        finalStudentId = `STU${String(next).padStart(3, '0')}`;
        const conflict = await User.findOne({ studentId: finalStudentId });
        if (!conflict) unique = true;
      }
    } else {
      // Provided — still check for conflict
      const existingStudentId = await User.findOne({ studentId: finalStudentId });
      if (existingStudentId) {
        return res.status(400).json({
          status: 'error',
          message: 'Student ID already in use'
        });
      }
    }

    // Create student with default password if not provided
    const studentData = {
      firstName,
      lastName,
      email,
      studentId: finalStudentId,
      password: password || 'Student@123', // Default password
      role: 'student',
      grade: grade || '',
      parentName: parentName || '',
      parentPhone: parentPhone || '',
      parentAddress: parentAddress || '',
      createdBy: req.user.userId
    };

    // Set learning profile if provided
    if (dyslexiaType || severity) {
      studentData.learningProfile = {
        dyslexiaType: dyslexiaType || 'none',
        severity: severity || 'mild',
        accommodations: []
      };
    }

    const student = new User(studentData);
    await student.save();

    res.status(201).json({
      status: 'success',
      message: 'Student created successfully',
      student: student.getProfile()
    });
  } catch (error) {
    console.error('Create student error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Duplicate entry found'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/students/:id
// @desc    Update student info (teachers only)
// @access  Private (Teachers only)
router.put('/students/:id', [
  auth,
  authorize('teacher', 'admin'),
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
  body('grade').optional().trim(),
  body('dyslexiaType').optional().isIn(['dyslexia', 'dyscalculia', 'dysgraphia', 'dysphasia', 'none']),
  body('severity').optional().isIn(['mild', 'moderate', 'severe']),
  body('accommodations').optional().isArray(),
  body('parentName').optional().trim(),
  body('parentPhone').optional().trim(),
  body('parentAddress').optional().trim()
], async (req, res) => {
  try {
    console.log('--- UPDATE STUDENT DEBUG ---', req.params.id, req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const ownerFilter = req.user.role !== 'admin' ? { createdBy: req.user.userId } : {};
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      ...ownerFilter
    });

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    const {
      firstName, lastName, grade, dyslexiaType, severity,
      accommodations, parentName, parentPhone, parentAddress
    } = req.body;

    // Update basic info
    if (firstName) student.firstName = firstName;
    if (lastName) student.lastName = lastName;
    if (grade !== undefined) student.grade = grade;
    if (parentName !== undefined) student.parentName = parentName;
    if (parentPhone !== undefined) student.parentPhone = parentPhone;
    if (parentAddress !== undefined) student.parentAddress = parentAddress;

    // Update learning profile
    if (dyslexiaType !== undefined) student.learningProfile.dyslexiaType = dyslexiaType;
    if (severity !== undefined) student.learningProfile.severity = severity;
    if (accommodations !== undefined) student.learningProfile.accommodations = accommodations;

    await student.save();

    res.json({
      status: 'success',
      message: 'Student updated successfully',
      student: student.getProfile()
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/users/students/:id/assign-test
// @desc    Assign dyslexia test to student
// @access  Private (Teachers only)
router.post('/students/:id/assign-test', [
  auth,
  authorize('teacher', 'admin'),
  body('testType').isIn(['screening', 'full-assessment', 'progress-check']).withMessage('Invalid test type')
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

    const student = await User.findOne({
      _id: req.params.id,
      role: 'student'
    });

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    const { testType } = req.body;

    // Add test assignment to student record
    if (!student.assignedTests) {
      student.assignedTests = [];
    }

    student.assignedTests.push({
      testType,
      assignedBy: req.user.userId,
      assignedAt: new Date(),
      status: 'pending'
    });

    await student.save();

    res.json({
      status: 'success',
      message: `${testType} test assigned to student`,
      student: student.getProfile()
    });
  } catch (error) {
    console.error('Assign test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/users/students/:id
// @desc    Deactivate a student (teachers only)
// @access  Private (Teachers only)
router.delete('/students/:id', [auth, authorize('teacher', 'admin')], async (req, res) => {
  try {
    const ownerFilter = req.user.role !== 'admin' ? { createdBy: req.user.userId } : {};
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      ...ownerFilter
    });

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Deactivate instead of delete
    student.isActive = false;
    await student.save();

    res.json({
      status: 'success',
      message: 'Student deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/analytics
// @desc    Get teacher dashboard analytics with detailed student data
// @access  Private (Teachers only)
router.get('/analytics', [auth, authorize('teacher', 'admin')], async (req, res) => {
  try {
    const Progress = require('../models/Progress');

    // Get all students with details — scope to this consultant unless admin
    const ownerMatch = req.user.role !== 'admin' ? { createdBy: require('mongoose').Types.ObjectId.createFromHexString(req.user.userId) } : {};
    const allStudents = await User.find({ role: 'student', isActive: true, ...ownerMatch })
      .select('-password')
      .sort({ createdAt: -1 });

    // Get student counts
    const totalStudents = allStudents.length;

    // Get students by dyslexia type
    const dyslexiaStats = await User.aggregate([
      { $match: { role: 'student', isActive: true, ...ownerMatch } },
      { $group: { _id: '$learningProfile.dyslexiaType', count: { $sum: 1 } } }
    ]);

    // Get students by severity
    const severityStats = await User.aggregate([
      { $match: { role: 'student', isActive: true, 'learningProfile.dyslexiaType': { $ne: 'none' }, ...ownerMatch } },
      { $group: { _id: '$learningProfile.severity', count: { $sum: 1 } } }
    ]);

    // Get recent activity (students active in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeStudents = await User.countDocuments({
      role: 'student',
      isActive: true,
      'progress.lastActive': { $gte: weekAgo },
      ...ownerMatch
    });

    // Format dyslexia stats
    const dyslexiaBreakdown = {};
    dyslexiaStats.forEach(stat => {
      dyslexiaBreakdown[stat._id || 'none'] = stat.count;
    });

    // Format severity stats
    const severityBreakdown = {};
    severityStats.forEach(stat => {
      severityBreakdown[stat._id || 'unknown'] = stat.count;
    });

    // Get progress data for all students
    const studentIds = allStudents.map(s => s._id);
    const progressData = await Progress.aggregate([
      { $match: { userId: { $in: studentIds } } },
      {
        $group: {
          _id: '$userId',
          totalSessions: { $sum: 1 },
          averageScore: { $avg: '$score' },
          highestScore: { $max: '$score' },
          latestScore: { $last: '$score' },
          latestDate: { $max: '$createdAt' },
          exerciseTypes: { $addToSet: '$exerciseType' },
          totalTimeSpent: { $sum: '$timeSpent' },
          averageAccuracy: { $avg: '$performance.accuracy' }
        }
      }
    ]);

    // Create a map of student progress
    const progressMap = {};
    progressData.forEach(p => {
      progressMap[p._id.toString()] = p;
    });

    // Enhance students with progress data
    const studentsWithProgress = allStudents.map(student => {
      const studentProgress = progressMap[student._id.toString()] || {
        totalSessions: 0,
        averageScore: 0,
        highestScore: 0,
        latestScore: 0,
        latestDate: null,
        exerciseTypes: [],
        totalTimeSpent: 0,
        averageAccuracy: 0
      };

      return {
        ...student.toObject(),
        progress: studentProgress
      };
    });

    // Calculate dyslexia chances (based on progress patterns)
    const dyslexiaChances = {
      high: studentsWithProgress.filter(s =>
        s.learningProfile.dyslexiaType !== 'none' &&
        (s.progress.averageAccuracy < 60 || s.progress.averageScore < 50)
      ).length,
      medium: studentsWithProgress.filter(s =>
        s.learningProfile.dyslexiaType !== 'none' &&
        s.progress.averageAccuracy >= 60 && s.progress.averageAccuracy < 75
      ).length,
      low: studentsWithProgress.filter(s =>
        s.learningProfile.dyslexiaType === 'none' ||
        (s.learningProfile.dyslexiaType !== 'none' && s.progress.averageAccuracy >= 75)
      ).length
    };

    res.json({
      status: 'success',
      analytics: {
        totalStudents,
        activeStudents,
        dyslexiaBreakdown,
        severityBreakdown,
        studentsNeedingSupport: totalStudents - (dyslexiaBreakdown.none || 0),
        studentsWithProgress,
        dyslexiaChances,
        overallAverageScore: progressData.length > 0
          ? progressData.reduce((sum, p) => sum + (p.averageScore || 0), 0) / progressData.length
          : 0
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;





