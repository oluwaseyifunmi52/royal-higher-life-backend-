const Contact = require("../Models/contact");
const Donation = require("../Models/donation");
const Event = require("../Models/event");
const PrayerRequest = require("../Models/prayerRequest");
const Review = require("../Models/review");
const User = require("../Models/user");
const Sermon = require("../Models/sermon");
const Gallery = require("../Models/gallery");
const Volunteer = require("../Models/volunteer");
const Partnership = require("../Models/partnership");
const Newsletter = require("../Models/newsletter");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");

const getOverview = asyncHandler(async (req, res) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    const verifiedDonation = { status: "successful", verifiedAt: { $ne: null } };

    const [
        totalMembers,
        activeMembers,
        totalContacts,
        totalPrayerRequests,
        answeredPrayerRequests,
        pendingReviews,
        donationTotals,
        monthlyDonations,
        topDonors,
        recentDonations,
        recentContacts,
        recentMembers,
        upcomingEvents,
        upcomingEventsCount,
        publishedSermons,
        publishedTestimonials,
        publishedImages,
        publishedVideos,
        volunteerApplications,
        partnershipApplications,
        newsletterSubscribers,
        pendingDonations,
        failedDonations,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Contact.countDocuments(),
        PrayerRequest.countDocuments(),
        PrayerRequest.countDocuments({ isAnswered: true }),
        Review.countDocuments({ isApproved: false }),
        Donation.aggregate([
            { $match: verifiedDonation },
            {
                $group: {
                    _id: "$currency",
                    totalAmount: { $sum: "$amount" },
                    totalCount: { $sum: 1 },
                    monthAmount: {
                        $sum: {
                            $cond: [{ $gte: ["$createdAt", startOfMonth] }, "$amount", 0],
                        },
                    },
                },
            },
        ]),
        Donation.aggregate([
            { $match: { ...verifiedDonation, createdAt: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        currency: "$currency",
                    },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.currency": 1 } },
        ]),
        Donation.aggregate([
            { $match: { ...verifiedDonation, isAnonymous: { $ne: true } } },
            {
                $group: {
                    _id: { name: "$donorName", currency: "$currency" },
                    totalAmount: { $sum: "$amount" },
                    donations: { $sum: 1 },
                },
            },
            { $sort: { totalAmount: -1 } },
            { $limit: 5 },
        ]),
        Donation.find(verifiedDonation).sort({ verifiedAt: -1 }).limit(8),
        Contact.find().sort({ createdAt: -1 }).limit(8),
        User.find().select("-password -otp -resetPasswordToken").sort({ createdAt: -1 }).limit(8),
        Event.find({ date: { $gte: today }, isPublished: { $ne: false }, $or: [{ publishAt: null }, { publishAt: { $lte: today } }] }).sort({ date: 1 }).limit(8),
        Event.countDocuments({ date: { $gte: today }, isPublished: { $ne: false }, $or: [{ publishAt: null }, { publishAt: { $lte: today } }] }),
        Sermon.countDocuments({ isPublished: { $ne: false }, $or: [{ publishAt: null }, { publishAt: { $lte: today } }] }),
        Review.countDocuments({ isApproved: true }),
        Gallery.countDocuments({ isPublished: { $ne: false }, mediaType: { $ne: "video" } }),
        Gallery.countDocuments({ isPublished: { $ne: false }, mediaType: "video" }),
        Volunteer.countDocuments(),
        Partnership.countDocuments(),
        Newsletter.countDocuments({ isActive: true }),
        Donation.countDocuments({ status: "pending" }),
        Donation.countDocuments({ status: "failed" }),
    ]);

    const totalDonationCount = donationTotals.reduce((sum, item) => sum + item.totalCount, 0);
    const totalNgnRevenue = donationTotals.find((item) => item._id === "NGN")?.totalAmount || 0;
    const monthlyNgnRevenue = donationTotals.find((item) => item._id === "NGN")?.monthAmount || 0;

    return res.status(200).json(
        new ApiResponse(200, "Dashboard overview fetched", {
            stats: {
                members: totalMembers,
                activeMembers,
                contacts: totalContacts,
                prayerRequests: totalPrayerRequests,
                answeredPrayerRequests,
                pendingReviews,
                donations: totalDonationCount,
                totalRevenue: totalNgnRevenue,
                monthlyRevenue: monthlyNgnRevenue,
                revenueByCurrency: donationTotals.map((item) => ({ currency: item._id, amount: item.totalAmount, donations: item.totalCount })),
                monthlyRevenueByCurrency: donationTotals.map((item) => ({ currency: item._id, amount: item.monthAmount })),
                publishedSermons,
                upcomingEvents: upcomingEventsCount,
                publishedTestimonials,
                galleryImages: publishedImages,
                galleryVideos: publishedVideos,
                volunteerApplications,
                partnershipApplications,
                newsletterSubscribers,
                pendingDonations,
                failedDonations,
            },
            charts: {
                monthlyDonations: monthlyDonations.map((item) => ({
                    year: item._id.year,
                    month: item._id.month,
                    currency: item._id.currency,
                    total: item.total,
                    count: item.count,
                })),
            },
            topDonors: topDonors.map((item) => ({
                donorName: item._id.name,
                currency: item._id.currency,
                totalAmount: item.totalAmount,
                donations: item.donations,
            })),
            recentDonations,
            recentContacts,
            recentMembers,
            upcomingEvents,
        })
    );
});

module.exports = {
    getOverview,
};
