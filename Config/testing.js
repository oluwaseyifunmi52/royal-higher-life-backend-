import transporter from "./config/email.js";

await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: "recipient@example.com",
    subject: "Royal HigherLife Ministry Contact Form Submission - A New Message Has Been Received and Requires Your Attention",
    text: "Hello from Royal Higher Life!",
});