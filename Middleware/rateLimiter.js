const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const isProduction = process.env.NODE_ENV === "production";

const createRateLimiter = (options = {}) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000,
        max: options.max || (isProduction ? 100 : 1000),
        message: {
            success: false,
            message: options.message || "Too many requests, please try again later.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => ipKeyGenerator(req.ip),
        skip: (req) => {
            if (isProduction) return false;
            return req.ip === "::1" || req.ip === "127.0.0.1";
        },
    });
};

const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 10 : 100,
    message: "Too many authentication attempts, please try again later.",
});

const createAuthLimiter = (options = {}) => createRateLimiter({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.max ?? (isProduction ? 10 : 100),
    message: options.message || "Too many authentication attempts, please try again later.",
});

// Share limits only across equivalent aliases, while keeping unrelated steps
// in registration, sign-in, email verification and password reset independent.
const registrationLimiter = createAuthLimiter();
const loginLimiter = createAuthLimiter();
const verificationLimiter = createAuthLimiter();
const resendOtpLimiter = createAuthLimiter();
const passwordResetRequestLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 3 : 10,
    message: "Too many password reset attempts, please try again later.",
});
const passwordResetSubmitLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 3 : 10,
    message: "Too many password reset attempts, please try again later.",
});

const publicSubmissionLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 20 : 200,
    message: "Too many submissions, please try again later.",
});

// Create a fresh counter for each public write operation. Sharing the same
// limiter instance across routers makes unrelated forms, admin reads and
// payment follow-up requests consume one IP quota.
const createPublicSubmissionLimiter = (options = {}) => createRateLimiter({
    windowMs: options.windowMs ?? 60 * 60 * 1000,
    max: options.max ?? (isProduction ? 20 : 200),
    message: options.message || "Too many submissions, please try again later.",
});

// Paystack webhooks are signed and retried, so they must not share the low
// public form-submission limit. This limit only throttles abusive delivery.
const webhookLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 1000 : 10000,
    message: "Too many webhook events, please try again later.",
});

const passwordResetLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 3 : 10,
    message: "Too many password reset attempts, please try again later.",
});

const uploadLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 10 : 50,
    message: "Too many image uploads, please try again later.",
});

module.exports = {
    authLimiter,
    registrationLimiter,
    loginLimiter,
    verificationLimiter,
    resendOtpLimiter,
    passwordResetRequestLimiter,
    passwordResetSubmitLimiter,
    createAuthLimiter,
    publicSubmissionLimiter,
    createPublicSubmissionLimiter,
    webhookLimiter,
    passwordResetLimiter,
    uploadLimiter,
    createRateLimiter,
};
