const express = require("express");
const {
    createSermon,
    getSermons,
    getSermon,
    updateSermon,
    deleteSermon,
} = require("../controllers/sermonController");

const router = express.Router();

router.post("/", createSermon);

router.get("/", getSermons);

router.get("/:id", getSermon);

router.put("/:id", updateSermon);

router.delete("/:id", deleteSermon);

module.exports = router;
