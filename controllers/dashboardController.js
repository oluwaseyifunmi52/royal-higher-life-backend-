import User from "../Models/user.js";
import Event from "../Models/event.js";
import Sermon from "../Models/sermon.js";
import Ministry from "../Models/ministry.js";
import Donation from "../Models/donation.js";
import Contact from "../Models/contact.js";


export const getDashboard = async (req, res) => {

    try {

        const [
            totalMembers,
            activeMembers,
            totalEvents,
            totalSermons,
            totalMinistries,
            totalDonations,
            newMessages
        ] = await Promise.all([

            User.countDocuments({
                role: "member"
            }),

            User.countDocuments({
                role: "member",
                isActive: true
            }),

            Event.countDocuments(),

            Sermon.countDocuments(),

            Ministry.countDocuments(),

            Donation.countDocuments(),

            Contact.countDocuments({
                status: "new"
            })

        ]);


        const recentUsers = await User.find()
            .select("-password")
            .sort({
                createdAt: -1
            })
            .limit(5);



        res.status(200).json({

            success: true,

            message: "Admin dashboard data",

            admin: {

                id: req.user._id,

                name: `${req.user.firstName} ${req.user.lastName}`,

                role: req.user.role

            },


            statistics: {

                members: {

                    total: totalMembers,

                    active: activeMembers

                },


                events: totalEvents,


                sermons: totalSermons,


                ministries: totalMinistries,


                donations: totalDonations,


                newMessages

            },


            recentUsers

        });


    } catch (error) {


        res.status(500).json({

            success: false,

            message: "Dashboard failed",

            error: error.message

        });

    }

};