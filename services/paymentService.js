const axios = require("axios");
const crypto = require("crypto");

const client = axios.create({
    baseURL: "https://api.paystack.co",
    timeout: 15000,
    headers: { Accept: "application/json" },
});

const WEBHOOK_TOLERANCE_SECONDS = 300;
const SIGNATURE_HEX_PATTERN = /^[a-f\d]{128}$/i;
const PAYSTACK_SECRET_KEY_PATTERN = /^sk_(test|live)_[A-Za-z0-9]{16,}$/;

function getSecret() {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (typeof secret !== "string" || !PAYSTACK_SECRET_KEY_PATTERN.test(secret.trim())) {
        throw Object.assign(new Error("Payment service is not configured"), { code: "PAYMENT_NOT_CONFIGURED" });
    }
    return secret.trim();
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

const headerValue = (value) => Array.isArray(value) ? value[0] : value;

function getWebhookSigningSecrets() {
    return [process.env.PAYSTACK_WEBHOOK_SECRET, process.env.PAYSTACK_WEBHOOK_SECRET_PREVIOUS]
        .filter((secret) => typeof secret === "string" && secret.trim().startsWith("whsec_"))
        .map((secret) => secret.trim());
}

function parseModernSignatureHeader(header) {
    if (typeof header !== "string") return null;
    let timestamp = null;
    const signatures = [];
    for (const part of header.split(",")) {
        const separator = part.indexOf("=");
        if (separator === -1) continue;
        const key = part.slice(0, separator).trim().toLowerCase();
        const value = part.slice(separator + 1).trim();
        if (key === "t") {
            if (timestamp !== null || !/^\d+$/.test(value)) return null;
            timestamp = Number(value);
        } else if (key === "v1") {
            const colon = value.indexOf(":");
            if (colon === -1) {
                // Older timestamped integrations used v1=<hex>; still verify it
                // with the same secret and timestamp rules.
                signatures.push({ keyId: null, hex: value });
            } else {
                const keyId = value.slice(0, colon).trim();
                const hex = value.slice(colon + 1).trim();
                if (!/^whk_[A-Za-z0-9_-]+$/.test(keyId)) continue;
                signatures.push({ keyId, hex });
            }
        }
    }
    if (timestamp === null || !Number.isSafeInteger(timestamp) || signatures.length === 0) return null;
    return { timestamp, signatures };
}

function verifyModernWebhookSignature(rawBody, header) {
    const parsed = parseModernSignatureHeader(header);
    if (!parsed) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parsed.timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;
    const secrets = getWebhookSigningSecrets();
    if (secrets.length === 0) return false;
    return secrets.some((secret) => {
        const expected = crypto.createHmac("sha512", secret)
            .update(String(parsed.timestamp))
            .update(".")
            .update(rawBody)
            .digest();
        return parsed.signatures.some(({ hex }) => {
            if (!SIGNATURE_HEX_PATTERN.test(hex)) return false;
            return crypto.timingSafeEqual(expected, Buffer.from(hex, "hex"));
        });
    });
}

function verifyLegacyWebhookSignature(rawBody, header) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (typeof secret !== "string" || secret.trim().length === 0) return false;
    if (typeof header !== "string" || !SIGNATURE_HEX_PATTERN.test(header)) return false;
    const expected = crypto.createHmac("sha512", secret.trim()).update(rawBody).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(header, "hex"));
}

// Modern Paystack-Signature is preferred when present. An invalid modern
// signature is never accepted through a legacy-header fallback.
const verifyWebhookSignature = (rawBody, headers = {}) => {
    if (!Buffer.isBuffer(rawBody)) return false;
    const modern = headerValue(headers["paystack-signature"]);
    if (modern !== undefined) return verifyModernWebhookSignature(rawBody, modern);
    return verifyLegacyWebhookSignature(rawBody, headerValue(headers["x-paystack-signature"]));
};

module.exports = {
    initializePayment,
    verifyPayment,
    verifyWebhookSignature,
};
