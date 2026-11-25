const Donation = require("../Models/donation");

const createDonation = async (data) => {
    return await Donation.create(data);
};

const getDonations = async () => {
    return await Donation.find().sort({ createdAt: -1 });
};

const updateDonation = async (id, data) => {
    return await Donation.findByIdAndUpdate(id, data, {
        returnDocument: 'after',
        runValidators: true,
    });
};

module.exports = {
    createDonation,
    getDonations,
    updateDonation,
};
