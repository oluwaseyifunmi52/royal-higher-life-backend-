const Event = require("../Models/event");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createEvent = asyncHandler(async (req, res) => {
    const { title, description, date, time, location, image, isFeatured } = req.body;

    if (!title || !description || !date) {
        throw new ApiError(400, "Title, description, and date are required");
    }

    const event = await Event.create({
        title,
        description,
        date,
        time,
        location,
        image,
        isFeatured,
    });

    return res.status(201).json(new ApiResponse(201, "Event created successfully", event));
});

const getAllEvents = asyncHandler(async (req, res) => {
    const events = await Event.find().sort({ date: 1, createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Events fetched successfully", events));
});

const getEventById = asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.id);

    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    return res.status(200).json(new ApiResponse(200, "Event fetched successfully", event));
});

const updateEvent = asyncHandler(async (req, res) => {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    return res.status(200).json(new ApiResponse(200, "Event updated successfully", event));
});

const deleteEvent = asyncHandler(async (req, res) => {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    return res.status(200).json(new ApiResponse(200, "Event deleted successfully", null));
});

module.exports = {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
};
