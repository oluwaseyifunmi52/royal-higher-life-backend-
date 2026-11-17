const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { createUploadMiddleware } = require("../Middleware/upload");
const router = express.Router();
const {
    createGalleryItem,
    getAllGalleryItems,
    getGalleryItemById,
    updateGalleryItem,
    deleteGalleryItem,
} = require("../controllers/galleryController");

const galleryUpload = createUploadMiddleware("gallery");

router.post("/", auth, authorize("admin"), galleryUpload.single("image"), createGalleryItem);
router.get("/", getAllGalleryItems);
router.get("/:id", validateObjectId(), getGalleryItemById);
router.put("/:id", auth, authorize("admin"), galleryUpload.single("image"), validateObjectId(), updateGalleryItem);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteGalleryItem);

module.exports = router;
