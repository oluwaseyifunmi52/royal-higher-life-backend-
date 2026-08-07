const mongoose = require("mongoose");
const EventRegistration = require("../Models/eventRegistration");
const Event = require("../Models/event");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendEventRegistrationConfirmation } = require("../utils/mailer");

const registerForEvent = asyncHandler(async (req, res) => {
    const { eventId, name, email, phone, numberOfGuests } = req.body;

    if (!eventId || !name || !email) {
        throw new ApiError(400, "Event ID, name, and email are required");
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw new ApiError(400, "Invalid event ID format");
    }

    const event = await Event.findById(eventId);
    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    const existing = await EventRegistration.findOne({ event: eventId, email: email.toLowerCase() });
    if (existing) {
        return res.status(200).json(new ApiResponse(200, "You are already registered for this event", existing));
    }

    const registration = await EventRegistration.create({
        event: eventId,
        name,
        email,
        phone,
        numberOfGuests,
    });

    sendEventRegistrationConfirmation(email, name, event.title).catch((err) =>
        console.error("Event registration confirmation email failed:", err.message)
    );

    return res.status(201).json(new ApiResponse(201, "Registered for event successfully", registration));
});

const getEventRegistrations = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw new ApiError(400, "Invalid event ID format");
    }

    const registrations = await EventRegistration.find({ event: eventId })
        .populate("event", "title date")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, "Registrations fetched", registrations));
});

const getAllRegistrations = asyncHandler(async (req, res) => {
    const registrations = await EventRegistration.find()
        .populate("event", "title date")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, "Registrations fetched", registrations));
});

const cancelRegistration = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid registration ID format");
    }

    const registration = await EventRegistration.findByIdAndUpdate(
        id,
        { status: "cancelled" },
        { new: true }
    );

    if (!registration) {
        throw new ApiError(404, "Registration not found");
    }

    return res.status(200).json(new ApiResponse(200, "Registration cancelled", registration));
});

module.exports = {
    registerForEvent,
    getEventRegistrations,
    getAllRegistrations,
    cancelRegistration,
};
