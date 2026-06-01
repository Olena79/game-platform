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
const mongoose_1 = require("mongoose");
const Game_1 = require("../models/Game");
const GameLike_1 = require("../models/GameLike");
const User_1 = require("../models/User");
const authMiddleware_1 = require("../middleware/authMiddleware");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
// Strip full card number from any response that goes outside the owner context.
// Returns hasGmCard (bool) and gmCardLast4 so the UI can show a "donate" button
// without ever sending the raw PAN to the client.
function publicGameView(game) {
    const obj = game.toObject();
    const card = obj.gmCardNumber;
    delete obj.gmCardNumber;
    return Object.assign(Object.assign({}, obj), { hasGmCard: !!(card && card.length === 16), gmCardLast4: card && card.length === 16 ? card.slice(-4) : '' });
}
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateUniqueCode() {
    return __awaiter(this, void 0, void 0, function* () {
        for (let attempt = 0; attempt < 20; attempt++) {
            const code = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
            const exists = yield Game_1.Game.findOne({ gameCode: code });
            if (!exists)
                return code;
        }
        throw new Error('Could not generate a unique code after 20 attempts');
    });
}
// GET /api/games/resolve/:code — resolve any code (player or spectator) to gameCode
router.get('/resolve/:code', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const code = req.params.code.toUpperCase();
        // Try player code first
        const byGameCode = yield Game_1.Game.findOne({ gameCode: code });
        if (byGameCode) {
            res.json({ gameCode: byGameCode.gameCode, isSpectator: false });
            return;
        }
        // Try spectator code
        const bySpectatorCode = yield Game_1.Game.findOne({ spectatorCode: code });
        if (bySpectatorCode) {
            res.json({ gameCode: bySpectatorCode.gameCode, isSpectator: true });
            return;
        }
        res.status(404).json({ message: 'Code not found' });
    }
    catch (_a) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// GET /api/games — публічний список з likesCount та isLiked (якщо авторизований)
router.get('/', authMiddleware_1.optionalAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const games = yield Game_1.Game.find().sort({ createdAt: -1 });
        let likedSet = new Set();
        if (req.userId) {
            const likedIds = yield GameLike_1.GameLike.find({ userId: req.userId }).distinct('gameId');
            likedSet = new Set(likedIds.map(id => String(id)));
        }
        res.json(games.map(g => {
            const obj = g.toObject();
            const card = obj.gmCardNumber;
            delete obj.gmCardNumber; // never expose full number in list
            return Object.assign(Object.assign({}, obj), { isLiked: likedSet.has(String(g._id)), hasGmCard: !!(card && card.length === 16), gmCardLast4: (card && card.length === 16) ? card.slice(-4) : '' });
        }));
    }
    catch (_b) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// GET /api/games/code/:code — get game by gameCode (public — card number stripped)
router.get('/code/:code', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const game = yield Game_1.Game.findOne({ gameCode: req.params.code });
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        res.json(publicGameView(game));
    }
    catch (_c) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// GET /api/games/:id — публічна карта гри (card number stripped)
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        res.json(publicGameView(game));
    }
    catch (_d) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// GET /api/games/:id/payment-details
// Returns the full card number for manual bank-transfer donations.
// Access rules:
//   - creator    → always (they own the card)
//   - registered player / spectator → yes (they need the number to send money)
//   - any other authenticated user  → 403
//   - unauthenticated               → 401 (authMiddleware)
router.get('/:id/payment-details', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id)
            .select('gmCardNumber participationCost creatorId registeredPlayers spectators');
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        const uid = String(req.userId);
        const isCreator = String(game.creatorId) === uid;
        const isRegistered = game.registeredPlayers.some(p => String(p.userId) === uid);
        const isSpectator = game.spectators.some(p => String(p.userId) === uid);
        if (!isCreator && !isRegistered && !isSpectator) {
            res.status(403).json({ message: 'FORBIDDEN' });
            return;
        }
        const card = game.gmCardNumber || '';
        const hasCard = card.length === 16;
        res.json({
            gmCardNumber: card, // full PAN — only reaches authorised participants
            gmCardFormatted: hasCard ? card.replace(/(\d{4})(?=\d)/g, '$1 ') : '', // "1234 5678 9012 3456"
            hasGmCard: hasCard,
            participationCost: game.participationCost || 0,
        });
    }
    catch (_e) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// GET /api/games/:id/edit — перевірка прав + дані для редагування
router.get('/:id/edit', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        if (String(game.creatorId) !== String(req.userId)) {
            res.status(403).json({ message: 'FORBIDDEN' });
            return;
        }
        res.json(game);
    }
    catch (_f) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// POST /api/games — створити гру
