"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Recording = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const schema = new mongoose_1.default.Schema({
    gameCode: { type: String, required: true },
    gameTitle: { type: String, default: '' },
    gmEmail: { type: String, required: true },
    driveFileId: { type: String, default: '' },
    shareLink: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
exports.Recording = mongoose_1.default.model('Recording', schema);
