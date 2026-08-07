const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const {
    createSermon,
    getSermons,
    getSermon,
    updateSermon,
    deleteSermon,
} = require("../controllers/sermonController");

const router = express.Router();

router.post("/", auth, authorize("admin"), createSermon);

router.get("/", getSermons);

router.get("/:id", getSermon);

router.put("/:id", auth, authorize("admin"), updateSermon);

router.delete("/:id", auth, authorize("admin"), deleteSermon);

module.exports = router;
