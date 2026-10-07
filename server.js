// server.js
// Ponto de entrada. Sobe o Express (arquivos estáticos do frontend) e o
// Socket.IO (toda a comunicação em tempo real) no mesmo servidor HTTP.

const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { registerSocketHandlers } = require('./src/socketHandlers');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Qualquer rota não-API cai na SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 20000,
});

registerSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`🎉 Bingo Virtual rodando em http://localhost:${PORT}`);
});
