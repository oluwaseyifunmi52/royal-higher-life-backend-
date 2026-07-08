const asyncHandler = require("../utils/asyncHandler");
const galleryService = require("../services/galleryService");

const createGalleryItem = asyncHandler(async (req, res) => {
    const gallery = await galleryService.createGallery(req.body);

    res.status(201).json({
        success: true,
        message: "Gallery created successfully",
        data: gallery,
    });
});

const getAllGalleryItems = asyncHandler(async (req, res) => {
    const galleries = await galleryService.getGalleries();

    res.status(200).json({
        success: true,
        count: galleries.length,
        data: galleries,
    });
});

const getGalleryItemById = asyncHandler(async (req, res) => {
    const gallery = await galleryService.getGalleryById(req.params.id);

    if (!gallery) {
        return res.status(404).json({
            success: false,
            message: "Gallery item not found",
        });
    }

    res.status(200).json({
        success: true,
        data: gallery,
    });
});

const updateGalleryItem = asyncHandler(async (req, res) => {
    const gallery = await galleryService.updateGallery(req.params.id, req.body);

    if (!gallery) {
        return res.status(404).json({
            success: false,
            message: "Gallery item not found",
        });
    }

    res.status(200).json({
        success: true,
        message: "Gallery item updated successfully",
        data: gallery,
    });
});

const deleteGalleryItem = asyncHandler(async (req, res) => {
    const gallery = await galleryService.deleteGallery(req.params.id);

    if (!gallery) {
        return res.status(404).json({
            success: false,
            message: "Gallery item not found",
        });
    }

    res.status(200).json({
        success: true,
        message: "Gallery item deleted successfully",
    });
});

module.exports = {
    createGalleryItem,
    getAllGalleryItems,
    getGalleryItemById,
    updateGalleryItem,
    deleteGalleryItem,
};
