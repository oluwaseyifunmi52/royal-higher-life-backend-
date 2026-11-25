const Announcement = require("../Models/announcement");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

function validateImageUrl(value) {
    if (!value) return;
    try { if (new URL(value).protocol !== "https:") throw new Error(); }
    catch { throw new ApiError(400, "Announcement image must be a valid HTTPS URL."); }
}
const createAnnouncement = asyncHandler(async (req, res) => {
    const { title, message, content, priority, targetAudience, isPublished, publishAt, imageUrl } = req.body;
    const messageContent = message || content;

    if (!title || !messageContent) {
        throw new ApiError(400, "Title and message/content are required");
    }
    validateImageUrl(imageUrl);

    const announcement = await Announcement.create({
        title,
        message: messageContent,
        content: messageContent,
        priority,
        targetAudience,
        sentBy: req.user._id,
        isPublished: isPublished !== false && isPublished !== "false",
        publishAt: publishAt || null,
        imageUrl,
    });

    return res.status(201).json(new ApiResponse(201, "Announcement sent", announcement));
});

const getAllAnnouncements = asyncHandler(async (req, res) => {
    const announcements = await Announcement.find({ isPublished: { $ne: false }, $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }] })
        .populate("sentBy", "firstName lastName")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, "Announcements fetched", announcements));
});

const getAllAnnouncementsAdmin = asyncHandler(async (_req, res) => {
    const announcements = await Announcement.find().populate("sentBy", "firstName lastName").sort({ publishAt: 1, createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Announcements fetched", announcements));
});

const updateAnnouncement = asyncHandler(async (req, res) => {
    const allowed = ["title", "message", "content", "priority", "targetAudience", "isPublished", "publishAt", "imageUrl"];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    validateImageUrl(update.imageUrl);
    if (update.content && !update.message) update.message = update.content;
    if (update.message && !update.content) update.content = update.message;
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true });
    if (!announcement) throw new ApiError(404, "Announcement not found");
    return res.status(200).json(new ApiResponse(200, "Announcement updated", announcement));
});

const getAnnouncementById = asyncHandler(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id)
        .populate("sentBy", "firstName lastName");

    if (!announcement || announcement.isPublished === false || (announcement.publishAt && announcement.publishAt > new Date())) {
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
    getAllAnnouncementsAdmin,
    updateAnnouncement,
    getAnnouncementById,
    deleteAnnouncement,
};
