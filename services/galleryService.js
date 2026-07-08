const Gallery = require("../Models/gallery");

const createGallery = async (data) => {
    return await Gallery.create(data);
};

const getGalleries = async () => {
    return await Gallery.find().sort({ createdAt: -1 });
};

const getGalleryById = async (id) => {
    return await Gallery.findById(id);
};

const updateGallery = async (id, data) => {
    return await Gallery.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
    });
};

const deleteGallery = async (id) => {
    return await Gallery.findByIdAndDelete(id);
};

module.exports = {
    createGallery,
    getGalleries,
    getGalleryById,
    updateGallery,
    deleteGallery,
};
