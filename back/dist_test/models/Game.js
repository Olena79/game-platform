"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RegisteredPlayerSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    surname: { type: String, default: '' },
    registeredAt: { type: Date, default: Date.now },
}, { _id: false });
const GameSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    creatorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    creatorName: { type: String, required: true },
    minPlayers: { type: Number, required: true, min: 1, default: 2 },
    maxPlayers: { type: Number, required: true, min: 1, default: 6 },
    description: { type: String, default: '', maxlength: 500 },
    scenario: { type: String, default: '' },
    useCoins: { type: Boolean, default: false },
    coinsPerPlayer: { type: Number, default: 0 },
    useInfluence: { type: Boolean, default: false },
    influencePerPlayer: { type: Number, default: 0 },
    participationCost: { type: Number, default: 0, min: 0 },
    gmCardNumber: { type: String, default: '' }, // digits only, max 19 (16 + 3 spaces stripped on save)
    scheduledAt: { type: Date },
    coverImage: { type: String, default: '' },
    images: { type: [String], default: [] },
    defaultTimerSeconds: { type: Number, default: null },
    gameCode: { type: String, unique: true, sparse: true },
    spectatorCode: { type: String, unique: true, sparse: true },
    registeredPlayers: { type: [RegisteredPlayerSchema], default: [] },
    spectators: { type: [RegisteredPlayerSchema], default: [] },
    likesCount: { type: Number, default: 0 },
}, { timestamps: true, collection: 'our_games' });
exports.Game = mongoose_1.default.model('Game', GameSchema);
