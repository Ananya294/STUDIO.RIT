const express = require("express");
const { protect, authorize } = require("../middlewares/authMiddleware");
const router = express.Router();
const { ROLES } = require('../models/userModel');

//only admin
router.get("/admin", protect, authorize(ROLES.ADMIN), (req,res) => {
    res.json({ message: "Welcome Admin" });
});

//admin and coordinator
router.get("/coordinator", protect, (req,res) => {
    res.json({ message: "Welcome coordinator" });
});

//all
router.get("/user", protect, (req,res) => {
    res.json({ message: "Welcome user" });
}); 


module.exports = router;