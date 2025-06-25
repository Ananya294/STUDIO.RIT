const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = {
    VOLUNTEER: 'volunteer',
    JUNIOR_CORE: 'junior_core',
    SENIOR_CORE: 'senior_core',
    COORDINATOR: 'coordinator',
    ADMIN: 'admin'
};

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim:true
    },
    email: {
        type: String,
        required:true,
        unique:true,
        trim:true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6        
    },
    role: {
        type: String,
        enum: Object.values(ROLES),
        default: ROLES.VOLUNTEER
    },
    department: {
        type: String,
        enum: ['design', 'video', 'photography', 'web', 'social_media','others'],
        required: true
    },
    phone: {
        type:String,
        trim: true
    },
    profilePicture: {
        type: String
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date
},
{
    timestamps: true
});

UserSchema.pre('save', async function(next) {
    if(!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

UserSchema.methods.matchPassword = async function(enteredPassword){
    return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.hasPermission = function(requireRole) {
    const roles = Object.values(ROLES);
    const userRoleIndex = roles.indexOf(this.role);
    const requiredRoleIndex = roles.indexOf(requireRole);

    return userRoleIndex >= requiredRoleIndex;
};

UserSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpire;
    return userObject;    
};

const User = mongoose.model('User', UserSchema);

module.exports = {
    User,
    ROLES
};