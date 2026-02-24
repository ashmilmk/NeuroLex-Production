const mongoose = require('mongoose');

// Separate collection for assessment results run by consultants on behalf of students
const assessmentResultSchema = new mongoose.Schema({
    // Who ran this assessment
    consultantId: {
        type: String,
        trim: true,
        index: true
    },
    // Which student was assessed
    studentId: {
        type: String,
        trim: true,
        index: true
    },
    playerName: {
        type: String,
        required: [true, 'Player name is required'],
        trim: true,
        index: true
    },
    ageGroup: {
        type: String,
        required: true,
        enum: ['grade12', 'grade34', 'grade56']
    },
    score: {
        type: Number,
        required: true,
        min: 0
    },
    totalPossible: {
        type: Number,
        required: true,
        min: 0
    },
    percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    challengesCompleted: {
        type: Number,
        required: true,
        min: 0
    },
    totalTime: {
        type: Number, // milliseconds
        default: 0
    },
    talentScores: {
        creativity: { type: Number, default: 0 },
        logic: { type: Number, default: 0 },
        memory: { type: Number, default: 0 },
        observation: { type: Number, default: 0 },
        problemSolving: { type: Number, default: 0 },
        dyscalculia: { type: Number, default: 0 },
        dysphasia: { type: Number, default: 0 },
        dysgraphia: { type: Number, default: 0 }
    },
    disorders: [{
        name: { type: String, required: true },
        description: { type: String },
        percentage: { type: Number },
        severity: { type: String },
        icon: { type: String }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

assessmentResultSchema.index({ consultantId: 1, createdAt: -1 });
assessmentResultSchema.index({ studentId: 1, createdAt: -1 });
assessmentResultSchema.index({ playerName: 1, createdAt: -1 });

module.exports = mongoose.model('AssessmentResult', assessmentResultSchema);
