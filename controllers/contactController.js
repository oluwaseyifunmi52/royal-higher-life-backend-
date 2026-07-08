const Contact = require("../Models/contact");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createContact = asyncHandler(async (req, res) => {
    const { firstname, lastname, name, email, phone, subject, message } = req.body;
    const fullName = name || [firstname, lastname].filter(Boolean).join(" ").trim();

    if (!fullName || !email || !phone || !message) {
        throw new ApiError(400, "Name, email, phone, and message are required");
    }

    const contact = await Contact.create({
        name: fullName,
        email,
        phone,
        subject,
        message,
    });

    return res.status(201).json(new ApiResponse(201, "Contact message sent", contact));
});

const getContacts = asyncHandler(async (req, res) => {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Contacts fetched", contacts));
});

module.exports = { createContact, getContacts };
