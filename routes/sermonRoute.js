const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const {
    createSermon,
    getSermons,
    getAllSermonsAdmin,
    getSermon,
    updateSermon,
    deleteSermon,
} = require("../controllers/sermonController");

const router = express.Router();

router.post("/", auth, authorize("admin"), createSermon);

router.get("/admin/all", auth, authorize("admin"), getAllSermonsAdmin);
router.get("/", getSermons);

router.get("/:id", validateObjectId(), getSermon);

router.put("/:id", auth, authorize("admin"), validateObjectId(), updateSermon);

router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteSermon);

module.exports = router;
