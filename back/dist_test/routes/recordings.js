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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const Recording_1 = require("../models/Recording");
const User_1 = require("../models/User");
const googleDrive_1 = require("../services/googleDrive");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
router.post('/initiate', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameCode, gameTitle } = req.body;
        if (!gameCode) {
            res.status(400).json({ message: 'gameCode required' });
            return;
        }
        const user = yield User_1.User.findById(req.userId);
        if (!user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const recording = yield Recording_1.Recording.create({
            gameCode,
            gameTitle: gameTitle || '',
            gmEmail: user.email,
            expiresAt,
        });
        res.json({ recordingId: String(recording._id) });
    }
    catch (err) {
        console.error('[recordings/initiate]', err);
        res.status(500).json({ message: 'Failed to initiate recording' });
    }
}));
router.put('/upload/:id', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const recording = yield Recording_1.Recording.findById(req.params.id);
        if (!recording) {
            res.status(404).json({ message: 'Recording not found' });
            return;
        }
        // Ownership check: only the GM who initiated the recording may upload to it
        const uploader = yield User_1.User.findById(req.userId).select('email');
        if (!uploader || uploader.email !== recording.gmEmail) {
            res.status(403).json({ message: 'FORBIDDEN' });
            return;
        }
        if (recording.status === 'completed') {
            res.json({ shareLink: recording.shareLink });
            return;
        }
        const filename = `recording-${recording.gameCode}-${Date.now()}.webm`;
        const { fileId } = yield (0, googleDrive_1.uploadStreamToDrive)(req, filename);
        const shareLink = yield (0, googleDrive_1.makeFilePublic)(fileId);
        yield Recording_1.Recording.findByIdAndUpdate(req.params.id, {
            driveFileId: fileId,
            shareLink,
            status: 'completed',
        });
        const platformEmail = process.env.SENDGRID_FROM || '';
        yield Promise.allSettled([
            recording.gmEmail
                ? (0, email_1.sendRecordingEmail)(recording.gmEmail, recording.gameTitle, recording.gameCode, shareLink)
                : Promise.resolve(),
            platformEmail && platformEmail !== recording.gmEmail
                ? (0, email_1.sendRecordingEmail)(platformEmail, recording.gameTitle, recording.gameCode, shareLink)
                : Promise.resolve(),
        ]);
        res.json({ shareLink });
    }
    catch (err) {
        console.error('[recordings/upload]', err instanceof Error ? err.message : 'unknown error');
        res.status(500).json({ message: 'Upload failed' });
    }
}));
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const recording = yield Recording_1.Recording.findById(req.params.id).select('shareLink status expiresAt gameTitle gameCode');
        if (!recording) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        if (recording.expiresAt < new Date()) {
            res.status(410).json({ message: 'Expired' });
            return;
        }
        res.json({
            shareLink: recording.shareLink,
            status: recording.status,
            gameTitle: recording.gameTitle,
            gameCode: recording.gameCode,
            expiresAt: recording.expiresAt,
        });
    }
    catch (_a) {
        res.status(500).json({ message: 'Error' });
    }
}));
exports.default = router;
