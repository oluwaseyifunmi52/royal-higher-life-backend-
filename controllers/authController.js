const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");
const crypto = require("crypto");

// Register
const register = asyncHandler(async (req, res) => {
    const { user, verificationEmailSent } = await authService.registerUser(req.body);

    res.status(201).json({
        success: true,
        message: verificationEmailSent
            ? "Account created. Check your email for a verification link."
            : "Account created, but a verification email could not be sent. You can request another link.",
        verificationEmailSent,
        data: user,
    });

});

// Login
const login = asyncHandler(async (req, res) => {
    const credentials = req.body || {};
    const adminOnly = credentials.adminOnly === true;
    const loginRequestId = adminOnly ? crypto.randomBytes(8).toString("hex") : undefined;
    const { token, user } = await authService.loginUser({ ...credentials, adminOnly, loginRequestId });
    if (adminOnly) console.info("Admin login succeeded.", { requestId: loginRequestId, role: user.role });

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
        message: "If an unverified account matches that email, a verification link can be sent.",
    });
});

// Forgot Password
const forgotPassword = asyncHandler(async (req, res) => {
    const requestId = `reset-${crypto.randomBytes(6).toString("hex")}`;
    console.info(`[RESET:${requestId}] Password-reset request received.`);
    await authService.forgotPassword(req.body.email, requestId);

    res.status(200).json({
        success: true,
        message: "If an account matches that email, password reset instructions can be sent when email delivery is available.",
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

const logout = asyncHandler(async (req, res) => {
    await authService.logoutUser(req.user._id);
    res.status(200).json({ success: true, message: "Signed out successfully." });
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
    logout,
    updateProfile,
    changePassword,
    uploadProfileImage,
};
