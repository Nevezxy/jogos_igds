// server.js
// Ponto de entrada da plataforma Jogos IGDS. Sobe o Express (arquivos
// estáticos e API) e o Socket.IO (jogos em tempo real) no mesmo servidor
// HTTP. Cada jogo se conecta pelo registro em src/games/registry.js.

const os = require('os');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const registry = require('./src/games/registry');
const { createPlatformRouter } = require('./src/platform/routes');
const offline = require('./src/platform/offline');
const { createMatchManager } = require('./src/platform/match');
const { createMarathonRealtime } = require('./src/marathon/socketHandlers');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
// /sw.js: guarda o app no navegador (escola com internet fraca)
offline.mount(app);
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

// Contas dos educandos (login por nome e sobrenome) e progresso nos jogos.
app.use('/api', createPlatformRouter(registry));

// Jogos disponíveis (painel de seleção e carregador do navegador).
app.get('/api/games', (req, res) => {
  res.json({ games: registry.publicGames() });
});

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

// Qualquer rota de tela cai na SPA. Arquivos que não existem (ex.: um
// /games/<id>/game.js ausente) e rotas /api desconhecidas respondem 404, para
// o carregador de jogos perceber o erro em vez de receber o index.html.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  if (req.path.startsWith('/api/') || path.extname(req.path)) return res.status(404).send('Não encontrado.');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 20000,
});

for (const game of registry.games) {
  if (game.server && typeof game.server.registerSockets === 'function') game.server.registerSockets(io);
}
// 👫 partidas pela rede dos jogos de tabuleiro (código de sala e pareamento)
const matchManager = createMatchManager(registry);
matchManager.register(io);
// 🏃 Modo Maratona: salas, rodadas e duelos (usa as partidas pela rede); ao
// subir, retoma as maratonas que estavam em andamento
const marathon = createMarathonRealtime(registry, { matchManager });
marathon.register(io);
app.locals.marathon = marathon.manager;

server.listen(PORT, () => {
  console.log(`🎉 Jogos IGDS rodando em http://localhost:${PORT}`);
});
