const axios = require("axios");
const crypto = require("crypto");

const client = axios.create({
    baseURL: "https://api.paystack.co",
    timeout: 15000,
    headers: { Accept: "application/json" },
});

function getSecret() {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw Object.assign(new Error("Payment service is not configured"), { code: "PAYMENT_NOT_CONFIGURED" });
    return secret;
}

const initializePayment = async ({ email, amount, currency, reference, callback_url, metadata }) => {
    const response = await client.post("/transaction/initialize", {
        email, amount, currency, reference, callback_url, metadata,
    }, { headers: { Authorization: `Bearer ${getSecret()}` } });

    return response.data;
};

const verifyPayment = async (reference) => {
    const response = await client.get(`/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${getSecret()}` },
    });

    return response.data;
};

const verifyWebhookSignature = (rawBody, headers) => {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;
    const modern = headers["paystack-signature"];
    if (modern) {
        const parts = Object.fromEntries(String(modern).split(",").map((item) => item.split("=")));
        const timestamp = Number(parts.t);
        if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;
        const digest = crypto.createHmac("sha512", secret).update(`${parts.t}.${rawBody}`).digest("hex");
        return timingSafeEqualHex(digest, parts.v1);
    }
    const signature = headers["x-paystack-signature"];
    if (typeof signature !== "string" || !/^[a-f\d]{128}$/i.test(signature)) return false;
    const digest = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    return timingSafeEqualHex(digest, signature);
};

function timingSafeEqualHex(left, right) {
    if (typeof right !== "string" || left.length !== right.length || !/^[a-f\d]+$/i.test(right)) return false;
    return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

module.exports = {
    initializePayment,
    verifyPayment,
    verifyWebhookSignature,
};
