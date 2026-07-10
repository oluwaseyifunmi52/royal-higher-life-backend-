import Calendar from "../Models/calendar.js";


// Get all calendar events
export const getCalendarEvents = async (req, res) => {

    try {

        const events = await Calendar.find()
            .sort({
                startDate: 1
            });


        res.status(200).json({
            success: true,
            events
        });


    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};



// Create calendar event (Admin)
export const createCalendarEvent = async (req, res) => {

    try {

        const event = await Calendar.create({

            ...req.body,

            createdBy: req.user._id

        });


        res.status(201).json({

            success: true,

            message: "Calendar event created",

            event

        });


    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};