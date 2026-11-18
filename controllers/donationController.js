const crypto = require("crypto");
const mongoose = require("mongoose");
const Donation = require("../Models/donation");
const Campaign = require("../Models/campaign");
const DonationAudit = require("../Models/donationAudit");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const paymentService = require("../services/paymentService");
const { sendDonationConfirmation, sendDonationTrackingCode } = require("../utils/mailer");

const FRONTEND_URL = () => (process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "");

const PAYMENT_PROVIDERS = Object.freeze({
    paystack: { id: "paystack", name: "Paystack" },
});

// A real Paystack key starts with sk_test_ or sk_live_ and has a substantial
// key body. Presence of the variable alone is never proof of merchant eligibility.
const PAYSTACK_SECRET_KEY_PATTERN = /^sk_(test|live)_[A-Za-z0-9]{16,}$/;
const PAYSTACK_PLACEHOLDER_PATTERN = /(placeholder|replace[-_]?me|your[-_]?(secret|api)[-_]?key|example|dummy|fake|changeme|xxxx|000000|111111)/i;

const normalizedPaystackCountry = () => String(process.env.PAYSTACK_ACCOUNT_COUNTRY || "").trim().toUpperCase();

const paystackEnvironment = () => {
    const nodeEnvironment = String(process.env.NODE_ENV || "development").trim().toLowerCase();
    return ["production", "prod", "live"].includes(nodeEnvironment) ? "live" : "test";
};

/**
 * Returns true only when the configured key looks genuine, is for the right
 * account country, and matches the environment this backend is running in.
 * Account eligibility still has to be confirmed in the Paystack dashboard.
 */
const hasConfiguredNgnPaymentProvider = () => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (typeof secretKey !== "string" || secretKey !== secretKey.trim()) return false;
    if (!PAYSTACK_SECRET_KEY_PATTERN.test(secretKey)) return false;
    if (PAYSTACK_PLACEHOLDER_PATTERN.test(secretKey)) return false;
    if (/^(.)\1+$/.test(secretKey.slice(secretKey.indexOf("_", 3) + 1))) return false;
    if (normalizedPaystackCountry() !== "NG") return false;
    return secretKey.startsWith("sk_test_") ? paystackEnvironment() === "test" : paystackEnvironment() === "live";
};

const getConfiguredDonationProviderIds = () => hasConfiguredNgnPaymentProvider() ? ["paystack"] : [];
const safeDonation = (donation) => ({
    id: donation._id,
    donorName: donation.isAnonymous ? "Anonymous" : donation.donorName,
    amount: donation.amount,
    currency: donation.currency,
    status: donation.status === "successful" && !donation.verifiedAt ? "unverified" : donation.status,
    paymentReference: donation.paymentReference,
    donationType: donation.donationType,
    campaign: donation.campaign,
    createdAt: donation.createdAt,
    verifiedAt: donation.verifiedAt,
});

