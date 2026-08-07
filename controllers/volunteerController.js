const Volunteer = require("../Models/volunteer");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const registerVolunteer = asyncHandler(async (req, res) => {
    const { name, email, phone, ministry, skills, availability, message } = req.body;

    if (!name || !email) {
        throw new ApiError(400, "Name and email are required");
    }

    const existing = await Volunteer.findOne({ email: email.toLowerCase() });

    if (existing) {
        return res.status(200).json(new ApiResponse(200, "You have already registered as a volunteer", existing));
    }

    const volunteer = await Volunteer.create({
        name,
        email,
        phone,
        ministry,
        skills,
        availability,
        message,
    });

    return res.status(201).json(new ApiResponse(201, "Volunteer registration successful", volunteer));
});

const getAllVolunteers = asyncHandler(async (req, res) => {
    const volunteers = await Volunteer.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Volunteers fetched", volunteers));
});

const updateVolunteerStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
        throw new ApiError(400, "Invalid status value. Must be: pending, approved, or rejected");
    }

    const volunteer = await Volunteer.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
    );

    if (!volunteer) {
        throw new ApiError(404, "Volunteer not found");
    }

    return res.status(200).json(new ApiResponse(200, "Volunteer status updated", volunteer));
});

const deleteVolunteer = asyncHandler(async (req, res) => {
    const volunteer = await Volunteer.findByIdAndDelete(req.params.id);

    if (!volunteer) {
        throw new ApiError(404, "Volunteer not found");
    }

    return res.status(200).json(new ApiResponse(200, "Volunteer deleted", null));
});

module.exports = {
    registerVolunteer,
    getAllVolunteers,
    updateVolunteerStatus,
    deleteVolunteer,
};
