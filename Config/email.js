const nodemailer = require("nodemailer");
const { Resend } = require("resend");

let smtpTransporter;
let resendClient;
let smtpConfigKey;
let resendConfigKey;

function parseFromAddress(value) {
    const from = String(value || "").trim();
    const address = from.match(/<([^<>]+)>/)?.[1] || from;
    const valid = address && !/[\r\n]/.test(from) && /^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(address);
    return { address: valid ? address.toLowerCase() : "", from: valid ? from : "" };
}

function getEmailConfig() {
    const provider = String(process.env.EMAIL_PROVIDER || "gmail-smtp").trim().toLowerCase();
    const { address, from } = parseFromAddress(process.env.EMAIL_FROM);

    if (provider === "gmail-smtp") {
        const host = String(process.env.EMAIL_HOST || "smtp.gmail.com").trim();
        const port = Number(process.env.EMAIL_PORT || 587);
        const user = String(process.env.EMAIL_USER || "").trim();
        const pass = String(process.env.EMAIL_PASS || "").trim();
        const secure = String(process.env.EMAIL_SECURE || "false").toLowerCase() === "true";
        const missing = [];
        if (host !== "smtp.gmail.com") missing.push("EMAIL_HOST");
        if (port !== 587) missing.push("EMAIL_PORT");
        if (secure) missing.push("EMAIL_SECURE");
        if (!user) missing.push("EMAIL_USER");
        if (!pass) missing.push("EMAIL_PASS");
        if (!address || address !== user.toLowerCase()) missing.push("EMAIL_FROM");
        const configured = missing.length === 0;
        return { provider, configured, host, port, secure, user, pass, from, fromAddress: address,
            missing, reason: configured ? "" : "missing_or_invalid_gmail_smtp_configuration" };
    }

    if (provider === "resend") {
        const apiKey = String(process.env.RESEND_API_KEY || "").trim();
        const senderDomain = address.split("@")[1]?.toLowerCase() || "";
        const productionSenderAllowed = process.env.NODE_ENV !== "production" || Boolean(senderDomain && !["gmail.com", "resend.dev"].includes(senderDomain));
        const configured = Boolean(apiKey && address && productionSenderAllowed);
        return { provider, configured, apiKey, from, fromAddress: address,
            reason: configured ? "" : productionSenderAllowed ? "missing_or_invalid_resend_configuration" : "resend_requires_a_ministry_domain_in_production" };
    }

    return { provider, configured: false, reason: "unsupported_email_provider" };
}

function getSmtpTransporter() {
    const config = getEmailConfig();
    if (config.provider !== "gmail-smtp" || !config.configured) return null;
    const nextKey = [config.host, config.port, config.user, config.pass].join("\u0000");
    if (!smtpTransporter || smtpConfigKey !== nextKey) {
        smtpTransporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: false,
            requireTLS: true,
            auth: { user: config.user, pass: config.pass },
            tls: { rejectUnauthorized: true, servername: config.host },
        });
        smtpConfigKey = nextKey;
    }
    return smtpTransporter;
}

function getResendClient() {
    const config = getEmailConfig();
    if (config.provider !== "resend" || !config.configured) return null;
    if (!resendClient || resendConfigKey !== config.apiKey) {
        resendClient = new Resend(config.apiKey);
        resendConfigKey = config.apiKey;
    }
    return resendClient;
}

function sanitizeProviderError(error) {
    const rawCode = typeof error?.code === "string" ? error.code : "";
    const code = /^[A-Z0-9_-]{1,40}$/i.test(rawCode) ? rawCode.toUpperCase() : "";
    const responseCode = Number.isInteger(error?.responseCode) ? error.responseCode : null;
    return {
        reason: code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ECONNRESET" || code === "ESOCKET" ? "network_error" : "provider_error",
        ...(code ? { providerCode: code.toLowerCase() } : {}),
        ...(responseCode ? { providerStatus: responseCode } : {}),
    };
}

async function verifyEmailTransport() {
    const config = getEmailConfig();
    if (!config.configured) return { verified: false, provider: config.provider, reason: config.reason };
    if (config.provider === "gmail-smtp") {
        try {
            await getSmtpTransporter().verify();
            return { verified: true, provider: config.provider };
        } catch (error) {
            return { verified: false, provider: config.provider, ...sanitizeProviderError(error) };
        }
    }
    return { verified: true, provider: config.provider, note: "Resend API configuration is present; SMTP verification does not apply." };
}

module.exports = { getEmailConfig, getSmtpTransporter, getResendClient, verifyEmailTransport, sanitizeProviderError };