const createDonation = asyncHandler(async (req, res) => {
    const { firstName, lastName, donorName, name, email, phone, amount, currency = "NGN", purpose, donationType, isAnonymous, anonymous, message, note, campaignId } = req.body;
    const resolvedDonorName = String(donorName || name || [firstName, lastName].filter(Boolean).join(" ")).trim();
    const parsedAmount = Number(amount);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!resolvedDonorName || resolvedDonorName.length > 120) throw new ApiError(400, "Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) throw new ApiError(400, "Please enter a valid email address.");
    const normalizedCurrency = String(currency || "NGN").toUpperCase().trim();
    const currencyConfig = DONATION_CURRENCIES.find((c) => c.code === normalizedCurrency);
    if (!currencyConfig) throw new ApiError(400, "Unsupported currency.");
    if (!Number.isFinite(parsedAmount) || parsedAmount < currencyConfig.minimum || parsedAmount > currencyConfig.maximum || Math.round(parsedAmount * 100) !== parsedAmount * 100) throw new ApiError(400, `Enter an amount between ${currencyConfig.symbol}${currencyConfig.minimum.toLocaleString()} and ${currencyConfig.symbol}${currencyConfig.maximum.toLocaleString()}.`);
    // Only currencies with a genuinely implemented provider can be paid online.
    if (currencyConfig.providerIds.length === 0)
        throw new ApiError(400, "Online giving is not available for this currency yet.");
    const configuredProviderIds = getConfiguredDonationProviderIds();
    if (configuredProviderIds.length === 0)
        throw new ApiError(503, "Donation payments are temporarily unavailable. Please contact the church office for other giving options.");
    if (!currencyConfig.providerIds.some((id) => configuredProviderIds.includes(id)))
        throw new ApiError(400, "Online giving is not available for this currency yet.");
    const resolvedPaymentMethod = configuredProviderIds.includes(req.body.paymentMethod)
        ? req.body.paymentMethod
        : configuredProviderIds[0];
    if (!phone || String(phone).length > 40) throw new ApiError(400, "Please enter a valid phone number.");
    let campaign = null;
    if (campaignId) {
        if (!mongoose.isValidObjectId(campaignId)) throw new ApiError(400, "Selected campaign is invalid.");
        campaign = await Campaign.findOne({ _id: campaignId, isActive: true });
        if (!campaign) throw new ApiError(400, "This campaign is not available for donations.");
    }
    if (req.user && req.user.email.toLowerCase() !== normalizedEmail) throw new ApiError(400, "Use the email address linked to your account, or donate as a guest.");
    const reference = `RHLM-${Date.now()}-${crypto.randomBytes(10).toString("hex")}`;
    const donation = await Donation.create({
        donorName: resolvedDonorName,
        email: normalizedEmail,
        phone: String(phone).trim(),
        amount: parsedAmount,
        currency: normalizedCurrency,
        paymentMethod: resolvedPaymentMethod,
        paymentReference: reference,
        status: "pending",
        donationType: purpose || donationType || "General Offering",
        isAnonymous: Boolean(isAnonymous ?? anonymous),
        note: String(message || note || "").slice(0, 2000),
        campaign: campaign?._id || null,
        user: req.user?._id || null,
    });
    try {
        const payment = await paymentService.initializePayment({
            email: normalizedEmail,
            amount: Math.round(parsedAmount * 100),
            currency: normalizedCurrency,
            reference,
            callback_url: `${FRONTEND_URL()}/donations/complete`,
            metadata: { donationId: String(donation._id), donationReference: reference },
        });
        if (!payment.status || !payment.data?.authorization_url) throw new Error("Payment provider did not return a checkout URL");
        await DonationAudit.create({ donation: donation._id, action: "payment.initialized", metadata: { provider: "paystack" } }).catch((error) => {
            console.error("Donation audit write failed", { code: error.code || "database_error" });
        });
        return res.status(201).json(new ApiResponse(201, "Payment initialized", {
            reference,
            authorizationUrl: payment.data.authorization_url,
            donation: safeDonation(donation),
        }));
    } catch (error) {
        await Donation.updateOne({ _id: donation._id, status: "pending" }, { $set: { status: "failed" } });
        if (error.code === "PAYMENT_NOT_CONFIGURED") throw new ApiError(503, "Donation payments are temporarily unavailable.");
        console.error("Paystack initialization failed", { code: error.code || "provider_error", status: error.response?.status });
        throw new ApiError(502, "Unable to start payment. Please try again later.");
    }
});

