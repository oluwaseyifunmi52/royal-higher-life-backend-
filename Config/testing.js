const transporter = require("./email");

transporter
    .sendMail({
        from: process.env.EMAIL_USER,
        to: "recipient@example.com",
        subject: "Royal HigherLife Ministry Contact Form Submission - A New Message Has Been Received and Requires Your Attention",
        text: "Hello from Royal HigherLife!",
    })
    .then(() => console.log("Test email sent"))
    .catch((error) => console.error("Test email failed:", error));
