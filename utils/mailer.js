const crypto = require("node:crypto");
const { getEmailConfig, getResendClient, getSmtpTransporter, sanitizeProviderError } = require("../Config/email");
const { buildEmail } = require("./emailTemplates");

const MINISTRY = "Royal Higher Life Ministries";
const ministryRecipient = () => process.env.MINISTRY_NOTIFICATION_EMAIL?.trim();
const notConfigured = () => Promise.resolve({ sent: false, reason: "not_configured", provider: getEmailConfig().provider });

async function sendEmail({ to, subject, html, text, idempotencyKey, replyTo }) {
    const recipients = Array.isArray(to) ? to : [to];
    const validEmail = (value) => typeof value === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim());
    if (!recipients.length || recipients.some((recipient) => !validEmail(recipient)) || typeof subject !== "string" || /[\r\n]/.test(subject)) {
        console.warn("Email delivery skipped: invalid recipient or subject.");
        return { sent: false, reason: "invalid_input" };
    }
    const config = getEmailConfig();
    if (!config.configured) {
        console.warn("Email delivery skipped: active provider configuration is incomplete.", { provider: config.provider, reason: config.reason });
        return { sent: false, reason: "not_configured", provider: config.provider };
    }

    try {
        const message = { from: config.from, to, subject, html, text };
        if (replyTo && validEmail(replyTo)) message.replyTo = replyTo.trim();
        else if (!replyTo && process.env.EMAIL_REPLY_TO && validEmail(process.env.EMAIL_REPLY_TO.trim())) {
            message.replyTo = process.env.EMAIL_REPLY_TO.trim();
        }
        if (config.provider === "gmail-smtp") {
            const info = await getSmtpTransporter().sendMail(message);
            if (!Array.isArray(info.accepted) || info.accepted.length < recipients.length) {
                return { sent: false, reason: "provider_error", providerCode: "smtp_recipient_rejected", provider: config.provider };
            }
            const id = typeof info.messageId === "string" ? info.messageId : null;
            return { sent: true, accepted: true, id, provider: config.provider, deliveryStatus: "unknown" };
        }
        if (config.provider === "resend") {
            const client = getResendClient();
            if (!client) return { sent: false, reason: "not_configured", provider: config.provider };
            const { data, error } = await client.emails.send(message, idempotencyKey ? { idempotencyKey } : undefined);
            if (error) {
                const providerStatus = Number.isInteger(error.statusCode) ? error.statusCode : null;
                const providerCode = typeof error.name === "string"
                    ? error.name.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60)
                    : "provider_error";
                console.error("Email provider rejected a message.", { provider: config.provider, name: providerCode, status: providerStatus });
                return { sent: false, reason: "provider_error", providerCode, provider: config.provider, ...(providerStatus ? { providerStatus } : {}) };
            }
            return { sent: true, accepted: true, id: data?.id || null, provider: config.provider, deliveryStatus: "unknown" };
        }
        return { sent: false, reason: "unsupported_provider" };
    } catch (error) {
        const safeError = sanitizeProviderError(error);
        console.error("Email delivery request failed.", { provider: config.provider, ...safeError });
        return { sent: false, ...safeError, provider: config.provider };
    }
}

async function sendTemplatedEmail({ to, subject, template, values, idempotencyKey, replyTo }) {
    const message = buildEmail(template, values);
    return sendEmail({ to, subject, ...message, idempotencyKey, replyTo });
}

function stableKey(type, id) {
    const digest = crypto.createHash("sha256").update(`${type}:${id}`).digest("hex");
    return `${type}-${digest.slice(0, 48)}`;
}