async function verifyAndFinalize(reference, eventId) {
    const donation = await Donation.findOne({ paymentReference: reference });
    if (!donation) return null;
    if (donation.status === "successful" && donation.verifiedAt) return donation;
    const result = await paymentService.verifyPayment(reference);
    const transaction = result?.data;
    const matches = result?.status === true && transaction?.status === "success" &&
        transaction.reference === reference && transaction.currency === donation.currency &&
        Number(transaction.amount) === Math.round(donation.amount * 100);
    if (!matches) {
        if (transaction?.status === "failed" || transaction?.status === "abandoned") {
            await Donation.updateOne({ _id: donation._id, status: "pending" }, { $set: { status: "failed" } });
        }
        return await Donation.findById(donation._id);
    }
    const updated = await Donation.findOneAndUpdate(
        { _id: donation._id, status: "pending", verifiedAt: null },
        { $set: { status: "successful", verifiedAt: new Date() } },
        { new: true }
    );
    if (updated) {
        await DonationAudit.create({ donation: donation._id, action: "payment.verified", eventId: eventId || undefined, metadata: { provider: "paystack", amountMinor: transaction.amount, currency: transaction.currency } }).catch((error) => {
            if (error.code !== 11000) console.error("Donation audit write failed", { code: error.code || "database_error" });
        });
        const notification = await sendDonationConfirmation(donation.email, donation.donorName, donation.amount, donation.currency, donation._id, reference);
        await Donation.updateOne({ _id: donation._id }, { $set: {
            receiptNotificationStatus: notification?.accepted ? "accepted" : notification?.reason === "network_error" ? "unknown" : "failed",
            receiptProviderMessageId: notification?.accepted ? notification.id || "" : "",
            receiptNotificationFailure: notification?.accepted ? "" : notification?.providerCode || notification?.reason || "provider_error",
            receiptSentAt: notification?.accepted ? new Date() : null,
            receiptNotificationAttemptCount: 1,
            receiptDeliveryStatus: "unknown",
        } });
    }
    return await Donation.findById(donation._id);
}

const verifyDonation = asyncHandler(async (req, res) => {
    const reference = String(req.body.reference || "").trim();
    if (!/^RHLM-[A-Za-z0-9-]{10,80}$/.test(reference)) throw new ApiError(400, "A valid payment reference is required.");
    let donation;
    try { donation = await verifyAndFinalize(reference); }
    catch (error) {
        if (error.code === "PAYMENT_NOT_CONFIGURED") throw new ApiError(503, "Donation payments are temporarily unavailable.");
        console.error("Paystack verification failed", { code: error.code || "provider_error", status: error.response?.status });
        throw new ApiError(502, "We could not confirm this payment yet. Please check again shortly.");
    }
    if (!donation) throw new ApiError(404, "Donation reference not found.");
    return res.status(200).json(new ApiResponse(200, "Payment status checked", safeDonation(donation)));
});

const retryDonationReceipt = asyncHandler(async (req, res) => {
    const donation = await Donation.findById(req.params.id);
    if (!donation) throw new ApiError(404, "Donation not found.");
    if (donation.status !== "successful" || !donation.verifiedAt || !donation.email) {
        throw new ApiError(409, "A verified successful donation with an email address is required.");
    }
    const result = await sendDonationConfirmation(donation.email, donation.donorName, donation.amount, donation.currency, donation._id, donation.paymentReference);
    donation.receiptNotificationStatus = result?.accepted ? "accepted" : result?.reason === "network_error" ? "unknown" : "failed";
    donation.receiptProviderMessageId = result?.accepted ? result.id || "" : "";
    donation.receiptNotificationFailure = result?.accepted ? "" : result?.providerCode || result?.reason || "provider_error";
    donation.receiptNotificationAttemptCount = (donation.receiptNotificationAttemptCount || 0) + 1;
    donation.receiptSentAt = result?.accepted ? new Date() : donation.receiptSentAt;
    donation.receiptDeliveryStatus = "unknown";
    await donation.save();
    return res.status(200).json(new ApiResponse(200, result?.accepted
        ? "The email provider accepted the donation receipt; delivery is not confirmed."
        : "The donation remains recorded, but the receipt could not be accepted.", {
        reference: donation.paymentReference,
        notificationStatus: donation.receiptNotificationStatus,
        providerMessageId: donation.receiptProviderMessageId || null,
        notificationFailure: donation.receiptNotificationFailure,
        deliveryStatus: donation.receiptDeliveryStatus,
    }));
});

