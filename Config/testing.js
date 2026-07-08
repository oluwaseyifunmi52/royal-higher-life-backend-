import transporter from "./config/email.js";

await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: "recipient@example.com",
    subject: "Test Email",
    text: "Hello from Royal Higher Life!",
});