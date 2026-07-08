const express = require("express");
const auth = require("../Middleware/auth");

const {
    register,
    login,
    verifyEmail,
    resendOTP,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile,
    changePassword,
} = require("../controllers/authController");

const router = express.Router();

// Public Routes
router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected Routes
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.put("/change-password", auth, changePassword);

module.exports = router;
