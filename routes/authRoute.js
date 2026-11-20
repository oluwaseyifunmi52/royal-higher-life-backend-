const express = require("express");
const auth = require("../Middleware/auth");
const { createUploadMiddleware } = require("../Middleware/upload");

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
const { passwordResetLimiter } = require("../Middleware/rateLimiter");

// Public Routes
router.post("/register", register);
router.post("/login", login);
router.post("/admin-login", (req, _res, next) => { req.body.adminOnly = true; next(); }, login);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOTP);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPassword);

// Protected Routes
router.get("/profile", auth, getProfile);
router.post("/logout", auth, logout);
router.put("/profile", auth, updateProfile);
router.put("/change-password", auth, changePassword);
router.put("/profile-image", auth, profileUpload.single("image"), uploadProfileImage);

module.exports = router;
