"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const authMiddleware_1 = require("../middleware/authMiddleware");
// Configure once at module load. Undefined values will cause uploads to
// fail gracefully at request time (503) rather than crashing the server on start.
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
function isCloudinaryConfigured() {
    return !!(process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET);
}
// Accept images only, max 10 MB, buffered in memory (no temp files on disk)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only image files are allowed'));
    },
});
const router = (0, express_1.Router)();
// POST /api/upload
// Requires auth. Accepts multipart/form-data with field "file".
// Returns { url: string } — the secure Cloudinary URL.
router.post('/', authMiddleware_1.authMiddleware, upload.single('file'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isCloudinaryConfigured()) {
        res.status(503).json({ message: 'Image upload service is not configured on this server.' });
        return;
    }
    if (!req.file) {
        res.status(400).json({ message: 'No file provided' });
        return;
    }
    try {
        const result = yield new Promise((resolve, reject) => {
            const stream = cloudinary_1.v2.uploader.upload_stream({ folder: 'mindflow', resource_type: 'image' }, (error, result) => {
                if (error || !result)
                    reject(error !== null && error !== void 0 ? error : new Error('Cloudinary upload failed'));
                else
                    resolve(result);
            });
            stream.end(req.file.buffer);
        });
        res.json({ url: result.secure_url });
    }
    catch (err) {
        console.error('[upload]', err instanceof Error ? err.message : 'unknown');
        res.status(500).json({ message: 'Upload failed' });
    }
}));
exports.default = router;
