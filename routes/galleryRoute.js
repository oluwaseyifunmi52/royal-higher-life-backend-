const express = require("express");
const router = express.Router();
const {
    createGalleryItem,
    getAllGalleryItems,
    getGalleryItemById,
    updateGalleryItem,
    deleteGalleryItem,
} = require("../controllers/galleryController");

router.post("/", createGalleryItem);
router.get("/", getAllGalleryItems);
router.get("/:id", getGalleryItemById);
router.put("/:id", updateGalleryItem);
router.delete("/:id", deleteGalleryItem);

module.exports = router;
