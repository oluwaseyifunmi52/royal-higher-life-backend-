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
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        password: {
            type: String,
            required: function passwordRequired() { return this.provider === "local"; },
            minlength: 8,
            select: false,
        },

        role: {
            type: String,
            enum: ["admin", "member"],
            default: "member",
        },

       phone: {
            type: String,
            required: function phoneRequired() { return this.provider === "local"; },
            unique: true,
            sparse: true,
            trim: true,
        },

        provider: {
            type: String,
            enum: ["local", "google", "facebook"],
            default: "local",
        },

        providerId: {
            type: String,
            default: undefined,
            select: false,
        },

        country: {
            type: String,
            default: "",
            trim: true,
        },

        state: {
            type: String,
            default: "",
            trim: true,
        },

        gender: {
            type: String,
            enum: ["Male", "Female", "Other", ""],
            default: "",
        },

        newsletter: {
            type: Boolean,
            default: true,
        },

        profileImage: {
           type: String,
           default: "https://ui-avatars.com/api/?background=0B5ED7&color=fff",
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
            select: false,
        },

        resetPasswordExpires: {
            type: Date,
            default: null,
            select: false,
        },

        otp: {
            type: String,
            default: null,
            select: false,
        },

        otpExpires: {
            type: Date,
            default: null,
            select: false,
        },

    },
    {
        timestamps: true,
    }
);

userSchema.index(
    { provider: 1, providerId: 1 },
    { unique: true, partialFilterExpression: { providerId: { $type: "string" } } }
);


module.exports = mongoose.model("User", userSchema);
