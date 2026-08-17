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
    updateProfile,
    changePassword,
    uploadProfileImage,
} = require("../controllers/authController");

const router = express.Router();
const profileUpload = createUploadMiddleware("profile-images");

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
router.put("/profile-image", auth, profileUpload.single("image"), uploadProfileImage);

module.exports = router;
