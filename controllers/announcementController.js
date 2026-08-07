const Announcement = require("../Models/announcement");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createAnnouncement = asyncHandler(async (req, res) => {
    const { title, message, content, priority, targetAudience } = req.body;
    const messageContent = message || content;

    if (!title || !messageContent) {
        throw new ApiError(400, "Title and message/content are required");
    }

    const announcement = await Announcement.create({
        title,
        message: messageContent,
        content: messageContent,
        priority,
        targetAudience,
        sentBy: req.user._id,
    });

    return res.status(201).json(new ApiResponse(201, "Announcement sent", announcement));
});

const getAllAnnouncements = asyncHandler(async (req, res) => {
    const announcements = await Announcement.find({ isPublished: true })
        .populate("sentBy", "firstName lastName")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, "Announcements fetched", announcements));
});

const getAnnouncementById = asyncHandler(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id)
        .populate("sentBy", "firstName lastName");

    if (!announcement) {
        throw new ApiError(404, "Announcement not found");
    }

    return res.status(200).json(new ApiResponse(200, "Announcement fetched", announcement));
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
        throw new ApiError(404, "Announcement not found");
    }

    return res.status(200).json(new ApiResponse(200, "Announcement deleted", null));
});

module.exports = {
    createAnnouncement,
    getAllAnnouncements,
    getAnnouncementById,
    deleteAnnouncement,
};
