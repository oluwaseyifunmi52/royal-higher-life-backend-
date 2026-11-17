const User = require("../Models/user");
const authService = require("../services/authService");

const sensitiveUserFields = ["password", "otp", "otpExpires", "resetPasswordToken", "resetPasswordExpires"];
const publicUser = (user) => {
    const result = user?.toObject ? user.toObject() : { ...user };
    for (const field of sensitiveUserFields) delete result[field];
    return result;
};
const filterAdminUserUpdates = (body = {}) => {
    const updates = authService.filterProfileUpdates(body);
    for (const [field, value] of Object.entries(updates)) {
        if (typeof value === "string" && field !== "profileImage") {
            updates[field] = value.trim().slice(0, field === "email" ? 254 : field === "phone" ? 40 : 100);
        }
    }
    if (typeof body.email === "string") {
        updates.email = body.email.trim().toLowerCase().slice(0, 254);
    }
    if (body.role === "admin" || body.role === "member") updates.role = body.role;
    if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
    return updates;
};

// Backward-compatible registration alias; keep the primary verification and hashing flow.
const register = async (req, res) => {
    try {
        const { user, verificationEmailSent } = await authService.registerUser(req.body);
        return res.status(201).json({
            success: true,
            message: verificationEmailSent
                ? "Account created. Check your email for a verification link."
                : "Account created, but a verification email could not be sent. You can request another link.",
            verificationEmailSent,
            data: publicUser(user),
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            success: false,
            message: status < 500 ? error.message : "Unable to complete registration right now.",
        });
    }
};

// Login alias; reuse the primary authentication service and never serialize credential fields.
const login = async (req, res) => {
    try {
        const { token, user } = await authService.loginUser(req.body);
        return res.status(200).json({ success: true, token, data: publicUser(user) });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            success: false,
            message: status < 500 ? error.message : "Unable to complete sign in right now.",
        });
    }
};

// Get All Users
const getUsers = async (req, res) => {
    try {
        const users = await User.find();

        res.status(200).json({
            success: true,
            count: users.length,
            data: users.map(publicUser),
        });
    } catch {
        res.status(500).json({
            success: false,
            message: "Unable to fetch users right now.",
        });
    }
};

// Get One User
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            data: publicUser(user),
        });
    } catch {
        res.status(500).json({
            success: false,
            message: "Unable to fetch this user right now.",
        });
    }
};

// Update User
const updateUser = async (req, res) => {
    try {
        const updates = filterAdminUserUpdates(req.body);
        if (!Object.keys(updates).length) {
            return res.status(400).json({ success: false, message: "No editable user fields were provided." });
        }
        const user = await User.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: publicUser(user),
        });
    } catch {
        res.status(500).json({
            success: false,
            message: "Unable to update this user right now.",
        });
    }
};

// Delete User
const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch {
        res.status(500).json({
            success: false,
            message: "Unable to delete this user right now.",
        });
    }
};

module.exports = {
    register,
    login,
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    filterAdminUserUpdates,
};
