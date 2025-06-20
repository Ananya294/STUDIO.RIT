const mongoose = require("mongoose");

// task status enum
const TASK_STATUS = {
    TODO: 'todo',
    IN_PROGRESS: 'in_progress',
    UNDER_REVIEW: 'under_review',
    NEEDS_REVISION: 'needs_revision',
    COMPLETED: 'completed'
};

//task priority enum
const TASK_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

//task schema
const TaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    status: {
        type: String,
        enum: Object.values(TASK_STATUS),
        default: TASK_STATUS.TODO
    },
    priority: {
        type: String,
        enum: Object.values(TASK_PRIORITY),
        default: TASK_PRIORITY.MEDIUM
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
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
    comments: [{
      text: {
      type: String,
      required: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
    }],
    // approval workflow tracking
    approvals: [{
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comments: String,
    updatedAt: {
      type: Date,
      default: Date.now
    }
    }],
    // revision history
    revisions: [{
    version: {
      type: Number,
      required: true
    },
    description: String,
    files: [{
      filename: String,
      path: String,
      mimetype: String,
      size: Number
    }],
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
    }],
    // Track task completion
    completedAt: Date,
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
  timestamps: true
});

// add virtual for calculating if task is overdue
TaskSchema.virtual('isOverdue').get(function() {
  return this.status !== TASK_STATUS.COMPLETED && 
         this.dueDate < new Date() && 
         !this.completedAt;


});

//methods to submit for approval
TaskSchema.methods.submitForApproval = function(approveId) {
    this.status = TASK_STATUS.UNDER_REVIEW;
    this.approvals.push({
        status: 'pending',
        approver: approverId,
        updatedAt: new Date()
    });
};

//include virtuals in json
TaskSchema.set('toJSON',{ virtuals: true });
TaskSchema.set('toObject',{ virtuals: true });

const Task = mongoose.model('Task',TaskSchema);

module.exports = {
    Task,
    TASK_STATUS,
    TASK_PRIORITY
};