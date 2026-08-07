const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const {
    subscribe,
    getAllSubscribers,
    unsubscribe,
} = require("../controllers/newsletterController");

router.post("/", subscribe);
router.get("/", auth, authorize("admin"), getAllSubscribers);
router.put("/unsubscribe/:email", unsubscribe);

module.exports = router;
