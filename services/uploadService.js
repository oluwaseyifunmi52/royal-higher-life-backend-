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

module.exports = {
    uploadImage,
    deleteImage,
};
