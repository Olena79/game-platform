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
exports.deleteFile = exports.makeFilePublic = exports.uploadStreamToDrive = void 0;
const googleapis_1 = require("googleapis");
function getDrive() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
    }
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new googleapis_1.google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    return googleapis_1.google.drive({ version: 'v3', auth });
}
function uploadStreamToDrive(stream, filename) {
    return __awaiter(this, void 0, void 0, function* () {
        const drive = getDrive();
        const requestBody = { name: filename };
        if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
            requestBody.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
        }
        const res = yield drive.files.create({
            requestBody,
            media: { mimeType: 'video/webm', body: stream },
            fields: 'id',
        });
        return { fileId: res.data.id };
    });
}
exports.uploadStreamToDrive = uploadStreamToDrive;
function makeFilePublic(fileId) {
    return __awaiter(this, void 0, void 0, function* () {
        const drive = getDrive();
        yield drive.permissions.create({
            fileId,
            requestBody: { role: 'reader', type: 'anyone' },
        });
        return `https://drive.google.com/file/d/${fileId}/view`;
    });
}
exports.makeFilePublic = makeFilePublic;
function deleteFile(fileId) {
    return __awaiter(this, void 0, void 0, function* () {
        const drive = getDrive();
        yield drive.files.delete({ fileId });
    });
}
exports.deleteFile = deleteFile;
