import mongoose from "mongoose";


const calendarSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true
        },

        startDate: {
            type: Date,
            required: true
        },

        endDate: {
            type: Date,
            required: true
        },

        location: {
            type: String,
            default: ""
        },

        eventType: {
            type: String,
            enum: [
                "service",
                "meeting",
                "conference",
                "prayer",
                "other"
            ],
            default: "other"
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        isPublic: {
            type: Boolean,
            default: true
        }

    },
    {
        timestamps: true
    });


export default mongoose.model(
    "Calendar",
    calendarSchema
);