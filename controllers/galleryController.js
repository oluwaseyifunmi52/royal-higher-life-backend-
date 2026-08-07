const asyncHandler = require("../utils/asyncHandler");
const galleryService = require("../services/galleryService");
const { uploadImage, deleteImage } = require("../services/uploadService");

const createGalleryItem = asyncHandler(async (req, res) => {
    const { title, description, category, isFeatured } = req.body;

    let imageUrl = "";
    let publicId = "";

    if (req.file) {
        const result = await uploadImage(req.file.path, "gallery");
        imageUrl = result.url;
        publicId = result.publicId;
    }

    const gallery = await galleryService.createGallery({
        title,
        description,
        imageUrl,
        publicId,
        category,
        isFeatured,
    });

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
    const existing = await galleryService.getGalleryById(req.params.id);
    if (!existing) {
        return res.status(404).json({ success: false, message: "Gallery item not found" });
    }

    const updateData = { ...req.body };

    if (req.file) {
        if (existing.publicId) {
            await deleteImage(existing.publicId);
        }
        const result = await uploadImage(req.file.path, "gallery");
        updateData.imageUrl = result.url;
        updateData.publicId = result.publicId;
    }

    const gallery = await galleryService.updateGallery(req.params.id, updateData);

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
