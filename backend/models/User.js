const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  // Student specific fields
  studentId: {
    type: String,
    sparse: true, // Allows multiple null values
    unique: true
  },
  grade: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  parentName: {
    type: String,
    trim: true
  },
  parentPhone: {
    type: String,
    trim: true
  },
  parentAddress: {
    type: String,
    trim: true
  },
  // Ownership — which consultant created this student
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Teacher specific fields
  consultantId: {
    type: String,
    sparse: true,
    unique: true
  },
  employeeId: {
    type: String,
    sparse: true,
    unique: true,
    required: false
  },
  consultantPhone: {
    type: String,
    trim: true
  },
  // Learning profile
  learningProfile: {
    dyslexiaType: {
      type: String,
      enum: ['dyslexia', 'dyscalculia', 'dysgraphia', 'dysphasia', 'none'],
      default: 'none'
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      default: 'mild'
    },
    accommodations: [{
      type: String,
      enum: ['text-to-speech', 'extra-time', 'visual-aids', 'audio-support', 'large-text']
    }]
  },
  // Progress tracking
  progress: {
    totalSessions: {
      type: Number,
      default: 0
    },
    completedExercises: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  },
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // Password reset
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update the updatedAt field before saving
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get user profile (without sensitive data)
userSchema.methods.getProfile = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Static method to find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Index for better performance
// userSchema.index({ email: 1 }); // Email is already indexed by unique: true
userSchema.index({ role: 1 });
userSchema.index({ 'learningProfile.dyslexiaType': 1 });

module.exports = mongoose.model('User', userSchema);





