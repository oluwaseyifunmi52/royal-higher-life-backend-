const Ministry = require("../Models/ministry");


// Create Ministry
const createMinistry = async (req, res) => {
    try {
        const ministry = await Ministry.create(req.body);

        res.status(201).json({
            success: true,
            message: "Ministry created successfully",
            data: ministry,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// Get All Ministries
const getMinistries = async (req, res) => {
    try {
        const ministries = await Ministry.find().sort({
            createdAt: -1,
        });

        res.status(200).json({
            success: true,
            count: ministries.length,
            data: ministries,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// Get Single Ministry
const getMinistry = async (req, res) => {
    try {
        const ministry = await Ministry.findById(req.params.id);

        if (!ministry) {
            return res.status(404).json({
                success: false,
                message: "Ministry not found",
            });
        }

        res.status(200).json({
            success: true,
            data: ministry,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// Update Ministry
const updateMinistry = async (req, res) => {
    try {
        const ministry = await Ministry.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

        if (!ministry) {
            return res.status(404).json({
                success: false,
                message: "Ministry not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Ministry updated successfully",
            data: ministry,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// Delete Ministry
const deleteMinistry = async (req, res) => {
    try {
        const ministry = await Ministry.findByIdAndDelete(req.params.id);

        if (!ministry) {
            return res.status(404).json({
                success: false,
                message: "Ministry not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Ministry deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    createMinistry,
    getMinistries,
    getMinistry,
    updateMinistry,
    deleteMinistry,
};
