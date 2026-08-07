const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send Email
 */
const sendEmail = async ({
    to,
    subject,
    html,
    text,
}) => {
    try {
        const info = await transporter.sendMail({
            from: `"Royal Higher Life Church" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text,
        });

        return info;
    } catch (error) {
        console.error("Email Error:", error);
        throw error;
    }
};

module.exports = {
    sendEmail,
};
