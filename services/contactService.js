const Contact = require("../Models/contact");

const createContact = async (data) => {
    return await Contact.create(data);
};

const getContacts = async () => {
    return await Contact.find().sort({ createdAt: -1 });
};

const deleteContact = async (id) => {
    return await Contact.findByIdAndDelete(id);
};

module.exports = {
    createContact,
    getContacts,
    deleteContact,
};
