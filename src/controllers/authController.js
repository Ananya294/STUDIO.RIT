const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const { User, ROLES } = require("../models/userModel");


const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET || 'studio_rit_secret',
        { expiresIn: '1h' }
    );
};


//register a new user
const register = async (req, res) => {
    try {

        const { name, email, password, department, phone } = req.body;
        
        //check for existing user
        const existingUser = await User.findOne({ email });
        if(existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        //new user
        const user = new User({
            name,
            email,
            password,
            department,
            phone,
            role: ROLES.VOLUNTEER // default role
        });

        await user.save();

        const token = generateToken(user._id);

        res.status(201).json({
            message: "User registered successfully",
            user: user.toJSON(),
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({message:'Server error during registration'});
    }    
};

//user login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        //check if user exists
        const user = await User.findOne({ email });
        if(!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        //check if account active
        if(!user.isActive) {
            return res.status(401).json({ message: 'Your account has been deactivated' });
        }

        //verify password
        const isMatch = await user.matchPassword(password);
        if(!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = generateToken(user._id);

        res.json({
            message: "Login successful",
            user: user.toJSON(),
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({message:'Server error during login'});
    }
};

const getProfile = async (req,res) => {
    try{
        const user = await User.findById(req.user.id);

        if(!user) {
            return res.status(404).json({ message: "User not found"});
        }
        res.json({ user: user.toJSON() });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: "Server error while fetching profile"});
    }
};

const updateUserRole = async (req,res) => {
    try {
        const { userId, role } = req.body;

        if(!Object.values(ROLES).includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { role },
            { new: true, runValidators: true }
        );

        if(!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'User role updated successfully',
            user: user.toJSON()
        });
    } catch(error) {
        console.error("Update role error:", error);
        res.status(500).json({ nessage: "Server error during role update"});
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateUserRole,
};