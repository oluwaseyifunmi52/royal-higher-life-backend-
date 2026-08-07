const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        phone: { type: String, required: true, trim: true },
        subject: { type: String, trim: true, default: "General Inquiry" },
        message: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
