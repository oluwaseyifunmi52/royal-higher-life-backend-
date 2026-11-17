const Campaign = require("../Models/campaign");
const Donation = require("../Models/donation");
const DonationAudit = require("../Models/donationAudit");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const listCampaigns = asyncHandler(async (req, res) => {
    const campaigns = await Campaign.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    const totals = await Donation.aggregate([
        { $match: { status: "successful", verifiedAt: { $ne: null } } },
        { $group: { _id: "$campaign", raised: { $sum: "$amount" }, donationCount: { $sum: 1 } } },
    ]);
    const byCampaign = new Map(totals.map((item) => [String(item._id), item]));
    return res.status(200).json(new ApiResponse(200, "Active campaigns fetched", campaigns.map((campaign) => {
        const progress = byCampaign.get(String(campaign._id)) || { raised: 0, donationCount: 0 };
        return { ...campaign, raisedAmount: progress.raised, donationCount: progress.donationCount, progressPercent: Math.min(100, Math.round(progress.raised / campaign.targetAmount * 100)) };
    })));
});

const listCampaignsAdmin = asyncHandler(async (req, res) => {
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();
    const totals = await Donation.aggregate([
        { $match: { status: "successful", verifiedAt: { $ne: null } } },
        { $group: { _id: "$campaign", raised: { $sum: "$amount" }, donationCount: { $sum: 1 } } },
    ]);
    const byCampaign = new Map(totals.map((item) => [String(item._id), item]));
    return res.status(200).json(new ApiResponse(200, "Campaigns fetched", campaigns.map((campaign) => {
        const progress = byCampaign.get(String(campaign._id)) || { raised: 0, donationCount: 0 };
        return { ...campaign, raisedAmount: progress.raised, donationCount: progress.donationCount, progressPercent: Math.min(100, Math.round(progress.raised / campaign.targetAmount * 100)) };
    })));
});

const createCampaign = asyncHandler(async (req, res) => {
    const fields = ["title", "slug", "description", "coverImage", "targetAmount", "currency", "startsAt", "endsAt"];
    const input = Object.fromEntries(fields.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const campaign = await Campaign.create(input);
    await DonationAudit.create({ actor: req.user._id, action: "campaign.created", metadata: { campaign: campaign._id } });
    return res.status(201).json(new ApiResponse(201, "Campaign created", campaign));
});

const updateCampaign = asyncHandler(async (req, res) => {
    const allowed = ["title", "slug", "description", "coverImage", "targetAmount", "startsAt", "endsAt", "isActive"];
    const updates = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!campaign) throw new ApiError(404, "Campaign not found");
    await DonationAudit.create({ actor: req.user._id, action: "campaign.updated", metadata: { campaign: campaign._id, fields: Object.keys(updates) } });
    return res.status(200).json(new ApiResponse(200, "Campaign updated", campaign));
});

const deactivateCampaign = asyncHandler(async (req, res) => {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
    if (!campaign) throw new ApiError(404, "Campaign not found");
    await DonationAudit.create({ actor: req.user._id, action: "campaign.deactivated", metadata: { campaign: campaign._id } });
    return res.status(200).json(new ApiResponse(200, "Campaign deactivated", campaign));
});

module.exports = { listCampaigns, listCampaignsAdmin, createCampaign, updateCampaign, deactivateCampaign };
