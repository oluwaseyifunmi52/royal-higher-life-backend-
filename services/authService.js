const bcrypt = require("bcryptjs");
const User = require("../Models/user");
const crypto = require("crypto");
const { signToken } = require("../utils/jwt");
const { sendEmail } = require("../utils/mailer");
const { generateOTP } = require("../utils/otp");
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
    } = userData;

    const resolvedFirstName = firstName || firstname || name?.split(" ")[0];
    const resolvedLastName =
        lastName ||
        lastname ||
        name?.split(" ").slice(1).join(" ") ||
        "Member";

    if (
        !resolvedFirstName ||
        !resolvedLastName ||
        !email ||
        !phone ||
        !password
    ) {
        throw new ApiError(400, "All fields are required.");
    }

    if (confirmPassword && password !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match.");
    }

    const emailExists = await User.findOne({ email });

    if (emailExists) {
        throw new ApiError(400, "Email already exists.");
    }

    const phoneExists = await User.findOne({ phone });

    if (phoneExists) {
        throw new ApiError(400, "Phone number already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = generateOTP();

    const user = await User.create({
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        email,
        phone,
        password: hashedPassword,
        otp,
        otpExpires: new Date(Date.now() + 10 *60 * 1000), // OTP expires in 10 minutes
    });

    // Send welcome email
    try {
        await sendEmail(
            user.email,
            "Welcome to Royal Higher Life Ministries",
            `
        <div style="font-family: Arial, sans-serif; line-height:1.6;">
            <h2>Welcome, ${user.firstName}!</h2>

            <p>Your account has been created successfully.</p>

            <p>
                Thank you for joining <strong>Royal Higher Life Ministries</strong>.
                We are delighted to have you as part of our community.
            </p>

            <p>God bless you.</p>

            <br>

            <p><strong>Royal Higher Life Ministries</strong></p>
        </div>
        `
        );

        await sendEmail(
            user.email,
            "Verify Your Email",
            `
        <h2>Royal Higher Life Ministries</h2>

        <p>Hello ${user.firstName},</p>

        <p>Your verification code is:</p>

        <h1 style="letter-spacing:5px;">${otp}</h1>

        <p>This code expires in 10 minutes.</p>
        `
        );
    } catch (emailError) {
        console.error("Failed to send registration emails:", emailError.message);
    }


    user.password = undefined;

    return user;
};

// Verify email with OTP
const verifyEmail = async ({ email, otp }) => {
    if (!email || !otp) {
        throw new ApiError(400, "Email and OTP are required.");
    }

    const user = await User.findOne({
        email,
        otp,
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

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "No account found with this email.");
    }

    const otp = generateOTP();

    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    await sendEmail(
        user.email,
        "Verify Your Email",
        `
        <h2>Royal Higher Life Ministries</h2>
        <p>Hello ${user.firstName},</p>
        <p>Your new verification code is:</p>
        <h1 style="letter-spacing:5px;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        `
    );

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

    if (!password || !confirmPassword) {
        throw new ApiError(400, "Password and Confirm Password are required.");
    }

    if (password !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match.");
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset token.");
    }

    user.password = await bcrypt.hash(password, 10);

    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    return true;
};


// forgotPassword
const forgotPassword = async (email) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "No account found with this email.");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;

    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    const frontendUrl =
        process.env.FRONTEND_URL || "https://royal-higher-life-9ttr.vercel.app";

    const resetLink =
        `${frontendUrl}/reset-password/${resetToken}`;

    await sendEmail(
        user.email,
        "Reset Your Password",
        `
        <h2>Royal Higher Life Ministries</h2>

        <p>Hello ${user.firstName},</p>

        <p>Click the button below to reset your password.</p>

        <a href="${resetLink}"
           style="
             background:#1e3a8a;
             color:#fff;
             padding:12px 20px;
             text-decoration:none;
             border-radius:5px;
           ">
           Reset Password
        </a>

        <p>This link expires in 15 minutes.</p>
        `
    );

    return true;
};

// Login User
const loginUser = async ({ email, password }) => {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
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
    return await User.findById(userId).select("-password");
};

// Update Profile
const updateProfile = async (userId, data) => {
    return await User.findByIdAndUpdate(userId, data, {
        new: true,
        runValidators: true,
    }).select("-password");
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

    const isMatch = await bcrypt.compare(
        currentPassword,
        user.password
    );

    if (!isMatch) {
        throw new ApiError(400, "Current password is incorrect.");
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

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
};
