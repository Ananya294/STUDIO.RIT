const express = require("express");
const { register, login, getProfile, updateUserRole } = require("../controllers/authController");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");
const { ROLES } = require('../models/userModel');


//public routes
router.post("/register",register);
router.post("/login",login);

// Protected routes
router.get('/profile', protect, getProfile);


//admin only routes
router.put(
    '/update-role', 
    protect, 
    authorize(ROLES.ADMIN), 
    updateUserRole
  );

module.exports = router;