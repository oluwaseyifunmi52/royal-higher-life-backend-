const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { createMediaUploadMiddleware } = require("../Middleware/upload");
const router = express.Router();
const {
    createGalleryItem,
    getAllGalleryItems,
    getGalleryItemById,
    updateGalleryItem,
    deleteGalleryItem,
    getAllGalleryItemsAdmin,
} = require("../controllers/galleryController");

const galleryUpload = createMediaUploadMiddleware("gallery");

router.post("/", auth, authorize("admin"), galleryUpload.fields([{ name: "image", maxCount: 1 }, { name: "files", maxCount: 8 }, { name: "video", maxCount: 1 }]), createGalleryItem);
router.get("/admin/all", auth, authorize("admin"), getAllGalleryItemsAdmin);
router.get("/", getAllGalleryItems);
router.get("/:id", validateObjectId(), getGalleryItemById);
router.put("/:id", auth, authorize("admin"), galleryUpload.fields([{ name: "image", maxCount: 1 }, { name: "files", maxCount: 1 }, { name: "video", maxCount: 1 }]), validateObjectId(), updateGalleryItem);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteGalleryItem);

module.exports = router;
