const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { createPublicSubmissionLimiter } = require("../Middleware/rateLimiter");
const router = express.Router();
const submissionLimiter = createPublicSubmissionLimiter();
const { createContact, getContacts, updateContactStatus, retryContactNotification, deleteContact } = require("../controllers/contactController");

// Public: Submit contact message
router.post("/", submissionLimiter, createContact);

// Admin only: List contact messages
router.get("/", auth, authorize("admin"), getContacts);
router.post("/:id/retry-notification", auth, authorize("admin"), validateObjectId(), retryContactNotification);
router.put("/:id", auth, authorize("admin"), validateObjectId(), updateContactStatus);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteContact);

module.exports = router;
