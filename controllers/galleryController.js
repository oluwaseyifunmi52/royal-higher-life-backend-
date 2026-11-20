const asyncHandler = require("../utils/asyncHandler");
const galleryService = require("../services/galleryService");
const { deleteMedia } = require("../services/uploadService");
const ApiError = require("../utils/apiError");
const { recordAdminAction } = require("../services/adminAuditService");
const Sermon = require("../Models/sermon");
const Event = require("../Models/event");
const Ministry = require("../Models/ministry");
const Announcement = require("../Models/announcement");
const Gallery = require("../Models/gallery");

async function isMediaReferenced(item, excludedGalleryId) {
    const urls = [item?.imageUrl, item?.videoUrl].filter(Boolean);
    if (!urls.length) return false;
    const [sermon, event, ministry, announcement, gallery] = await Promise.all([
        Sermon.exists({ $or: [{ image: { $in: urls } }, { videoUrl: { $in: urls } }] }),
        Event.exists({ image: { $in: urls } }),
        Ministry.exists({ image: { $in: urls } }),
        Announcement.exists({ imageUrl: { $in: urls } }),
        Gallery.exists({ _id: { $ne: excludedGalleryId }, $or: [{ imageUrl: { $in: urls } }, { videoUrl: { $in: urls } }] }),
    ]);
    return Boolean(sermon || event || ministry || announcement || gallery);
}

const createGalleryItem = asyncHandler(async (req, res) => {
    const { title, description, category, isFeatured, altText, album, isPublished, videoUrl, sortOrder, reuseMediaUrl, reuseMediaType, reuseMediaMimeType, thumbnailUrl } = req.body;
    const files = [...(req.files?.image || []), ...(req.files?.files || []), ...(req.files?.video || [])];
    let allowedVideoUrl = !videoUrl;
    if (videoUrl) {
        try {
            const url = new URL(videoUrl);
            allowedVideoUrl = url.protocol === "https:" && ["youtube.com", "www.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com"].includes(url.hostname);
        } catch { allowedVideoUrl = false; }
    }
    if (!allowedVideoUrl) throw new ApiError(400, "Use a valid HTTPS YouTube or Vimeo video link.");
    if (!files.length && !videoUrl && !reuseMediaUrl) throw new ApiError(400, "Choose media to upload, reuse an item from the library, or provide a supported video link.");
    if (reuseMediaUrl && (!/^https:\/\//i.test(reuseMediaUrl) || !["image", "video", "audio"].includes(reuseMediaType))) throw new ApiError(400, "Choose a valid HTTPS item from the media library.");
    const records = await Promise.all((files.length ? files : [null]).map((file) => {
        const mediaType = file ? (file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "audio") : reuseMediaType || "video";
        return galleryService.createGallery({
            title: files.length > 1 && title?.trim() ? `${title.trim()} - ${file?.originalname || "Media"}` : title?.trim() || file?.originalname || "Video", description, category,
            isFeatured: isFeatured === true || isFeatured === "true", altText, album, thumbnailUrl,
            isPublished: isPublished !== "false" && isPublished !== false,
            sortOrder: Number(sortOrder) || 0,
            mediaType,
            imageUrl: mediaType === "image" ? file?.path || reuseMediaUrl || "" : "",
            videoUrl: mediaType !== "image" ? file?.path || reuseMediaUrl || videoUrl || "" : "",
            mimeType: file?.mimetype || reuseMediaMimeType || "video/link", fileName: file?.originalname || "",
            fileSize: file?.size || 0, publicId: file?.filename || "", resourceType: file?.resourceType || "image",
        });
    }));
    const gallery = files.length > 1 ? records : records[0];
    await Promise.all(records.map((item) => recordAdminAction(req.user, "media.create", "gallery", item._id, { mediaType: item.mediaType, isPublished: item.isPublished, album: item.album })));

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

    if (!gallery || gallery.isPublished === false) {
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
    let oldMedia = null;
    if (updateData.videoUrl) {
        let valid = false;
        try {
            const url = new URL(updateData.videoUrl);
            valid = url.protocol === "https:" && ["youtube.com", "www.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com"].includes(url.hostname);
        } catch { valid = false; }
        if (!valid) throw new ApiError(400, "Use a valid HTTPS YouTube or Vimeo video link.");
    }

    const file = [...(req.files?.image || []), ...(req.files?.files || []), ...(req.files?.video || [])][0];
    if (file) {
        if (existing.publicId) oldMedia = { publicId: existing.publicId, resourceType: existing.resourceType || "image" };
        updateData.imageUrl = file.mimetype.startsWith("image/") ? file.path : "";
        updateData.videoUrl = file.mimetype.startsWith("video/") ? file.path : "";
        updateData.mediaType = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "audio";
        updateData.mimeType = file.mimetype;
        updateData.fileName = file.originalname;
        updateData.fileSize = file.size;
        updateData.publicId = file.filename;
        updateData.resourceType = file.resourceType || "image";
    }

    const gallery = await galleryService.updateGallery(req.params.id, updateData);
    if (gallery && oldMedia && !await isMediaReferenced(existing, existing._id)) await deleteMedia(oldMedia.publicId, oldMedia.resourceType).catch((error) => console.error("Replaced Cloudinary media cleanup failed", { code: error.code || "cloudinary_error" }));
    await recordAdminAction(req.user, "media.update", "gallery", gallery._id, { fields: Object.keys(updateData) });

    res.status(200).json({
        success: true,
        message: "Gallery item updated successfully",
        data: gallery,
    });
});

const deleteGalleryItem = asyncHandler(async (req, res) => {
    const existing = await galleryService.getGalleryById(req.params.id);
    if (existing && existing.isPublished !== false) throw new ApiError(409, "Unpublish this media before deleting it.");
    if (existing && await isMediaReferenced(existing, existing._id)) throw new ApiError(409, "This media is still used by website content. Replace or remove those references first.");
    const gallery = await galleryService.deleteGallery(req.params.id);

    if (!gallery) {
        return res.status(404).json({
            success: false,
            message: "Gallery item not found",
        });
    }
    if (gallery.publicId) await deleteMedia(gallery.publicId, gallery.resourceType || "image").catch((error) => console.error("Cloudinary media cleanup failed", { code: error.code || "cloudinary_error" }));
    await recordAdminAction(req.user, "media.delete", "gallery", gallery._id, { mediaType: gallery.mediaType });

    res.status(200).json({
        success: true,
        message: "Gallery item deleted successfully",
    });
});

const getAllGalleryItemsAdmin = asyncHandler(async (_req, res) => {
    const items = await galleryService.getAllGalleriesAdmin();
    res.status(200).json({ success: true, count: items.length, data: items });
});

module.exports = {
    createGalleryItem,
    getAllGalleryItems,
    getAllGalleryItemsAdmin,
    getGalleryItemById,
    updateGalleryItem,
    deleteGalleryItem,
};
