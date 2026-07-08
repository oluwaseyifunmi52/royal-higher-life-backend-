const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "uploads/");
    },

    filename(req, file, cb) {
        cb(
            null,
            `${Date.now()}${path.extname(file.originalname)}`
        );
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = /jpg|jpeg|png|gif|webp/;

    const isValid =
        allowed.test(path.extname(file.originalname).toLowerCase()) &&
        allowed.test(file.mimetype);

    if (isValid) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed."));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

module.exports = upload;
