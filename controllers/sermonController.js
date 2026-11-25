const Sermon = require("../Models/sermon");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createSermon = asyncHandler(async (req, res) => {
    const { title, preacher, speaker, description, date, sermonDate, imageUrl, image, ...rest } = req.body;

    if (!title || !(preacher || speaker) || !description) {
        throw new ApiError(400, "Title, preacher/speaker, and description are required");
    }

    const sermonData = {
        ...rest,
        title,
        preacher: preacher || speaker,
        description,
        image: image || imageUrl,
        sermonDate: sermonDate || date || new Date(),
    };

    const sermon = await Sermon.create(sermonData);

    res.status(201).json(new ApiResponse(201, "Sermon created successfully", sermon));
});

const getSermons = asyncHandler(async (req, res) => {
    const sermons = await Sermon.find({ isPublished: { $ne: false }, $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }] }).sort({ sermonDate: -1 });
    res.status(200).json(new ApiResponse(200, "Sermons fetched successfully", sermons));
});

const getAllSermonsAdmin = asyncHandler(async (_req, res) => {
    const sermons = await Sermon.find().sort({ sermonDate: -1 });
    res.status(200).json(new ApiResponse(200, "All sermons fetched successfully", sermons));
});

const getSermon = asyncHandler(async (req, res) => {
    const sermon = await Sermon.findById(req.params.id);

    if (!sermon || sermon.isPublished === false || (sermon.publishAt && sermon.publishAt > new Date())) {
        throw new ApiError(404, "Sermon not found");
    }

    res.status(200).json(new ApiResponse(200, "Sermon fetched successfully", sermon));
});

const updateSermon = asyncHandler(async (req, res) => {
    const { preacher, speaker, date, sermonDate, imageUrl, image, ...rest } = req.body;
    const updateData = { ...rest };
    if (preacher || speaker) updateData.preacher = preacher || speaker;
    if (sermonDate || date) updateData.sermonDate = sermonDate || date;
    if (image || imageUrl) updateData.image = image || imageUrl;

    const sermon = await Sermon.findByIdAndUpdate(
        req.params.id,
        updateData,
        { returnDocument: 'after', runValidators: true }
    );

    if (!sermon) {
        throw new ApiError(404, "Sermon not found");
    }

    res.status(200).json(new ApiResponse(200, "Sermon updated successfully", sermon));
});

const deleteSermon = asyncHandler(async (req, res) => {
    const sermon = await Sermon.findByIdAndDelete(req.params.id);

    if (!sermon) {
        throw new ApiError(404, "Sermon not found");
    }

    res.status(200).json(new ApiResponse(200, "Sermon deleted successfully", null));
});

module.exports = {
    createSermon,
    getSermons,
    getAllSermonsAdmin,
    getSermon,
    updateSermon,
    deleteSermon,
};
