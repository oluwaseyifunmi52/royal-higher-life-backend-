const bcrypt = require("bcryptjs");
const User = require("../Models/user");
const crypto = require("crypto");
const { signToken } = require("../utils/jwt");
const { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } = require("../utils/mailer");
const ApiError = require("../utils/apiError");

// Register User
const registerUser = async (userData) => {
    const {
        firstName,
        lastName,
        firstname,
        lastname,
        name,
        email,
        phone,
        password,
        confirmPassword,
        country,
        state,
        gender,
        newsletter,
    } = userData;

    const resolvedFirstName = firstName || firstname || name?.split(" ")[0];
    const resolvedLastName =
        lastName ||
        lastname ||
        name?.split(" ").slice(1).join(" ") ||
        "Member";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
    const validName = (value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 100;

    if (!validName(resolvedFirstName) || !validName(resolvedLastName) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254 ||
        normalizedPhone.length < 5 || normalizedPhone.length > 40 ||
        typeof password !== "string" || password.length < 8 || password.length > 128) {
        throw new ApiError(400, "Enter valid account details and a password between 8 and 128 characters.");
    }

    if (confirmPassword && password !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match.");
    }

    const emailExists = await User.findOne({ email: normalizedEmail });

    if (emailExists) {
        throw new ApiError(400, "An account cannot be created with the supplied details.");
    }

    const phoneExists = await User.findOne({ phone: normalizedPhone });

    if (phoneExists) {
        throw new ApiError(400, "Phone number already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        country,
        state,
        gender,
        newsletter,
        otp: crypto.createHash("sha256").update(verificationToken).digest("hex"),
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    const delivery = await sendVerificationEmail(user, verificationToken);


    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.otp;
    delete safeUser.otpExpires;
    delete safeUser.resetPasswordToken;
    delete safeUser.resetPasswordExpires;

    return { user: safeUser, verificationEmailSent: delivery.sent };
};

// Verify an email address using a short-lived, one-time link token.
const verifyEmail = async ({ email, otp, token }) => {
    if (token) {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            $or: [{ otp: tokenHash }, { otp: token }],
            otpExpires: { $gt: Date.now() },
            isEmailVerified: false,
        });
        if (!user) throw new ApiError(400, "Invalid or expired verification link.");
        user.otp = null;
        user.otpExpires = null;
        user.isEmailVerified = true;
        await user.save();
        return true;
    }

    // Compatibility with verification codes issued before the link flow rollout.
    if (!email || !otp) throw new ApiError(400, "Email and verification code are required.");
    const user = await User.findOne({
        email: email.toLowerCase().trim(),
        $or: [
            { otp: crypto.createHash("sha256").update(String(otp)).digest("hex") },
            { otp: String(otp) },
        ],
        otpExpires: { $gt: Date.now() },
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired OTP.");
    }

    user.otp = null;
    user.otpExpires = null;
    user.isEmailVerified = true;

    await user.save();

    return true;
};

// Resend verification OTP
const resendOTP = async (email) => {
    if (!email) {
        throw new ApiError(400, "Email is required.");
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (user && !user.isEmailVerified) {
        const token = crypto.randomBytes(32).toString("hex");
        user.otp = crypto.createHash("sha256").update(token).digest("hex");
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        await sendVerificationEmail(user, token);
    }

    return true;
};

//resetPassword
const resetPassword = async ({
    token,
    password,
    confirmPassword,
}) => {

    if (!token) {
        throw new ApiError(400, "Reset token is required.");
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        throw new ApiError(400, "Password must be between 8 and 128 characters.");
    }

    if (confirmPassword && password !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match.");
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
        $or: [{ resetPasswordToken: tokenHash }, { resetPasswordToken: token }],
        resetPasswordExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset token.");
    }

    user.password = await bcrypt.hash(password, 10);

    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();
    await sendPasswordChangedEmail(user, user.updatedAt?.toISOString() || Date.now());

    return true;
};


// forgotPassword
const forgotPassword = async (email) => {
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (user) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
        await user.save();
        await sendPasswordResetEmail(user, resetToken);
    }

    return true;
};

// Login User
const loginUser = async ({ email, password } = {}) => {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof password !== "string" || password.length > 128) {
        throw new ApiError(401, "Invalid email or password.");
    }
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user || typeof user.password !== "string") {
        throw new ApiError(401, "Invalid email or password.");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw new ApiError(401, "Invalid email or password.");
    }

    const token = signToken({
        id: user._id,
        role: user.role,
    });

    user.password = undefined;

    return {
        user,
        token,
    };
};

// Get Profile
const getProfile = async (userId) => {
    return await User.findById(userId).select("-password -otp -otpExpires -resetPasswordToken -resetPasswordExpires");
};

// Update Profile
const PROFILE_FIELDS = new Set(["firstName", "lastName", "phone", "country", "state", "gender", "newsletter", "profileImage"]);

const filterProfileUpdates = (data = {}) => Object.fromEntries(
    Object.entries(data).filter(([key, value]) => {
        if (!PROFILE_FIELDS.has(key) || value === undefined) return false;
        if (key === "profileImage") return typeof value === "string" && value.startsWith("https://res.cloudinary.com/");
        return true;
    })
);

const updateProfile = async (userId, data = {}) => {
    const updates = filterProfileUpdates(data);
    if (Object.keys(updates).length === 0) {
        throw new ApiError(400, "No supported profile fields were supplied.");
    }
    const user = await User.findByIdAndUpdate(userId, { $set: updates }, {
        new: true,
        runValidators: true,
    }).select("-password -otp -otpExpires -resetPasswordToken -resetPasswordExpires");
    if (!user) throw new ApiError(404, "User not found.");
    return user;
};

// Change Password
const changePassword = async (
    userId,
    currentPassword,
    newPassword
) => {
    const user = await User.findById(userId).select("+password");

    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    if (typeof user.password !== "string") {
        throw new ApiError(400, "This account does not have a password yet. Use Forgot Password to set one.");
    }

    const isMatch = await bcrypt.compare(
        currentPassword,
        user.password
    );

    if (!isMatch) {
        throw new ApiError(400, "Current password is incorrect.");
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();
    await sendPasswordChangedEmail(user, user.updatedAt?.toISOString() || Date.now());

    return true;
};

module.exports = {
    registerUser,
    loginUser,
    verifyEmail,
    resendOTP,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    filterProfileUpdates,
};
