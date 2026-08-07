const transporter = require("../Config/email");

const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const info = await transporter.sendMail({
            from: `"Royal Higher Life Ministries" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text,
        });
        return info;
    } catch (error) {
        console.error("Email Error:", error.message);
        return null;
    }
};

module.exports = { sendEmail };
