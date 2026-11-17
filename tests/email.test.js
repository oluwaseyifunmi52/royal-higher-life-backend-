const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { getResendClient, getSmtpTransporter } = require("../Config/email");
const { sendEmail } = require("../utils/mailer");
const { buildEmail } = require("../utils/emailTemplates");

const originalEnv = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: process.env.EMAIL_PORT,
    EMAIL_SECURE: process.env.EMAIL_SECURE,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
};

after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

test("missing Resend configuration reports undelivered", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const result = await sendEmail({ to: "member@example.com", subject: "Test", html: "<p>Hi</p>", text: "Hi" });
    assert.deepEqual(result, { sent: false, reason: "not_configured", provider: "resend" });
});

test("invalid email recipients are rejected before provider call", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_never_sent";
    process.env.EMAIL_FROM = "Royal Higher Life Ministries <mail@example.com>";
    const result = await sendEmail({ to: "invalid", subject: "Test", html: "", text: "" });
    assert.deepEqual(result, { sent: false, reason: "invalid_input" });
});

test("Resend acceptance carries a provider id without claiming delivery", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_never_sent";
    process.env.EMAIL_FROM = "Royal Higher Life Ministries <mail@example.com>";
    const client = getResendClient();
    let call;
    client.emails.send = async (...args) => {
        call = args;
        return { data: { id: "email_test_123" }, error: null };
    };
    const result = await sendEmail({
        to: "member@example.com", subject: "Test", html: "<p>Hi</p>", text: "Hi",
        replyTo: "visitor@example.com", idempotencyKey: "contact-test-key",
    });
    assert.deepEqual(result, { sent: true, accepted: true, id: "email_test_123", provider: "resend", deliveryStatus: "unknown" });
    assert.equal(call[0].replyTo, "visitor@example.com");
    assert.deepEqual(call[1], { idempotencyKey: "contact-test-key" });
});

test("Resend provider errors return an undelivered result", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_never_sent";
    process.env.EMAIL_FROM = "Royal Higher Life Ministries <mail@example.com>";
    const client = getResendClient();
    client.emails.send = async () => ({ data: null, error: { name: "APIError", message: "safe test error" } });
    const result = await sendEmail({ to: "member@example.com", subject: "Test", html: "", text: "" });
    assert.deepEqual(result, { sent: false, reason: "provider_error", providerCode: "apierror", provider: "resend" });
});

test("production Resend refuses Gmail and onboarding sender domains", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_never_sent";
    process.env.EMAIL_FROM = "Royal HigherLife Christian Ministries <royalhigherlifeoutreach@gmail.com>";
    const result = await sendEmail({ to: "member@example.com", subject: "Test", html: "", text: "" });
    assert.deepEqual(result, { sent: false, reason: "not_configured", provider: "resend" });
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv.NODE_ENV;
});

test("Gmail SMTP is the default and requires a configured app password", async () => {
    process.env.EMAIL_PROVIDER = "gmail-smtp";
    process.env.EMAIL_USER = "royalhigherlifeoutreach@gmail.com";
    process.env.EMAIL_FROM = "Royal HigherLife Christian Ministries <royalhigherlifeoutreach@gmail.com>";
    process.env.EMAIL_HOST = "smtp.gmail.com";
    process.env.EMAIL_PORT = "587";
    process.env.EMAIL_SECURE = "false";
    delete process.env.EMAIL_PASS;
    const result = await sendEmail({ to: "member@example.com", subject: "Test", html: "", text: "" });
    assert.equal(result.sent, false);
    assert.equal(result.reason, "not_configured");
});

test("Gmail SMTP uses STARTTLS and records the SMTP message id", async () => {
    process.env.EMAIL_PROVIDER = "gmail-smtp";
    process.env.EMAIL_USER = "royalhigherlifeoutreach@gmail.com";
    process.env.EMAIL_PASS = "test-only-secret";
    process.env.EMAIL_HOST = "smtp.gmail.com";
    process.env.EMAIL_PORT = "587";
    process.env.EMAIL_SECURE = "false";
    process.env.EMAIL_FROM = "Royal HigherLife Christian Ministries <royalhigherlifeoutreach@gmail.com>";
    const transporter = getSmtpTransporter();
    const originalSendMail = transporter.sendMail;
    let message;
    transporter.sendMail = async (value) => { message = value; return { accepted: ["member@example.com"], messageId: "<smtp-test-id@example.com>" }; };
    try {
        const result = await sendEmail({ to: "member@example.com", subject: "Test", html: "<p>Hi</p>", text: "Hi" });
        assert.deepEqual(result, { sent: true, accepted: true, id: "<smtp-test-id@example.com>", provider: "gmail-smtp", deliveryStatus: "unknown" });
        assert.equal(message.from, "Royal HigherLife Christian Ministries <royalhigherlifeoutreach@gmail.com>");
        assert.equal(transporter.options.requireTLS, true);
        assert.equal(transporter.options.tls.rejectUnauthorized, true);
    } finally {
        transporter.sendMail = originalSendMail;
    }
});

test("email templates escape submitted values and provide plain text", () => {
    const message = buildEmail("adminContact", {
        name: "<img src=x onerror=alert(1)>", email: "person@example.com", message: "<script>bad()</script>",
    });
    assert.match(message.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
    assert.doesNotMatch(message.html, /<script>/);
    assert.ok(message.text.length > 0);
});
