const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false,
        },

        role: {
            type: String,
            enum: ["admin", "member"],
            default: "member",
        },

        phone: {
            type: String,
            default: "",
        },

        profileImage: {
            type: String,
            default: "",
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        isEmailVerified: {
            type: Boolean,
            default: false,
        },
     
        resetPasswordToken: {
            type: String,
            default: null,
        },

        resetPasswordExpires: {
            type: Date,
            default: null,
        },

        otp: {
            type: String,
            default: null,
        },

        otpExpires: {
            type: Date,
            default: null,
        },

    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);
