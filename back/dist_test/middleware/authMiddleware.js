"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Fail fast at startup — never fall back to a weak secret in any environment
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start safely.');
}
const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }
    const token = header.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    }
    catch (_a) {
        // Covers TokenExpiredError, JsonWebTokenError, NotBeforeError
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};
exports.authMiddleware = authMiddleware;
// Like authMiddleware but never blocks — sets req.userId if token is valid, otherwise continues
const optionalAuth = (req, _res, next) => {
    const header = req.headers.authorization;
    if (header === null || header === void 0 ? void 0 : header.startsWith('Bearer ')) {
        const token = header.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.userId = decoded.id;
        }
        catch (_a) {
            // Invalid/expired token — treat as unauthenticated, continue without blocking
        }
    }
    next();
};
exports.optionalAuth = optionalAuth;
