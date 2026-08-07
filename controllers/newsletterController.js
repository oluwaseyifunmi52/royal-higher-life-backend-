const Newsletter = require("../Models/newsletter");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendNewsletterConfirmation } = require("../utils/mailer");

const subscribe = asyncHandler(async (req, res) => {
    const { email, firstName, lastName } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const existing = await Newsletter.findOne({ email: email.toLowerCase() });

    if (existing) {
        if (existing.isActive) {
            return res.status(200).json(new ApiResponse(200, "You are already subscribed", existing));
        }
        existing.isActive = true;
        await existing.save();
        sendNewsletterConfirmation(email, firstName).catch((err) =>
            console.error("Newsletter confirmation email failed:", err.message)
        );
        return res.status(200).json(new ApiResponse(200, "Welcome back! You have been resubscribed", existing));
    }

    const subscriber = await Newsletter.create({ email, firstName, lastName });

    sendNewsletterConfirmation(email, firstName).catch((err) =>
        console.error("Newsletter confirmation email failed:", err.message)
    );

    return res.status(201).json(new ApiResponse(201, "Subscribed successfully", subscriber));
});

const getAllSubscribers = asyncHandler(async (req, res) => {
    const subscribers = await Newsletter.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Subscribers fetched", subscribers));
});

const unsubscribe = asyncHandler(async (req, res) => {
    const { email } = req.params;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
        throw new ApiError(404, "Subscriber not found");
    }

    subscriber.isActive = false;
    await subscriber.save();

    return res.status(200).json(new ApiResponse(200, "Unsubscribed successfully", null));
});

module.exports = { subscribe, getAllSubscribers, unsubscribe };