const paystackWebhook = asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.rawBody) || !paymentService.verifyWebhookSignature(req.rawBody, req.headers)) return res.status(401).json({ success: false });
    const eventId = String(req.body?.data?.id || "");
    const reference = String(req.body?.data?.reference || "");
    if (req.body?.event !== "charge.success" || !reference || !eventId) return res.status(200).json({ received: true });
    try {
        const exists = await DonationAudit.exists({ eventId });
        if (!exists) await verifyAndFinalize(reference, eventId);
    } catch (error) {
        console.error("Paystack webhook processing failed", { code: error.code || "processing_error" });
        return res.status(500).json({ received: false });
    }
    return res.status(200).json({ received: true });
});

const requestDonationTracking = asyncHandler(async (req, res) => {
    const reference = String(req.body.reference || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const donation = await Donation.findOne({ paymentReference: reference, email, status: "successful", verifiedAt: { $ne: null } }).select("+trackingCodeHash +trackingCodeExpiresAt +trackingAttempts");
    if (donation && donation.trackingAttempts < 5) {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        await Donation.updateOne({ _id: donation._id }, { $set: { trackingCodeHash: crypto.createHash("sha256").update(code).digest("hex"), trackingCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), trackingAttempts: donation.trackingAttempts + 1 } });
        await sendDonationTrackingCode(email, code, donation._id);
    }
    return res.status(200).json(new ApiResponse(200, "If the donation details match, a verification code has been emailed."));
});

