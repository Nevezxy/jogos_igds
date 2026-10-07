// server.js
// Ponto de entrada. Sobe o Express (arquivos estáticos do frontend) e o
// Socket.IO (toda a comunicação em tempo real) no mesmo servidor HTTP.

const os = require('os');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
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

// Endereços pelos quais os aparelhos da turma alcançam este servidor na rede
// local (o professor costuma abrir em "localhost", que não serve para os
// alunos). IPs de rede doméstica/escolar aparecem primeiro.
function lanAddresses() {
  const isPrivate = (ip) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  const ips = Object.values(os.networkInterfaces())
    .flat()
    // 169.254.x é endereço automático do sistema quando não há rede: não serve aos alunos
    .filter((i) => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
    .map((i) => i.address);
  return [...ips.filter(isPrivate), ...ips.filter((ip) => !isPrivate(ip))];
}

app.get('/api/join-info', (req, res) => {
  res.json({ port: PORT, urls: lanAddresses().map((ip) => `http://${ip}:${PORT}`) });
});

// QR Code em SVG para a turma entrar apontando a câmera.
app.get('/qr.svg', async (req, res) => {
  const data = String(req.query.data || '').slice(0, 300);
  if (!data) return res.status(400).send('Parâmetro "data" obrigatório.');
  try {
    const svg = await QRCode.toString(data, { type: 'svg', margin: 1, color: { dark: '#1E1240', light: '#FFFFFF' } });
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
  } catch (e) {
    res.status(500).send('Não foi possível gerar o QR Code.');
  }
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
