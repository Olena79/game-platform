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
const https_1 = __importDefault(require("https"));
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const authMiddleware_1 = require("../middleware/authMiddleware");
const email_1 = require("../services/email");
function getUserInfoFromAccessToken(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.googleapis.com',
            path: '/oauth2/v3/userinfo',
            headers: { Authorization: `Bearer ${accessToken}` },
        };
        https_1.default.get(options, res => {
            let data = '';
            res.on('data', (chunk) => { data += chunk.toString(); });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error('Invalid Google token'));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                }
                catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}
const router = (0, express_1.Router)();
// JWT_SECRET is validated at startup inside authMiddleware.ts — safe to assert here
const signToken = (id) => jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
// POST /api/auth/register
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, surname, email, password } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ message: 'All fields are required' });
            return;
        }
        const emailExists = yield User_1.User.findOne({ email });
        if (emailExists) {
            res.status(400).json({ message: 'EMAIL_EXISTS' });
            return;
        }
        const hashed = yield bcryptjs_1.default.hash(password, 10);
        const user = yield User_1.User.create({ name, surname: surname || '', email, password: hashed });
        const token = signToken(String(user._id));
        (0, email_1.sendWelcomeEmail)(email, name).catch(err => { var _a; return console.error('Welcome email error:', ((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.body) || err.message); });
        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, surname: user.surname, email: user.email },
        });
    }
    catch (err) {
        console.error('[register]', err);
        if ((err === null || err === void 0 ? void 0 : err.code) === 11000) {
            res.status(400).json({ message: 'EMAIL_EXISTS' });
        }
        else {
            res.status(500).json({ message: 'Server error' });
        }
    }
}));
// POST /api/auth/login
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: 'Email and password are required' });
            return;
        }
        const user = yield User_1.User.findOne({ email });
        if (!user) {
            res.status(400).json({ message: 'INVALID_CREDENTIALS' });
            return;
        }
        const valid = yield bcryptjs_1.default.compare(password, user.password);
        if (!valid) {
            res.status(400).json({ message: 'INVALID_CREDENTIALS' });
            return;
        }
        const token = signToken(String(user._id));
        res.json({
            token,
            user: { id: user._id, name: user.name, surname: user.surname, email: user.email },
        });
    }
    catch (err) {
        console.error('[login]', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
// POST /api/auth/google — sign in / register via Google OAuth (access token)
router.post('/google', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            res.status(400).json({ message: 'Google access token required' });
            return;
        }
        const info = yield getUserInfoFromAccessToken(accessToken);
        let user = yield User_1.User.findOne({ $or: [{ googleId: info.sub }, { email: info.email }] });
        if (!user) {
            user = yield User_1.User.create({
                googleId: info.sub,
                name: info.given_name || ((_a = info.name) === null || _a === void 0 ? void 0 : _a.split(' ')[0]) || 'User',
                surname: info.family_name || '',
                email: info.email,
                password: '',
            });
            (0, email_1.sendWelcomeEmail)(info.email, user.name).catch(console.error);
        }
        else if (!user.googleId) {
            user.googleId = info.sub;
            yield user.save();
        }
        const token = signToken(String(user._id));
        res.json({ token, user: { id: user._id, name: user.name, surname: user.surname, email: user.email } });
    }
    catch (err) {
        console.error('[google auth]', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
// GET /api/auth/me
router.get('/me', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.User.findById(req.userId).select('-password');
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json({ id: user._id, name: user.name, surname: user.surname, email: user.email });
    }
    catch (err) {
        console.error('[me]', err);
        res.status(500).json({ message: 'Server error' });
    }
}));
exports.default = router;
