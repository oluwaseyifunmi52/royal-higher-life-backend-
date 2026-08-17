const multer = require("multer");
const path = require("path");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../Config/cloudinary");

const fileFilter = (req, file, cb) => {
    const allowed = /jpg|jpeg|png|gif|webp/;

    const isValid =
        allowed.test(path.extname(file.originalname).toLowerCase()) &&
        allowed.test(file.mimetype);

    if (isValid) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed (jpg, jpeg, png, gif, webp)"));
    }
};

const createCloudinaryStorage = (folder) => {
    return new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            const extension = path.extname(file.originalname).toLowerCase().substring(1);
            return {
                folder,
                public_id: `${uniqueSuffix}.${extension}`,
                format: extension,
                resource_type: "image",
            };
        },
    });
};

const createUploadMiddleware = (folder) => {
    const storage = createCloudinaryStorage(folder);
    return multer({
        storage,
        fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    });
};

module.exports = {
    createUploadMiddleware,
    fileFilter,
};
