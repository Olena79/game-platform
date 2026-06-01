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
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cron = __importStar(require("node-cron"));
const db_1 = require("./config/db");
const auth_1 = __importDefault(require("./routes/auth"));
const games_1 = __importDefault(require("./routes/games"));
const livekit_1 = __importDefault(require("./routes/livekit"));
const recordings_1 = __importDefault(require("./routes/recordings"));
const upload_1 = __importDefault(require("./routes/upload"));
const gameRoom_1 = require("./socket/gameRoom");
const community_1 = require("./socket/community");
const community_2 = __importDefault(require("./routes/community"));
const Recording_1 = require("./models/Recording");
const googleDrive_1 = require("./services/googleDrive");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Use explicit equality so CORS is closed by default when NODE_ENV is unset or misspelled
const isDev = process.env.NODE_ENV === 'development';
// Trust the first proxy hop (Render, Heroku, Railway all inject X-Forwarded-For).
// Without this, express-rate-limit sees the load-balancer IP and throttles everyone.
app.set('trust proxy', 1);
// ── Auth rate limiter ──────────────────────────────────────────────────────────
// Applied only to /api/auth/login and /api/auth/register to prevent brute-force.
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window per IP
    standardHeaders: true, // return RateLimit-* headers (RFC 6585)
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again in 15 minutes.' },
});
// JWT_SECRET is validated at startup inside authMiddleware.ts (throws if missing).
// By the time this module runs, the import chain has already confirmed it is set.
const JWT_SECRET = process.env.JWT_SECRET;
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: isDev ? true : process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});
// ── Socket.IO auth middleware (runs on every handshake) ────────────────────────
// Strategy: optional token — lets unauthenticated browsers connect (needed for
// the community feed which is publicly readable), but rejects connections that
// send an explicitly invalid/expired token. Game room events enforce userId
// separately via socket.data.userId (see gameRoom.ts / gr:join).
io.use((socket, next) => {
    var _a;
    const token = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token;
    if (!token) {
        // No token — allow connection without an authenticated identity.
        // gr:join will reject if socket.data.userId is not set.
        socket.data.userId = null;
        return next();
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        socket.data.userId = decoded.id;
        next();
    }
    catch (_b) {
        // Explicitly forged or expired token → reject the handshake immediately.
        next(new Error('Authentication error'));
    }
});
app.use((0, cors_1.default)({
    origin: isDev ? true : process.env.CLIENT_URL || 'http://localhost:3000',
}));
app.use(express_1.default.json());
app.get('/', (_req, res) => res.json({ status: 'ok', message: 'Games of Senses API' }));
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', auth_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/games', games_1.default);
app.use('/api/livekit', livekit_1.default);
app.use('/api/recordings', recordings_1.default);
app.use('/api/community', (0, community_2.default)(io));
(0, gameRoom_1.registerGameRoom)(io);
(0, community_1.registerCommunity)(io);
// Delete expired recordings from Google Drive every 6 hours
cron.schedule('0 */6 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const expired = yield Recording_1.Recording.find({
            expiresAt: { $lte: new Date() },
            status: 'completed',
            driveFileId: { $ne: '' },
        });
        for (const rec of expired) {
            try {
                yield (0, googleDrive_1.deleteFile)(rec.driveFileId);
            }
            catch ( /* file may already be deleted */_a) { /* file may already be deleted */ }
            yield rec.deleteOne();
        }
        if (expired.length > 0)
            console.log(`[cron] Cleaned up ${expired.length} expired recording(s)`);
    }
    catch (err) {
        console.error('[cron] Recording cleanup error:', err);
    }
}));
const PORT = process.env.PORT || 5000;
(0, db_1.connectDB)()
    .then(() => {
    httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})
    .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
});
