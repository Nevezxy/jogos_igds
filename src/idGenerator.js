// src/idGenerator.js
const { nanoid, customAlphabet } = require('nanoid');

// Código de sala: curto, fácil de digitar e ler em voz alta (sem caracteres ambíguos)
const roomCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0,O,1,I
const roomCodeGen = customAlphabet(roomCodeAlphabet, 5);

function generateRoomCode() {
  return roomCodeGen();
}

function generateId(prefix = '') {
  return `${prefix}${nanoid(12)}`;
}

function generateToken() {
  return nanoid(32);
}

module.exports = { generateRoomCode, generateId, generateToken };