const confirmDonationTracking = asyncHandler(async (req, res) => {
    const reference = String(req.body.reference || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const base = { paymentReference: reference, email, status: "successful", verifiedAt: { $ne: null }, trackingCodeExpiresAt: { $gt: new Date() }, trackingAttempts: { $lt: 5 } };
    const donation = await Donation.findOne(base).select("+trackingCodeHash +trackingCodeExpiresAt +trackingAttempts");
    if (!donation || !donation.trackingCodeHash || !crypto.timingSafeEqual(Buffer.from(donation.trackingCodeHash), Buffer.from(codeHash))) {
        if (donation) await Donation.updateOne({ _id: donation._id }, { $inc: { trackingAttempts: 1 } });
        throw new ApiError(400, "The verification code is invalid or expired.");
    }
    await Donation.updateOne({ _id: donation._id }, { $unset: { trackingCodeHash: 1, trackingCodeExpiresAt: 1 }, $set: { trackingAttempts: 5 } });
    return res.status(200).json(new ApiResponse(200, "Donation found", safeDonation(donation)));
});

const getDonations = asyncHandler(async (req, res) => {
    const { status, from, to, reference } = req.query;
    const filter = {};
    if (["pending", "successful", "failed"].includes(status)) filter.status = status;
    if (from || to) filter.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    if (reference) filter.paymentReference = { $regex: String(reference).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const donations = await Donation.find(filter).populate("campaign", "title slug").sort({ createdAt: -1 }).limit(500).lean();
    return res.status(200).json(new ApiResponse(200, "Donations fetched", donations));
});

const getDonationById = asyncHandler(async (req, res) => {
    const donation = await Donation.findById(req.params.id).populate("campaign", "title slug");
    if (!donation) throw new ApiError(404, "Donation not found");
    return res.status(200).json(new ApiResponse(200, "Donation fetched", donation));
});

const getMyDonations = asyncHandler(async (req, res) => {
    const donations = await Donation.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json(new ApiResponse(200, "Your donation history fetched", donations.map(safeDonation)));
});

const getDonationAudit = asyncHandler(async (req, res) => {
    const records = await DonationAudit.find().populate("donation", "paymentReference").populate("actor", "firstName lastName email").sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json(new ApiResponse(200, "Donation audit history fetched", records));
});

const updateDonation = asyncHandler(async (req, res) => {
    const allowed = { donorName: req.body.donorName, phone: req.body.phone, isAnonymous: req.body.isAnonymous, note: req.body.note };
    for (const key of Object.keys(allowed)) if (allowed[key] === undefined) delete allowed[key];
    const donation = await Donation.findByIdAndUpdate(req.params.id, { $set: allowed }, { new: true, runValidators: true });
    if (!donation) throw new ApiError(404, "Donation not found");
    await DonationAudit.create({ donation: donation._id, actor: req.user._id, action: "donation.updated", metadata: { fields: Object.keys(allowed) } });
    return res.status(200).json(new ApiResponse(200, "Donation updated", donation));
});

const deleteDonation = asyncHandler(async (req, res) => {
    const donation = await Donation.findById(req.params.id);
    if (!donation) throw new ApiError(404, "Donation not found");
    if (donation.status === "successful") throw new ApiError(409, "Successful donation records are retained for financial records.");
    await DonationAudit.create({ donation: donation._id, actor: req.user._id, action: "donation.deleted" });
    await Donation.deleteOne({ _id: donation._id });
    return res.status(200).json(new ApiResponse(200, "Donation deleted", null));
});

const DONATION_CURRENCIES = [
    {
        code: "NGN",
        name: "Nigerian Naira",
        symbol: "\u20a6",
        decimals: 2,
        presets: [5000, 10000, 25000, 50000, 100000],
        minimum: 100,
        maximum: 10000000,
        providerIds: ["paystack"],
    },
    { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, presets: [10, 25, 50, 100, 250], minimum: 2, maximum: 50000, providerIds: [] },
    { code: "GBP", name: "British Pound", symbol: "£", decimals: 2, presets: [5, 10, 25, 50, 100], minimum: 1, maximum: 40000, providerIds: [] },
    { code: "EUR", name: "Euro", symbol: "€", decimals: 2, presets: [5, 10, 25, 50, 100], minimum: 1, maximum: 40000, providerIds: [] },
    { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimals: 2, presets: [10, 25, 50, 100, 250], minimum: 2, maximum: 60000, providerIds: [] },
    { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, presets: [10, 25, 50, 100, 250], minimum: 2, maximum: 60000, providerIds: [] },
    { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", decimals: 2, presets: [50, 100, 250, 500, 1000], minimum: 1, maximum: 500000, providerIds: [] },
    { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2, presets: [500, 1000, 2500, 5000, 10000], minimum: 50, maximum: 5000000, providerIds: [] },
    { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2, presets: [100, 250, 500, 1000, 2500], minimum: 10, maximum: 500000, providerIds: [] },
];

// Public: advertise donation currency options. Availability is derived from
// the same eligibility check used by donation initialization, so the catalogue
// never advertises a currency the backend cannot actually process.
const getDonationCurrencies = asyncHandler(async (req, res) => {
    const configuredProviderIds = getConfiguredDonationProviderIds();
    const providers = configuredProviderIds.map((id) => PAYMENT_PROVIDERS[id]).filter(Boolean);
    const currencies = DONATION_CURRENCIES.map(({ providerIds, ...currency }) => {
        const supported = providerIds
            .filter((id) => configuredProviderIds.includes(id))
            .map((id) => PAYMENT_PROVIDERS[id])
            .filter(Boolean);
        const available = supported.length > 0;
        const unavailableReason = available
            ? null
            : providerIds.length === 0
                ? "Online giving is not available for this currency yet."
                : "Online giving for this currency is temporarily unavailable.";
        return {
            ...currency,
            providers: supported,
            supportedProviders: supported.map((provider) => provider.id),
            available,
            availability: available ? "available" : "unavailable",
            reason: unavailableReason,
            unavailableReason,
        };
    });
    const defaultCurrency = "NGN";
    const anyAvailable = currencies.some((currency) => currency.available);
    return res.status(200).json(new ApiResponse(
        200,
        anyAvailable ? "Donation currencies fetched" : "Online giving is not configured yet. Contact the church office for other giving options.",
        { currencies, defaultCurrency, providers }
    ));
});

module.exports = {
    createDonation,
    verifyDonation,
    paystackWebhook,
    requestDonationTracking,
    confirmDonationTracking,
    retryDonationReceipt,
    getDonations,
    getDonationById,
    getMyDonations,
    getDonationAudit,
    updateDonation,
    deleteDonation,
    getDonationCurrencies,
    hasConfiguredNgnPaymentProvider,
    getConfiguredDonationProviderIds,
    DONATION_CURRENCIES,
};
