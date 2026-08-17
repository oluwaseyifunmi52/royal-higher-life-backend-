const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");

// Register
const register = asyncHandler(async (req, res) => {
    const user = await authService.registerUser(req.body);

   res.status(201).json({
    success: true,
    message: "Registration successful. Please check your email for the verification code.",
    data: user,
     });

});

// Login
const login = asyncHandler(async (req, res) => {
    const { token, user } = await authService.loginUser(req.body);

    res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user,
    });
});

// Verify Email
const verifyEmail = asyncHandler(async (req, res) => {
    await authService.verifyEmail(req.body);

    res.status(200).json({
        success: true,
        message: "Email verified successfully.",
    });
});

// Resend OTP
const resendOTP = asyncHandler(async (req, res) => {
    await authService.resendOTP(req.body.email);

    res.status(200).json({
        success: true,
        message: "A new OTP has been sent to your email.",
    });
});

// Forgot Password
const forgotPassword = asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body.email);

    res.status(200).json({
        success: true,
        message: "Password reset email sent successfully.",
    });
});

// Reset Password
const resetPassword = asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);

    res.status(200).json({
        success: true,
        message: "Password reset successfully.",
    });
});

// Get Profile
const getProfile = asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user._id);

    res.status(200).json({
        success: true,
        user,
    });
});

// Update Profile
const updateProfile = asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user._id, req.body);

    res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user,
    });
});

// Change Password
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Current password and new password are required",
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({
            success: false,
            message: "New password must be at least 8 characters",
        });
    }

    await authService.changePassword(
        req.user._id,
        currentPassword,
        newPassword
    );

    res.status(200).json({
        success: true,
        message: "Password changed successfully",
    });
});

// Upload Profile Picture
const uploadProfileImage = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Please upload an image file",
        });
    }

    const user = await authService.updateProfile(req.user._id, {
        profileImage: req.file.path,
    });

    res.status(200).json({
        success: true,
        message: "Profile picture updated successfully",
        user,
    });
});

module.exports = {
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
};