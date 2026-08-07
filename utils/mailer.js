const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT === "465",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error("❌ SMTP Error:", error);
    } else {
        console.log("✅ SMTP Server is ready");
    }
});

async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"Royal Higher Life Church" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });

        console.log("✅ Email sent:", info.response);

        return info;
    } catch (error) {
        console.error("❌ Email sending failed:", error);
        throw error;
    }
}



async function sendOTPEmail(email, firstName, otp) {
    return sendEmail(
        email,
        "Email Verification Code",
        `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
            <h2 style="color:#0B5ED7;">Verify Your Email</h2>

            <p>Hello <strong>${firstName}</strong>,</p>

            <p>Your verification code is:</p>

            <div style="
                font-size:32px;
                font-weight:bold;
                text-align:center;
                background:#f4f4f4;
                padding:20px;
                border-radius:8px;
                letter-spacing:6px;">
                ${otp}
            </div>

            <p>This code expires in <strong>10 minutes</strong>.</p>

            <p>If you didn't request this email, please ignore it.</p>

            <hr>

            <small>Royal Higher Life Church</small>
        </div>
        `
    );
}

/**
 * Welcome Email
 */
async function sendWelcomeEmail(email, firstName) {
    return sendEmail(
        email,
        "Welcome to Royal Higher Life Church",
        `
        <div style="font-family:Arial,sans-serif;padding:20px;">
            <h2>Welcome ${firstName}! 🎉</h2>

            <p>Your email has been successfully verified.</p>

            <p>We're excited to have you as part of the Royal Higher Life Church family.</p>

            <p>God bless you.</p>
        </div>
        `
    );
}

/**
 * Password Reset OTP
 */
async function sendPasswordResetOTP(email, otp) {
    return sendEmail(
        email,
        "Password Reset Code",
        `
        <div style="font-family:Arial,sans-serif;padding:20px;">
            <h2>Password Reset</h2>

            <p>Your password reset code is:</p>

            <div style="
                font-size:32px;
                font-weight:bold;
                text-align:center;
                background:#f4f4f4;
                padding:20px;
                border-radius:8px;
                letter-spacing:6px;">
                ${otp}
            </div>

            <p>This code expires in <strong>10 minutes</strong>.</p>

            <p>If you didn't request a password reset, please ignore this email.</p>
        </div>
        `
    );
}

module.exports = {
    sendEmail,
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordResetOTP,
};