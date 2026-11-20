const bcrypt = require("bcryptjs");
const User = require("../Models/user");
const crypto = require("crypto");
const { signToken } = require("../utils/jwt");
// Imported as a module object (not destructured) so delivery failures can be
// contained and so tests can stub delivery without touching real providers.
const mailer = require("../utils/mailer");
const ApiError = require("../utils/apiError");

const DUPLICATE_ACCOUNT_MESSAGE =
    "An account with this email already exists. Try signing in instead, or reset your password.";

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
        // No account details are echoed back: the message only tells the user
        // what to do next without revealing provider or verification status.
        console.warn("Registration rejected: email already registered.", { reason: "duplicate_email" });
        throw new ApiError(400, DUPLICATE_ACCOUNT_MESSAGE);
    }

    const phoneExists = await User.findOne({ phone: normalizedPhone });

    if (phoneExists) {
        throw new ApiError(400, "Phone number already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    let user;
    try {
        user = await User.create({
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
    } catch (error) {
        // Race with a concurrent registration for the same email/phone.
        if (error?.code === 11000) {
            const field = Object.keys(error.keyValue || { email: 1 })[0];
            console.warn("Registration rejected: duplicate key on create.", { reason: "duplicate_key", field });
            throw new ApiError(400, field === "phone"
                ? "Phone number already exists."
                : DUPLICATE_ACCOUNT_MESSAGE);
        }
        throw error;
    }

    // The account is already persisted at this point: an email delivery problem
    // must never fail registration or remove the account. The account stays
    // unverified and the caller is told the email could not be sent.
    let delivery = { sent: false, reason: "delivery_error" };
    try {
        delivery = await mailer.sendVerificationEmail(user, verificationToken);
    } catch (error) {
        console.error("Verification email could not be sent after account creation.", {
            reason: error?.name || "unknown_error",
            userId: String(user._id),
        });
    }
    if (!delivery?.sent) {
        console.warn("Verification email was not delivered; account kept unverified.", {
            reason: delivery?.reason || "unknown",
            userId: String(user._id),
        });
    }

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
        if (["admin", "superAdmin", "contentAdmin", "mediaAdmin", "ministryAdmin"].includes(user.role)) user.isActive = true;
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
    if (["admin", "superAdmin", "contentAdmin", "mediaAdmin", "ministryAdmin"].includes(user.role)) user.isActive = true;

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
        try {
            await mailer.sendVerificationEmail(user, token);
        } catch (error) {
            console.error("Resent verification email could not be sent.", {
                reason: error?.name || "unknown_error",
                userId: String(user._id),
            });
        }
    }

    return true;
};

//resetPassword
const resetPassword = async ({
    code,
    password,
    confirmPassword,
}) => {
    if (!code || !/^\d{6}$/.test(String(code))) {
        throw new ApiError(400, "Invalid reset code.");
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        throw new ApiError(400, "Password must be between 8 and 128 characters.");
    }

    if (typeof confirmPassword !== "string" || password !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match.");
    }

    const codeHash = crypto.createHash("sha256").update(String(code)).digest("hex");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
        { otp: codeHash, otpExpires: { $gt: new Date() }, otpAttempts: { $lt: 5 } },
        {
            $set: { password: passwordHash, otp: null, otpExpires: null, otpAttempts: 0 },
            $inc: { tokenVersion: 1 },
        },
        { new: true, runValidators: true }
    );

    if (!user) throw new ApiError(400, "Invalid or expired reset code.");

    await mailer.sendPasswordChangedEmail(user, user.updatedAt?.toISOString() || Date.now());

    return true;
};


// forgotPassword
const forgotPassword = async (email, requestId) => {
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    const userFound = Boolean(user);
    let otpGenerated = false;
    let otpStored = false;
    let mailerCalled = false;
    let smtpAccepted = false;
    let smtpErrorCode = null;
    let smtpDeliveryFailed = false;

    if (user) {
        const code = String(crypto.randomInt(100000, 999999)).padStart(6, "0");
        otpGenerated = true;

        user.otp = crypto.createHash("sha256").update(code).digest("hex");
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.otpAttempts = 0;
        try {
            await user.save();
            otpStored = true;
        } catch (saveError) {
            console.error(`[RESET:${requestId}] OTP storage failed.`, {
                reason: saveError?.name || "unknown_error",
            });
        }

        if (otpStored) {
            try {
                const delivery = await mailer.sendOtpEmail(user, code);
                mailerCalled = true;
                smtpAccepted = Boolean(delivery?.sent);
                if (delivery?.sent) {
                    console.info("Password-reset email accepted by the configured provider.");
                } else {
                    smtpErrorCode = delivery?.reason || "unknown";
                    smtpDeliveryFailed = true;
                    console.error(`[RESET:${requestId}] SMTP rejected OTP email.`, {
                        reason: smtpErrorCode,
                        provider: delivery?.provider || "unknown",
                        ...(delivery?.providerCode ? { providerCode: delivery.providerCode } : {}),
                        ...(delivery?.providerStatus ? { providerStatus: delivery.providerStatus } : {}),
                    });
                }
            } catch (mailerError) {
                mailerCalled = true;
                smtpErrorCode = mailerError?.code || "unknown_error";
                smtpDeliveryFailed = true;
                const safeProviderCode = /^[A-Z0-9_-]{1,40}$/i.test(smtpErrorCode) ? smtpErrorCode.toLowerCase() : undefined;
                console.error("Password-reset email delivery failed.", {
                    errorType: mailerError?.name || "unknown_error",
                    ...(safeProviderCode ? { providerCode: safeProviderCode } : {}),
                });
            }
        }

        // Log the full request lifecycle for diagnostics (no secrets, no full email).
        console.info(`[RESET:${requestId}] Password-reset request processed.`, {
            userFound,
            otpGenerated,
            otpStored,
            mailerCalled,
            smtpAccepted,
            ...(smtpDeliveryFailed ? { smtpError: "delivery_failed" } : {}),
            ...(smtpErrorCode ? { smtpErrorCode } : {}),
        });
    } else {
        // User not found: log only that lookup failed. Never reveal whether
        // an email address is registered to the HTTP client.
        console.info(`[RESET:${requestId}] Password-reset request processed.`, {
            userFound,
            otpGenerated: false,
            otpStored: false,
            mailerCalled: false,
            smtpAccepted: false,
        });
    }

    // Always return true with no indication of whether an account exists.
    // The vague user-facing message is returned by the controller.
    return true;
};

const ADMIN_LOGIN_ROLES = new Set(["admin", "superAdmin", "contentAdmin", "mediaAdmin", "ministryAdmin"]);
const ADMIN_BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const logAdminLoginDiagnostic = (requestId, code, details = {}) => {
    if (!requestId) return;
    console.warn("Admin login rejected.", { requestId, code, ...details });
};

// Login User
const loginUser = async ({ email, password, adminOnly = false, loginRequestId } = {}) => {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof password !== "string" || password.length > 128) {
        logAdminLoginDiagnostic(loginRequestId, "LOGIN_FIELDS_INVALID");
        throw new ApiError(401, "Invalid email or password.");
    }
    let user;
    try {
        user = await User.findOne({ email: normalizedEmail }).select("+password");
    } catch (error) {
        logAdminLoginDiagnostic(loginRequestId, "ACCOUNT_LOOKUP_FAILED", { errorType: error?.name || "unknown" });
        if (adminOnly) throw new ApiError(503, "Unable to sign in right now. Please try again later.");
        throw error;
    }

    if (!user || typeof user.password !== "string") {
        logAdminLoginDiagnostic(loginRequestId, user ? "PASSWORD_HASH_INVALID" : "ADMIN_NOT_FOUND");
        throw new ApiError(401, "Invalid email or password.");
    }

    if (!ADMIN_BCRYPT_HASH_PATTERN.test(user.password)) {
        logAdminLoginDiagnostic(loginRequestId, "PASSWORD_HASH_INVALID");
        throw new ApiError(401, "Invalid email or password.");
    }

    let isMatch;
    try {
        isMatch = await bcrypt.compare(password, user.password);
    } catch (error) {
        logAdminLoginDiagnostic(loginRequestId, "PASSWORD_HASH_INVALID", { errorType: error?.name || "unknown" });
        throw new ApiError(401, "Invalid email or password.");
    }

    if (!isMatch) {
        logAdminLoginDiagnostic(loginRequestId, "PASSWORD_MISMATCH");
        throw new ApiError(401, "Invalid email or password.");
    }

    if (!user.isActive) {
        logAdminLoginDiagnostic(loginRequestId, user.isEmailVerified ? "ACCOUNT_SUSPENDED" : "ACCOUNT_INACTIVE");
        throw new ApiError(401, "Invalid email or password.");
    }
    if (adminOnly && !ADMIN_LOGIN_ROLES.has(user.role)) {
        logAdminLoginDiagnostic(loginRequestId, "ADMIN_ROLE_MISSING", { role: typeof user.role === "string" ? user.role : "missing" });
        throw new ApiError(401, "Invalid email or password.");
    }
    if (user.role !== "member" && !user.isEmailVerified) {
        logAdminLoginDiagnostic(loginRequestId, "ACCOUNT_INACTIVE", { role: user.role });
        if (adminOnly) throw new ApiError(401, "Invalid email or password.");
        throw new ApiError(403, "Verify your email before signing in.");
    }

    user.lastLoginAt = new Date();
    try {
        await user.save();
    } catch (error) {
        logAdminLoginDiagnostic(loginRequestId, "SESSION_CREATION_FAILED", { stage: "account_update", errorType: error?.name || "unknown" });
        if (adminOnly) throw new ApiError(500, "Unable to sign in right now. Please try again later.");
        throw error;
    }

    let token;
    try {
        token = signToken({
            id: user._id,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
        }, user.role === "member" ? undefined : (process.env.JWT_ADMIN_EXPIRES_IN || "8h"));
    } catch (error) {
        logAdminLoginDiagnostic(loginRequestId, "SESSION_CREATION_FAILED", {
            errorType: error?.name || "unknown",
            errorCode: typeof error?.code === "string" ? error.code : undefined,
        });
        throw new ApiError(500, "Unable to sign in right now. Please try again later.");
    }

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
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();
    await mailer.sendPasswordChangedEmail(user, user.updatedAt?.toISOString() || Date.now());

    return true;
};

const logoutUser = async (userId) => {
    const user = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
    if (!user) throw new ApiError(404, "User not found.");
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
    logoutUser,
    filterProfileUpdates,
};
