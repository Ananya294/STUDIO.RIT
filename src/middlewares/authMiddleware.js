const jwt = require("jsonwebtoken");
const { User, ROLES } = require('../models/userModel');

const protect = async (req, res, next) => {
    try {
        let token;
        // Check for token in headers
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Make sure token exists
        if (!token) {
            return res.status(401).json({ message: 'Not authorized - no token provided' });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'studio_rit_secret');

        //Attach User to req
        req.user = await User.findById(decoded.id).select('-password');

        if(!req.user) {
            return res.status(401).json({ message: 'User not found'});
        }

        if(!req.user.isActive) {
            return res.status(401).json({ message: 'Your account has been decativated'});
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ message: 'Not authorized - token invalid' });
    }      
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if(!req.user) {
            return res.status(401).json({ message: 'Not authorized'});
        }
    // Check if user has required role
    const hasRole = roles.some(role => req.user.hasPermission(role));
    
    if (!hasRole) {
      return res.status(403).json({
        message: `Access denied - ${req.user.role} role is not authorized to access this route`
      });
    }
    
    next();
    };
};

const isAdminOrOwner = (userIdField) => {
    return (req, res, next) => {
        const resourcesUserId = req[userIdField];

        if(
            req.user.role === ROLES.ADMIN ||
            req.user.id.toString() === resourcesUserId.toString()
        ) {
            return next();
        }

        return res.status(403).json({
            message: 'Access denied - you can only modify your own resources'
        });
    };
};

module.exports = {
    protect,
    authorize,
    isAdminOrOwner
};