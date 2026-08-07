const transporter = require("../Config/email");

const CHURCH_NAME = "Royal Higher Life Ministries";
const CHURCH_PHONE = "+234 800 000 0000";
const CHURCH_EMAIL = "info@royalhigherlife.org";
const CHURCH_ADDRESS = "Lagos, Nigeria";
const WEBSITE_URL = "https://royalhigherlife.org";

function buildConfirmationHTML(name, bodyContent) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;">
      <div style="background:#0B5ED7;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">${CHURCH_NAME}</h1>
      </div>
      <div style="background:#fff;padding:30px;border-radius:0 0 8px 8px;">
        <p style="font-size:16px;color:#333;">Dear <strong>${name}</strong>,</p>
        <div style="font-size:15px;color:#444;line-height:1.7;margin:20px 0;">
          ${bodyContent}
        </div>
        <p style="font-size:15px;color:#444;">Thank you for reaching out to us. We truly appreciate your time and will get back to you as soon as possible.</p>
        <p style="font-size:15px;color:#444;">God bless you.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:25px 0;">
        <div style="font-size:13px;color:#888;text-align:center;">
          <p style="margin:4px 0;"><strong>${CHURCH_NAME}</strong></p>
          <p style="margin:4px 0;">${CHURCH_ADDRESS}</p>
          <p style="margin:4px 0;">Phone: ${CHURCH_PHONE} | Email: ${CHURCH_EMAIL}</p>
          <p style="margin:4px 0;"><a href="${WEBSITE_URL}" style="color:#0B5ED7;">${WEBSITE_URL}</a></p>
        </div>
      </div>
    </div>`;
}

async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"${CHURCH_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log("Email sent:", info.response);
        return info;
    } catch (error) {
        console.error("Email sending failed:", error.message);
        return null;
    }
}

async function sendContactConfirmation(email, name) {
    const html = buildConfirmationHTML(name, `
        <p>We have received your message and our team will review it shortly.</p>
        <p>If your matter is urgent, please don't hesitate to call us directly at ${CHURCH_PHONE}.</p>
    `);
    return sendEmail(email, `Thank You for Contacting Us - ${CHURCH_NAME}`, html);
}

async function sendPrayerConfirmation(email, name) {
    const html = buildConfirmationHTML(name, `
        <p>We have received your prayer request and want you to know that our prayer team is standing with you.</p>
        <p>Your request is being lifted up in prayer, and we believe in the power of God to work in your situation.</p>
        <p><em>"The prayer of a righteous person is powerful and effective." — James 5:16</em></p>
    `);
    return sendEmail(email, `Your Prayer Request Has Been Received - ${CHURCH_NAME}`, html);
}

async function sendDonationConfirmation(email, name, amount, currency) {
    const html = buildConfirmationHTML(name, `
        <p>We have received your generous donation of <strong>${currency} ${amount}</strong>.</p>
        <p>Your generosity helps us further God's kingdom and serve our community. A receipt for your records is included below.</p>
        <div style="background:#f0f7ff;padding:15px;border-radius:6px;margin:15px 0;">
          <p style="margin:4px 0;"><strong>Amount:</strong> ${currency} ${amount}</p>
          <p style="margin:4px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
    `);
    return sendEmail(email, `Donation Received - Thank You - ${CHURCH_NAME}`, html);
}

async function sendEventRegistrationConfirmation(email, name, eventTitle) {
    const html = buildConfirmationHTML(name, `
        <p>You are now registered for <strong>${eventTitle}</strong>.</p>
        <p>Please mark your calendar and arrive a few minutes early. We look forward to seeing you there!</p>
    `);
    return sendEmail(email, `Registration Confirmed: ${eventTitle} - ${CHURCH_NAME}`, html);
}

async function sendNewsletterConfirmation(email, firstName) {
    const name = firstName || "there";
    const html = buildConfirmationHTML(name, `
        <p>You have been subscribed to our newsletter.</p>
        <p>You will receive updates about upcoming events, sermons, and church news directly in your inbox.</p>
        <p>You can unsubscribe at any time by clicking the unsubscribe link at the bottom of any email.</p>
    `);
    return sendEmail(email, `Welcome to Our Newsletter - ${CHURCH_NAME}`, html);
}

async function sendOTPEmail(email, firstName, otp) {
    const name = firstName || "there";
    const html = buildConfirmationHTML(name, `
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;text-align:center;background:#f4f4f4;padding:20px;border-radius:8px;letter-spacing:6px;margin:20px 0;">
          ${otp}
        </div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this email, please ignore it.</p>
    `);
    return sendEmail(email, `Email Verification Code - ${CHURCH_NAME}`, html);
}

async function sendWelcomeEmail(email, firstName) {
    const html = buildConfirmationHTML(firstName, `
        <p>Your email has been successfully verified.</p>
        <p>We're excited to have you as part of the ${CHURCH_NAME} family.</p>
    `);
    return sendEmail(email, `Welcome to ${CHURCH_NAME}`, html);
}

async function sendPasswordResetOTP(email, otp) {
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
      <h2>Password Reset</h2>
      <p>Your password reset code is:</p>
      <div style="font-size:32px;font-weight:bold;text-align:center;background:#f4f4f4;padding:20px;border-radius:8px;letter-spacing:6px;">
        ${otp}
      </div>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    </div>`;
    return sendEmail(email, `Password Reset Code - ${CHURCH_NAME}`, html);
}

module.exports = {
    sendEmail,
    sendContactConfirmation,
    sendPrayerConfirmation,
    sendDonationConfirmation,
    sendEventRegistrationConfirmation,
    sendNewsletterConfirmation,
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordResetOTP,
};
