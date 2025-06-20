const mongoose = require("mongoose");

// Project status enum
const PROJECT_STATUS = {
  PLANNING: 'planning',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};


//project schema
const ProjectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: Object.values(PROJECT_STATUS),
        default: PROJECT_STATUS.PLANNING
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    coordinator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    teamMembers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['designer', 'editor', 'photographer', 'developer', 'content_creator', 'other'],
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    departments: [{
        type: String,
        enum: ['design', 'video', 'photography', 'web', 'social_media', 'others']
    }],
    tags: [String],
    references: [{
        title: String,
        url: String,
        type: {
            type: String,
            enum: ['document', 'image', 'video', 'link', 'other']
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    attachments: [{
        filename: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    notes: [{
        content: String,
        addedAt: {
            type: Date,
            default: Date.now
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }]
    }, {
    timestamps: true    
});

// Add methods if needed
ProjectSchema.methods.isTeamMember = function(userId) {
  return this.teamMembers.some(member => member.user.toString() === userId.toString());
};

// Compile the model
const Project = mongoose.model('Project', ProjectSchema);

// Export both the model and status enum
module.exports = {
  Project,
  PROJECT_STATUS
};