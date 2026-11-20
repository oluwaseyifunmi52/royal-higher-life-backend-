const { cloudinary } = require("../Config/cloudinary");

const uploadImage = async (filePath, folder) => {
    const result = await cloudinary.uploader.upload(filePath, {
        folder,
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
    };
};

const deleteImage = async (publicId) => {
    return await cloudinary.uploader.destroy(publicId);
};

const deleteMedia = async (publicId, resourceType = "image") =>
    cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

module.exports = {
    uploadImage,
    deleteImage,
    deleteMedia,
};
