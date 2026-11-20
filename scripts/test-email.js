require("dotenv").config();

const { getEmailConfig, verifyEmailTransport } = require("../Config/email");
const { sendEmail } = require("../utils/mailer");

async function main() {
    const config = getEmailConfig();
    const recipient = String(process.env.EMAIL_USER || "").trim();

    if (!config.configured) {
        console.error("Email test not run: active provider configuration is incomplete.", {
            provider: config.provider,
            reason: config.reason,
            ...(config.missing?.length ? { missing: config.missing } : {}),
        });
        process.exitCode = 1;
        return;
    }

    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) {
        console.error("Email test not run: EMAIL_USER (SMTP_USER) is invalid.");
        process.exitCode = 1;
        return;
    }

    const verification = await verifyEmailTransport();
    if (!verification.verified) {
        console.error("SMTP ERROR:", verification.reason || "SMTP verification failed.", {
            provider: verification.provider,
            ...(verification.providerCode ? { providerCode: verification.providerCode } : {}),
            ...(verification.providerStatus ? { providerStatus: verification.providerStatus } : {}),
        });
        process.exitCode = 1;
        return;
    }

    const result = await sendEmail({
        to: recipient,
        subject: "Royal HigherLife password-reset SMTP test",
        text: "This is a test of the Gmail SMTP transporter used for password-reset OTP emails. It contains no visitor data.",
        html: "<p>This is a test of the Gmail SMTP transporter used for password-reset OTP emails. It contains no visitor data.</p>",
    });

    if (result.sent) {
        console.log("SENT: test email delivered to", recipient, {
            provider: result.provider,
            messageId: result.id || null,
        });
    } else {
        console.error("SMTP ERROR:", result.reason || "test email was not accepted.", {
            provider: result.provider,
            ...(result.providerCode ? { providerCode: result.providerCode } : {}),
            ...(result.providerStatus ? { providerStatus: result.providerStatus } : {}),
        });
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error("SMTP ERROR:", error?.message || error?.name || "test-email.js failed unexpectedly.");
    process.exitCode = 1;
});
