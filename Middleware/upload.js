const multer = require("multer");
const path = require("path");
const crypto = require("node:crypto");
const { cloudinary } = require("../Config/cloudinary");

const fileFilter = (req, file, cb) => {
    const allowed = new Map([
        [".jpg", "image/jpeg"],
        [".jpeg", "image/jpeg"],
        [".png", "image/png"],
        [".gif", "image/gif"],
        [".webp", "image/webp"],
    ]);
    const extension = path.extname(file.originalname).toLowerCase();
    const isValid = allowed.get(extension) === file.mimetype;

    if (isValid) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed (jpg, jpeg, png, gif, webp)"));
    }
};

const hasValidImageSignature = (buffer, mimeType) => {
    if (!Buffer.isBuffer(buffer)) return false;
    if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === "image/gif") return buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
    if (mimeType === "image/webp") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    return false;
};

const mediaExtensions = new Map([
    [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"],
    [".gif", "image/gif"], [".webp", "image/webp"], [".mp4", "video/mp4"],
    [".mov", "video/quicktime"], [".webm", "video/webm"], [".mp3", "audio/mpeg"],
    [".wav", "audio/wav"], [".m4a", "audio/mp4"],
]);
const isAllowedMediaName = (originalname, mimetype) => mediaExtensions.get(path.extname(originalname || "").toLowerCase()) === mimetype;
const hasValidMediaSignature = (file) => {
    if (!file || !Buffer.isBuffer(file.buffer)) return false;
    const { buffer, mimetype } = file;
    if (mimetype.startsWith("image/")) return hasValidImageSignature(buffer, mimetype);
    if (mimetype === "video/mp4" || mimetype === "video/quicktime") return buffer.length > 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    if (mimetype === "video/webm") return buffer.length > 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (mimetype === "audio/mpeg") return buffer.length > 3 && (buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
    if (mimetype === "audio/wav") return buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
    if (mimetype === "audio/mp4") return buffer.length > 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    return false;
};

const createUploadMiddleware = (folder) => {
    const parseFile = multer({
        storage: multer.memoryStorage(),
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    });

    return {
        single(fieldName) {
            return (req, res, next) => parseFile.single(fieldName)(req, res, (parseError) => {
                if (parseError) return next(parseError);
                if (!req.file) return next();
                if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
                    return next(new Error("Only valid image file contents are allowed."));
                }

                const publicId = crypto.randomBytes(16).toString("hex");
                let settled = false;
                const finishUpload = (uploadError, result) => {
                    if (settled) return;
                    settled = true;
                    if (uploadError) return next(Object.assign(new Error("Image upload failed."), { code: "CLOUDINARY_UPLOAD_FAILED" }));
                    req.file.path = result.secure_url;
                    req.file.filename = result.public_id;
                    req.file.size = result.bytes;
                    delete req.file.buffer;
                    return next();
                };
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder, public_id: publicId, resource_type: "image" },
                    finishUpload
                );
                uploadStream.on("error", (error) => finishUpload(error));
                uploadStream.end(req.file.buffer);
            });
        },
    };
};

// Authenticated media library uploads use Cloudinary's image/video resource
// types; file bytes are never written to MongoDB.
const createMediaUploadMiddleware = (folder = "media") => {
    const parser = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 50 * 1024 * 1024, files: 8 },
        fileFilter(req, file, cb) {
            if (isAllowedMediaName(file.originalname, file.mimetype)) return cb(null, true);
            return cb(new Error("Choose a supported image, video, or audio file."));
        },
    });
    const uploadFiles = async (req, next) => {
        const files = Object.values(req.files || {}).flat();
        if (files.length > 8 || files.reduce((total, file) => total + file.size, 0) > 160 * 1024 * 1024) return next(new Error("Choose up to 8 media files with a combined size no greater than 160 MB."));
        for (const file of files) {
            if (!hasValidMediaSignature(file)) return next(new Error("Uploaded file contents do not match the selected media type."));
        }
        try {
            for (const file of files) await new Promise((resolve, reject) => {
                const resourceType = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "video";
                const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (error, result) => {
                    if (error || !result?.secure_url) return reject(error || new Error("Cloudinary returned no media URL"));
                    file.path = result.secure_url;
                    file.filename = result.public_id;
                    file.size = result.bytes;
                    file.resourceType = resourceType;
                    delete file.buffer;
                    resolve();
                });
                stream.on("error", reject);
                stream.end(file.buffer);
            });
            return next();
        } catch (error) {
            return next(Object.assign(new Error("Media upload failed. Check Cloudinary configuration and try again."), { code: "CLOUDINARY_UPLOAD_FAILED" }));
        }
    };
    return {
        fields(fields) {
            return (req, res, next) => parser.fields(fields)(req, res, (error) => error ? next(error) : uploadFiles(req, next));
        },
    };
};

module.exports = {
    createUploadMiddleware,
    createMediaUploadMiddleware,
    isAllowedMediaName,
    hasValidMediaSignature,
    fileFilter,
    hasValidImageSignature,
};
