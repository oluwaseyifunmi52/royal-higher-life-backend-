const Contact = require("../Models/contact");
const Donation = require("../Models/donation");
const Event = require("../Models/event");
const PrayerRequest = require("../Models/prayerRequest");
const Review = require("../Models/review");
const User = require("../Models/user");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");

const getOverview = asyncHandler(async (req, res) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);

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
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Contact.countDocuments(),
        PrayerRequest.countDocuments(),
        PrayerRequest.countDocuments({ isAnswered: true }),
        Review.countDocuments({ isApproved: false }),
        Donation.aggregate([
            {
                $group: {
                    _id: null,
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
            { $match: { createdAt: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                    },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        Donation.aggregate([
            { $match: { isAnonymous: { $ne: true } } },
            {
                $group: {
                    _id: "$donorName",
                    totalAmount: { $sum: "$amount" },
                    donations: { $sum: 1 },
                },
            },
            { $sort: { totalAmount: -1 } },
            { $limit: 5 },
        ]),
        Donation.find().sort({ createdAt: -1 }).limit(8),
        Contact.find().sort({ createdAt: -1 }).limit(8),
        User.find().select("-password -otp -resetPasswordToken").sort({ createdAt: -1 }).limit(8),
        Event.find({ date: { $gte: today } }).sort({ date: 1 }).limit(8),
    ]);

    const totals = donationTotals[0] || {
        totalAmount: 0,
        totalCount: 0,
        monthAmount: 0,
    };

    return res.status(200).json(
        new ApiResponse(200, "Dashboard overview fetched", {
            stats: {
                members: totalMembers,
                activeMembers,
                contacts: totalContacts,
                prayerRequests: totalPrayerRequests,
                answeredPrayerRequests,
                pendingReviews,
                donations: totals.totalCount,
                totalRevenue: totals.totalAmount,
                monthlyRevenue: totals.monthAmount,
            },
            charts: {
                monthlyDonations: monthlyDonations.map((item) => ({
                    year: item._id.year,
                    month: item._id.month,
                    total: item.total,
                    count: item.count,
                })),
            },
            topDonors: topDonors.map((item) => ({
                donorName: item._id,
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
