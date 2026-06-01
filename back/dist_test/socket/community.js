"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommunity = void 0;
function registerCommunity(io) {
    io.on('connection', (socket) => {
        socket.on('com:join', () => socket.join('room:community'));
        socket.on('com:leave', () => socket.leave('room:community'));
    });
}
exports.registerCommunity = registerCommunity;
