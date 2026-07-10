const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
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
