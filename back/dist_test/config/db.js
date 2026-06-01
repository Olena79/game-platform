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
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI is not defined in .env');
    }
    mongoose_1.default.connection.on('connected', () => console.log('[db] MongoDB connected'));
    mongoose_1.default.connection.on('disconnected', () => console.log('[db] MongoDB disconnected — will retry'));
    mongoose_1.default.connection.on('error', (err) => console.error('[db] MongoDB error:', err.message));
    yield mongoose_1.default.connect(uri, {
        serverSelectionTimeoutMS: 10000, // fail fast on DNS / network issues
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000, // detect drops quickly
    });
    // Drop stale phone_1 unique index left from an old schema version
    try {
        yield mongoose_1.default.connection.collection('users').dropIndex('phone_1');
        console.log('[db] Dropped legacy phone_1 index');
    }
    catch (_a) {
        // Index already gone — nothing to do
    }
});
exports.connectDB = connectDB;
