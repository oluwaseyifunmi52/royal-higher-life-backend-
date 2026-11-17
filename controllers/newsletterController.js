const Newsletter = require("../Models/newsletter");
const crypto = require("node:crypto");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendNewsletterConfirmation } = require("../utils/mailer");

const createUnsubscribeCredentials = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return {
        token,
        hash: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
};

const sendConfirmationWithUnsubscribeLink = (email, firstName, id, token) => {
    const unsubscribeUrl = `${(process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "")}/newsletter/unsubscribe#token=${encodeURIComponent(token)}`;
    return sendNewsletterConfirmation(email, firstName, id, unsubscribeUrl);
};

const subscribe = asyncHandler(async (req, res) => {
    const { email, firstName, lastName } = req.body;

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
        throw new ApiError(400, "A valid email address is required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Newsletter.findOne({ email: normalizedEmail }).select("+confirmationSentAt");

    if (existing) {
        if (existing.confirmationSentAt && Date.now() - existing.confirmationSentAt.getTime() < 5 * 60 * 1000) {
            return res.status(200).json(new ApiResponse(200, "If this address can be subscribed, confirmation details have been emailed."));
        }
        existing.isActive = true;
        const credentials = createUnsubscribeCredentials();
        existing.unsubscribeTokenHash = credentials.hash;
        existing.unsubscribeTokenExpires = credentials.expiresAt;
        existing.confirmationSentAt = new Date();
        await existing.save();
        sendConfirmationWithUnsubscribeLink(existing.email, firstName || existing.firstName, existing._id, credentials.token).catch((err) =>
            console.error("Newsletter confirmation email failed:", err.message)
        );
        return res.status(200).json(new ApiResponse(200, "If this address can be subscribed, confirmation details have been emailed."));
    }

    const credentials = createUnsubscribeCredentials();
    const subscriber = await Newsletter.create({
        email: normalizedEmail,
        firstName,
        lastName,
        unsubscribeTokenHash: credentials.hash,
        unsubscribeTokenExpires: credentials.expiresAt,
        confirmationSentAt: new Date(),
    });

    sendConfirmationWithUnsubscribeLink(subscriber.email, firstName, subscriber._id, credentials.token).catch((err) =>
        console.error("Newsletter confirmation email failed:", err.message)
    );

    return res.status(201).json(new ApiResponse(201, "If this address can be subscribed, confirmation details have been emailed."));
});

const getAllSubscribers = asyncHandler(async (req, res) => {
    const subscribers = await Newsletter.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Subscribers fetched", subscribers));
});

const unsubscribe = asyncHandler(async (req, res) => {
    const token = String(req.body?.token || "");
    if (/^[a-f\d]{64}$/i.test(token)) {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await Newsletter.findOneAndUpdate(
            { unsubscribeTokenHash: tokenHash, unsubscribeTokenExpires: { $gt: new Date() } },
            { $set: { isActive: false }, $unset: { unsubscribeTokenHash: 1, unsubscribeTokenExpires: 1 } },
            { new: true }
        );
    }
    return res.status(200).json(new ApiResponse(200, "If the link is valid, the address has been unsubscribed."));
});

module.exports = { subscribe, getAllSubscribers, unsubscribe };
