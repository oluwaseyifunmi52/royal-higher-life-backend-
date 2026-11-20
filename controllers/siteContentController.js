const SiteContent = require("../Models/siteContent");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { recordAdminAction } = require("../services/adminAuditService");

const allowedFields = new Set([
    "heroHeading", "heroDescription", "heroImageUrl", "heroCtaText", "heroCtaLink",
    "welcomeHeading", "welcomeText", "aboutText", "mission", "vision", "coreBeliefs", "ministryPurpose",
    "phone", "email", "address", "officeHours", "footerDescription",
    "facebookUrl", "instagramUrl", "youtubeUrl", "xUrl",
]);

const getPublicSiteContent = asyncHandler(async (_req, res) => {
    const record = await SiteContent.findOne({ key: "primary", isPublished: true }).select("publishedContent updatedAt");
    return res.status(200).json(new ApiResponse(200, "Website content fetched", record?.publishedContent || {}));
});

const getAdminSiteContent = asyncHandler(async (_req, res) => {
    const record = await SiteContent.findOne({ key: "primary" });
    if (!record) return res.status(200).json(new ApiResponse(200, "Website content fetched", { content: {}, isPublished: false }));
    return res.status(200).json(new ApiResponse(200, "Website content fetched", { content: record.draftContent || record.content || {}, isPublished: record.isPublished }));
});

const updateSiteContent = asyncHandler(async (req, res) => {
    const incoming = req.body?.content;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new ApiError(400, "Website content must be an object.");
    const content = {};
    for (const [key, value] of Object.entries(incoming)) {
        if (!allowedFields.has(key) || typeof value !== "string") continue;
        const trimmed = value.trim();
        if (trimmed.length > 5000) throw new ApiError(400, `${key} is too long.`);
        if (["heroImageUrl", "facebookUrl", "instagramUrl", "youtubeUrl", "xUrl"].includes(key) && trimmed) {
            let url;
            try { url = new URL(trimmed); } catch { throw new ApiError(400, `${key} must be a valid HTTPS URL.`); }
            if (url.protocol !== "https:") throw new ApiError(400, `${key} must be a valid HTTPS URL.`);
        }
        if (key === "heroCtaLink" && trimmed && !(trimmed.startsWith("/") && !trimmed.startsWith("//"))) {
            let url;
            try { url = new URL(trimmed); } catch { throw new ApiError(400, "heroCtaLink must be an internal path or HTTPS URL."); }
            if (url.protocol !== "https:") throw new ApiError(400, "heroCtaLink must be an internal path or HTTPS URL.");
        }
        content[key] = trimmed;
    }
    const record = await SiteContent.findOneAndUpdate(
        { key: "primary" },
        { $set: {
            content,
            draftContent: content,
            ...(req.body.publish === true ? { publishedContent: content, isPublished: true } : {}),
            updatedBy: req.user._id,
        } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    await recordAdminAction(req.user, req.body.publish === true ? "site-content.publish" : "site-content.save-draft", "site-content", "primary", { fields: Object.keys(content) });
    return res.status(200).json(new ApiResponse(200, req.body.publish === true ? "Website content published" : "Website content saved as draft", { content: record.draftContent, isPublished: record.isPublished }));
});

module.exports = { getPublicSiteContent, getAdminSiteContent, updateSiteContent };
