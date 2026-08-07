const Donation = require("../Models/donation");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendDonationConfirmation } = require("../utils/mailer");

const createDonation = asyncHandler(async (req, res) => {
    const {
        donorName,
        firstname,
        lastname,
        firstName,
        lastName,
        name,
        email,
        phone,
        amount,
        currency,
        paymentMethod,
        payment,
        paymentReference,
        status,
        donationType,
        purpose,
        isAnonymous,
        anonymous,
        note,
        message,
    } = req.body;

    const resolvedDonorName =
        donorName ||
        name ||
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        [firstname, lastname].filter(Boolean).join(" ").trim();

    if (!resolvedDonorName || !amount) {
        throw new ApiError(400, "Donor name and amount are required");
    }

    const donation = await Donation.create({
        donorName: resolvedDonorName,
        email,
        phone,
        amount,
        currency,
        paymentMethod: paymentMethod || payment,
        paymentReference,
        status,
        donationType: donationType || purpose,
        isAnonymous: isAnonymous ?? anonymous ?? false,
        note: note || message,
    });

    if (email) {
        sendDonationConfirmation(email, resolvedDonorName, amount, currency || "NGN").catch((err) =>
            console.error("Donation confirmation email failed:", err.message)
        );
    }

    return res.status(201).json(new ApiResponse(201, "Donation recorded", donation));
});

const getDonations = asyncHandler(async (req, res) => {
    const donations = await Donation.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Donations fetched", donations));
});

const getDonationById = asyncHandler(async (req, res) => {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
        throw new ApiError(404, "Donation not found");
    }

    return res.status(200).json(new ApiResponse(200, "Donation fetched", donation));
});

const updateDonation = asyncHandler(async (req, res) => {
    const donation = await Donation.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!donation) {
        throw new ApiError(404, "Donation not found");
    }

    return res.status(200).json(new ApiResponse(200, "Donation updated", donation));
});

const deleteDonation = asyncHandler(async (req, res) => {
    const donation = await Donation.findByIdAndDelete(req.params.id);

    if (!donation) {
        throw new ApiError(404, "Donation not found");
    }

    return res.status(200).json(new ApiResponse(200, "Donation deleted", null));
});

module.exports = {
    createDonation,
    getDonations,
    getDonationById,
    updateDonation,
    deleteDonation,
};