router.post('/', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.User.findById(req.userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const { title, description, minPlayers, maxPlayers, scenario, useCoins, coinsPerPlayer, useInfluence, influencePerPlayer, scheduledAt, coverImage, images, participationCost, gmCardNumber, defaultTimerSeconds, } = req.body;
        if (!title || !String(title).trim()) {
            res.status(400).json({ message: 'Title is required' });
            return;
        }
        // Sanitize card number: keep digits only, must be exactly 16
        const rawCard = String(gmCardNumber || '').replace(/\D/g, '');
        const storedCard = rawCard.length === 16 ? rawCard : '';
        const gameCode = yield generateUniqueCode();
        const spectatorCode = yield generateUniqueCode();
        const game = yield Game_1.Game.create({
            title: String(title).trim(),
            creatorId: req.userId,
            creatorName: [user.name, user.surname].filter(Boolean).join(' '),
            gameCode,
            spectatorCode,
            minPlayers: Number(minPlayers) || 2,
            maxPlayers: Number(maxPlayers) || 6,
            description: String(description || '').slice(0, 500),
            scenario: scenario || '',
            useCoins: !!useCoins,
            coinsPerPlayer: useCoins ? (Number(coinsPerPlayer) || 0) : 0,
            useInfluence: !!useInfluence,
            influencePerPlayer: useInfluence ? (Number(influencePerPlayer) || 0) : 0,
            participationCost: Math.max(0, Number(participationCost) || 0),
            gmCardNumber: storedCard,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            coverImage: coverImage || '',
            images: Array.isArray(images) ? images.slice(0, 10) : [],
            defaultTimerSeconds: Number(defaultTimerSeconds) > 0 ? Number(defaultTimerSeconds) : null,
        });
        // Never return the raw card in the HTTP response — client uses /card endpoint when needed
        res.status(201).json(publicGameView(game));
    }
    catch (_g) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// PUT /api/games/:id — оновити гру (тільки автор)
router.put('/:id', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        if (String(game.creatorId) !== String(req.userId)) {
            res.status(403).json({ message: 'FORBIDDEN' });
            return;
        }
        const { title, description, minPlayers, maxPlayers, scenario, useCoins, coinsPerPlayer, useInfluence, influencePerPlayer, scheduledAt, coverImage, images, participationCost, gmCardNumber, defaultTimerSeconds, } = req.body;
        if (title !== undefined)
            game.title = String(title).trim();
        if (description !== undefined)
            game.description = String(description).slice(0, 500);
        if (minPlayers !== undefined)
            game.minPlayers = Number(minPlayers);
        if (maxPlayers !== undefined)
            game.maxPlayers = Number(maxPlayers);
        if (scenario !== undefined)
            game.scenario = scenario;
        if (useCoins !== undefined) {
            game.useCoins = !!useCoins;
            game.coinsPerPlayer = game.useCoins ? (Number(coinsPerPlayer) || 0) : 0;
        }
        if (useInfluence !== undefined) {
            game.useInfluence = !!useInfluence;
            game.influencePerPlayer = game.useInfluence ? (Number(influencePerPlayer) || 0) : 0;
        }
        if (participationCost !== undefined) {
            game.participationCost = Math.max(0, Number(participationCost) || 0);
        }
        if (gmCardNumber !== undefined) {
            const rawCard = String(gmCardNumber).replace(/\D/g, '');
            game.gmCardNumber = rawCard.length === 16 ? rawCard : '';
        }
        if (scheduledAt !== undefined) {
            game.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined;
        }
        if (coverImage !== undefined)
            game.coverImage = coverImage;
        if (images !== undefined)
            game.images = Array.isArray(images) ? images.slice(0, 10) : [];
        if (defaultTimerSeconds !== undefined) {
            game.defaultTimerSeconds = Number(defaultTimerSeconds) > 0 ? Number(defaultTimerSeconds) : null;
        }
        yield game.save();
        // Never return the raw card in the HTTP response — client uses /card endpoint when needed
        res.json(publicGameView(game));
    }
    catch (_h) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// DELETE /api/games/:id — видалити гру (тільки автор)
router.delete('/:id', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        if (String(game.creatorId) !== String(req.userId)) {
            res.status(403).json({ message: 'FORBIDDEN' });
            return;
        }
        yield Game_1.Game.deleteOne({ _id: game._id });
        res.json({ ok: true });
    }
    catch (_j) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// POST /api/games/:id/register — зареєструватися на гру
router.post('/:id/register', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const user = yield User_1.User.findById(req.userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        if (String(game.creatorId) === String(req.userId)) {
            res.status(400).json({ message: 'CREATOR_CANNOT_REGISTER' });
            return;
        }
        const alreadyRegistered = game.registeredPlayers.some(p => String(p.userId) === String(req.userId));
        if (alreadyRegistered) {
            res.status(400).json({ message: 'ALREADY_REGISTERED' });
            return;
        }
        if (game.registeredPlayers.length >= game.maxPlayers) {
            res.status(400).json({ message: 'MAX_PLAYERS_REACHED' });
            return;
        }
        game.registeredPlayers.push({
            userId: user._id,
            name: user.name,
            surname: user.surname || '',
            registeredAt: new Date(),
        });
        yield game.save();
        // Надіслати лист гравцю (не блокуємо відповідь)
        const playerFullName = [user.name, user.surname].filter(Boolean).join(' ');
        (0, email_1.sendRegistrationEmail)(user.email, playerFullName, {
            title: game.title,
            creatorName: game.creatorName,
            minPlayers: game.minPlayers,
            maxPlayers: game.maxPlayers,
            description: game.description || '',
            useCoins: game.useCoins,
            coinsPerPlayer: game.coinsPerPlayer,
            useInfluence: game.useInfluence,
            influencePerPlayer: game.influencePerPlayer,
            scheduledAt: game.scheduledAt,
            gameCode: game.gameCode,
        }).catch(err => console.error('[email] failed to send registration email:', err));
        res.json({ gameCode: game.gameCode, registeredPlayers: game.registeredPlayers });
    }
    catch (_k) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// DELETE /api/games/:id/register — анулювати реєстрацію
router.delete('/:id/register', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        const idx = game.registeredPlayers.findIndex(p => String(p.userId) === String(req.userId));
        if (idx === -1) {
            res.status(400).json({ message: 'NOT_REGISTERED' });
            return;
        }
        game.registeredPlayers.splice(idx, 1);
        yield game.save();
        res.json({ registeredPlayers: game.registeredPlayers });
    }
    catch (_l) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// POST /api/games/:id/register-spectator — зареєструватися глядачем
router.post('/:id/register-spectator', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const user = yield User_1.User.findById(req.userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        if (String(game.creatorId) === String(req.userId)) {
            res.status(400).json({ message: 'CREATOR_CANNOT_REGISTER' });
            return;
        }
        const alreadyPlayer = game.registeredPlayers.some(p => String(p.userId) === String(req.userId));
        if (alreadyPlayer) {
            res.status(400).json({ message: 'ALREADY_REGISTERED_AS_PLAYER' });
            return;
        }
        const alreadySpectator = game.spectators.some(p => String(p.userId) === String(req.userId));
        if (alreadySpectator) {
            res.status(400).json({ message: 'ALREADY_REGISTERED' });
            return;
        }
        game.spectators.push({
            userId: user._id,
            name: user.name,
            surname: user.surname || '',
            registeredAt: new Date(),
        });
        yield game.save();
        const spectatorName = [user.name, user.surname].filter(Boolean).join(' ');
        (0, email_1.sendSpectatorRegistrationEmail)(user.email, spectatorName, {
            title: game.title,
            creatorName: game.creatorName,
            spectatorCode: game.spectatorCode,
            scheduledAt: game.scheduledAt,
        }).catch(err => console.error('[email] spectator registration email failed:', err));
        res.json({ spectators: game.spectators, spectatorCode: game.spectatorCode });
    }
    catch (_m) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// DELETE /api/games/:id/register-spectator — скасувати реєстрацію глядача
router.delete('/:id/register-spectator', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(req.params.id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        const idx = game.spectators.findIndex(p => String(p.userId) === String(req.userId));
        if (idx === -1) {
            res.status(400).json({ message: 'NOT_REGISTERED' });
            return;
        }
        game.spectators.splice(idx, 1);
        yield game.save();
        res.json({ spectators: game.spectators });
    }
    catch (_o) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// POST /api/games/:id/like — поставити лайк
router.post('/:id/like', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const game = yield Game_1.Game.findById(id);
        if (!game) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        try {
            yield GameLike_1.GameLike.create({ userId: req.userId, gameId: id });
        }
        catch (e) {
            if (e.code === 11000) {
                // Already liked — idempotent
                res.json({ likesCount: game.likesCount, isLiked: true });
                return;
            }
            throw e;
        }
        const updated = yield Game_1.Game.findByIdAndUpdate(id, { $inc: { likesCount: 1 } }, { new: true });
        res.json({ likesCount: updated.likesCount, isLiked: true });
    }
    catch (_p) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// DELETE /api/games/:id/like — прибрати лайк
router.delete('/:id/like', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _q;
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid ID' });
            return;
        }
        const result = yield GameLike_1.GameLike.deleteOne({ userId: req.userId, gameId: id });
        if (result.deletedCount === 0) {
            // Not liked — idempotent
            const game = yield Game_1.Game.findById(id);
            res.json({ likesCount: (_q = game === null || game === void 0 ? void 0 : game.likesCount) !== null && _q !== void 0 ? _q : 0, isLiked: false });
            return;
        }
        const updated = yield Game_1.Game.findByIdAndUpdate(id, [{ $set: { likesCount: { $max: [0, { $subtract: ['$likesCount', 1] }] } } }], { new: true });
        res.json({ likesCount: updated.likesCount, isLiked: false });
    }
    catch (_r) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// POST /api/games/send-notes — send GM notes by email after game ends
router.post('/send-notes', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { notes, gameTitle, gameCode } = req.body;
        if (!(notes === null || notes === void 0 ? void 0 : notes.trim())) {
            res.status(400).json({ message: 'Empty notes' });
            return;
        }
        const user = yield User_1.User.findById(req.userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        yield (0, email_1.sendNotesEmail)(user.email, `${user.name}${user.surname ? ' ' + user.surname : ''}`, gameTitle || 'Без назви', gameCode || '', notes.trim());
        res.json({ ok: true });
    }
    catch (err) {
        console.error('[send-notes]', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
exports.default = router;
