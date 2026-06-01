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
const livekit_server_sdk_1 = require("livekit-server-sdk");
const authMiddleware_1 = require("../middleware/authMiddleware");
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    throw new Error('FATAL: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set.');
}
const router = (0, express_1.Router)();
router.post('/token', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { roomName, participantName } = req.body;
        if (!roomName || !participantName) {
            res.status(400).json({ message: 'Missing roomName or participantName' });
            return;
        }
        const at = new livekit_server_sdk_1.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: String(req.userId), name: participantName });
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });
        const token = yield at.toJwt();
        res.json({ token, url: LIVEKIT_URL });
    }
    catch (_a) {
        res.status(500).json({ message: 'Token generation failed' });
    }
}));
router.post('/observer-token', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { roomName } = req.body;
        if (!roomName) {
            res.status(400).json({ message: 'Missing roomName' });
            return;
        }
        const at = new livekit_server_sdk_1.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: `observer-${req.userId}`, name: 'Observer' });
        at.addGrant({ room: roomName, roomJoin: true, canPublish: false, canSubscribe: true });
        const token = yield at.toJwt();
        res.json({ token, url: LIVEKIT_URL });
    }
    catch (_b) {
        res.status(500).json({ message: 'Token generation failed' });
    }
}));
exports.default = router;
