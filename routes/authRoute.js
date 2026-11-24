const express = require("express");
const auth = require("../Middleware/auth");
const { createUploadMiddleware } = require("../Middleware/upload");
const {
    registrationLimiter,
    loginLimiter,
    verificationLimiter,
    resendOtpLimiter,
    passwordResetRequestLimiter,
    passwordResetSubmitLimiter,
} = require("../Middleware/rateLimiter");

const {
    register,
    login,
    verifyEmail,
    resendOTP,
    forgotPassword,
    resetPassword,
    getProfile,
    logout,
    updateProfile,
    changePassword,
    uploadProfileImage,
} = require("../controllers/authController");

const router = express.Router();
const profileUpload = createUploadMiddleware("profile-images");

// Public Routes
router.post("/register", registrationLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/admin-login", loginLimiter, (req, _res, next) => { req.body.adminOnly = true; next(); }, login);
router.post("/verify-email", verificationLimiter, verifyEmail);
router.post("/resend-otp", resendOtpLimiter, resendOTP);
router.post("/forgot-password", passwordResetRequestLimiter, forgotPassword);
router.post("/reset-password", passwordResetSubmitLimiter, resetPassword);

// Protected Routes
router.get("/profile", auth, getProfile);
router.post("/logout", auth, logout);
router.put("/profile", auth, updateProfile);
router.put("/change-password", auth, changePassword);
router.put("/profile-image", auth, profileUpload.single("image"), uploadProfileImage);

module.exports = router;
