const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const upload = require("../Middleware/upload");
const router = express.Router();
const {
    createGalleryItem,
    getAllGalleryItems,
    getGalleryItemById,
    updateGalleryItem,
    deleteGalleryItem,
} = require("../controllers/galleryController");

router.post("/", auth, authorize("admin"), upload.single("image"), createGalleryItem);
router.get("/", getAllGalleryItems);
router.get("/:id", getGalleryItemById);
router.put("/:id", auth, authorize("admin"), upload.single("image"), updateGalleryItem);
router.delete("/:id", auth, authorize("admin"), deleteGalleryItem);

module.exports = router;
