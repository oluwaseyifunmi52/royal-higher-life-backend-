require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });

const { getEmailConfig, verifyEmailTransport } = require("../Config/email");
const { sendEmail } = require("../utils/mailer");

async function main() {
    const config = getEmailConfig();
    const recipient = String(process.env.MINISTRY_NOTIFICATION_EMAIL || "").trim();
    if (!config.configured) {
        console.error("Email test not run: active provider configuration is incomplete.", { provider: config.provider, reason: config.reason, ...(config.missing?.length ? { missing: config.missing } : {}) });
        process.exitCode = 1;
        return;
    }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) {
        console.error("Email test not run: MINISTRY_NOTIFICATION_EMAIL is invalid.");
        process.exitCode = 1;
        return;
    }

    const verification = await verifyEmailTransport();
    if (!verification.verified) {
        console.error("Email provider verification failed.", {
            provider: verification.provider,
            reason: verification.reason,
            ...(verification.providerCode ? { providerCode: verification.providerCode } : {}),
            ...(verification.providerStatus ? { providerStatus: verification.providerStatus } : {}),
        });
        process.exitCode = 1;
        return;
    }
    const result = await sendEmail({
        to: recipient,
        subject: "Royal HigherLife local email configuration test",
        text: "This is a local configuration test from the Royal HigherLife backend. It contains no visitor data.",
        html: "<p>This is a local configuration test from the Royal HigherLife backend. It contains no visitor data.</p>",
    });
    if (!result.accepted) {
        console.error("Test email was not accepted by the configured provider.", {
            provider: result.provider,
            reason: result.reason,
            ...(result.providerCode ? { providerCode: result.providerCode } : {}),
            ...(result.providerStatus ? { providerStatus: result.providerStatus } : {}),
        });
        process.exitCode = 1;
        return;
    }
    console.log("Test message accepted by provider; inbox delivery is not confirmed.", {
        provider: result.provider,
        messageId: result.id || null,
        recipient,
    });
}

main().catch((error) => {
    const code = typeof error?.code === "string" && /^[A-Z0-9_-]{1,40}$/i.test(error.code) ? error.code.toUpperCase() : undefined;
    console.error("Email test failed unexpectedly.", { name: error?.name || "Error", ...(code ? { code } : {}) });
    process.exitCode = 1;
});