const sendVerificationEmail = (user, token) => {
    const url = `${(process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
    return sendTemplatedEmail({
        to: user.email,
        subject: `Welcome to ${MINISTRY} — verify your email`,
        template: "verification",
        values: { name: user.firstName, url },
        idempotencyKey: stableKey("verification", `${user.id}:${token}`),
    });
};

const sendPasswordResetEmail = (user, token) => {
    const url = `${(process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "")}/reset-password/${encodeURIComponent(token)}`;
    return sendTemplatedEmail({
        to: user.email,
        subject: `Reset your ${MINISTRY} password`,
        template: "passwordReset",
        values: { name: user.firstName, url },
        idempotencyKey: stableKey("password-reset", `${user.id}:${token}`),
    });
};

const sendPasswordChangedEmail = (user, eventId) => sendTemplatedEmail({
    to: user.email, subject: `Your ${MINISTRY} password was changed`, template: "securityNotice",
    values: { name: user.firstName }, idempotencyKey: stableKey("password-changed", `${user.id}:${eventId}`),
});

const sendContactConfirmation = (email, name, reference, id, submittedAt) => sendTemplatedEmail({
    to: email, subject: `We received your message — ${MINISTRY}`, template: "contactConfirmation",
    values: { name, reference, submittedAt }, idempotencyKey: id ? stableKey("contact-confirmation", id) : undefined,
});

const sendPrayerConfirmation = (email, name, reference, id, submittedAt) => sendTemplatedEmail({
    to: email, subject: `We received your prayer request — ${MINISTRY}`, template: "prayerConfirmation",
    values: { name, reference, submittedAt }, idempotencyKey: id ? stableKey("prayer-confirmation", id) : undefined,
});

const sendAdminContactNotification = (contact) => {
    const to = ministryRecipient();
    if (!to) return notConfigured();
    return sendTemplatedEmail({
        to, subject: "New website contact message", template: "adminContact",
        values: {
            ...contact,
            submittedAt: contact.createdAt ? new Date(contact.createdAt).toISOString() : new Date().toISOString(),
        }, idempotencyKey: stableKey("admin-contact", contact.id), replyTo: contact.email,
    });
};

const sendAdminPrayerNotification = (request) => {
    const to = ministryRecipient();
    if (!to) return notConfigured();
    return sendTemplatedEmail({
        to, subject: "New website prayer request", template: "adminPrayer",
        values: {
            ...request,
            submittedAt: request.createdAt ? new Date(request.createdAt).toISOString() : new Date().toISOString(),
            adminUrl: `${(process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "")}/admin`,
        }, idempotencyKey: stableKey("admin-prayer", request.id),
    });
};

const sendVolunteerConfirmation = (volunteer) => sendTemplatedEmail({
    to: volunteer.email,
    subject: `We received your volunteer application — ${MINISTRY}`,
    template: "volunteerConfirmation",
    values: { name: volunteer.name, reference: volunteer.reference, submittedAt: volunteer.createdAt ? new Date(volunteer.createdAt).toISOString() : new Date().toISOString() },
    idempotencyKey: stableKey("volunteer-confirmation", volunteer.id),
});

const sendAdminVolunteerNotification = (volunteer) => {
    const to = ministryRecipient();
    if (!to) return notConfigured();
    return sendTemplatedEmail({
        to, subject: "New website volunteer application", template: "adminVolunteer",
        values: { ...volunteer, submittedAt: volunteer.createdAt ? new Date(volunteer.createdAt).toISOString() : new Date().toISOString() },
        idempotencyKey: stableKey("admin-volunteer", volunteer.id), replyTo: volunteer.email,
    });
};

const sendTestimonyConfirmation = (email, name, reference, id, submittedAt) => sendTemplatedEmail({
    to: email,
    subject: `We received your testimony — ${MINISTRY}`,
    template: "testimonyConfirmation",
    values: { name, reference, submittedAt },
    idempotencyKey: id ? stableKey("testimony-confirmation", id) : undefined,
});

const sendAdminTestimonyNotification = (testimony) => {
    const to = ministryRecipient();
    if (!to) return notConfigured();
    return sendTemplatedEmail({
        to,
        subject: "New testimony awaiting review — Royal Higher Life Ministries",
        template: "adminTestimony",
    values: {
        ...testimony,
        submittedAt: testimony.createdAt ? new Date(testimony.createdAt).toISOString() : new Date().toISOString(),
        adminUrl: `${(process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "")}/admin`,
    },
        idempotencyKey: stableKey("admin-testimony", testimony.id),
        replyTo: testimony.email,
    });
};

const sendDonationConfirmation = (email, name, amount, currency, id, reference) => sendTemplatedEmail({
    to: email, subject: `Thank you for your gift — ${MINISTRY}`, template: "donationConfirmation",
    values: { name, amount, currency, reference, trackingUrl: `${(process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "")}/donations/track` }, idempotencyKey: id ? stableKey("donation-confirmation", id) : undefined,
});

const sendDonationTrackingCode = (email, code, id) => sendTemplatedEmail({
    to: email, subject: `Your donation verification code — ${MINISTRY}`, template: "donationTracking",
    values: { code }, idempotencyKey: id ? stableKey("donation-tracking", `${id}:${code}`) : undefined,
});

const sendEventRegistrationConfirmation = (email, name, eventTitle, id, cancelUrl) => sendTemplatedEmail({
    to: email, subject: `Registration confirmed: ${eventTitle}`, template: "eventConfirmation",
    values: { name, eventTitle, cancelUrl }, idempotencyKey: id ? stableKey("event-confirmation", id) : undefined,
});

const sendAdminEventRegistrationNotification = (registration) => {
    const to = ministryRecipient();
    if (!to) return notConfigured();
    return sendTemplatedEmail({
        to, subject: `New event registration: ${registration.eventTitle}`, template: "adminEventRegistration",
        values: { ...registration }, idempotencyKey: stableKey("admin-event-registration", registration.id), replyTo: registration.email,
    });
};

const sendNewsletterConfirmation = (email, firstName, id, unsubscribeUrl) => sendTemplatedEmail({
    to: email, subject: `Welcome to ${MINISTRY} updates`, template: "newsletterConfirmation",
    values: { name: firstName || "friend", unsubscribeUrl }, idempotencyKey: id ? stableKey("newsletter-confirmation", `${id}:${unsubscribeUrl}`) : undefined,
});

module.exports = {
    sendEmail,
    verifyEmailTransport: require("../Config/email").verifyEmailTransport,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendPasswordChangedEmail,
    sendContactConfirmation,
    sendPrayerConfirmation,
    sendAdminContactNotification,
    sendAdminPrayerNotification,
    sendVolunteerConfirmation,
    sendAdminVolunteerNotification,
    sendTestimonyConfirmation,
    sendAdminTestimonyNotification,
    sendDonationConfirmation,
    sendDonationTrackingCode,
    sendEventRegistrationConfirmation,
    sendAdminEventRegistrationNotification,
    sendNewsletterConfirmation,
};
