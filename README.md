# 🎯 Bingo Virtual — Sistema de Bingo para Sala de Aula

Sistema web completo de Bingo Virtual em tempo real, feito para um educador
(**Mestre da Sala**) conduzir uma partida com ~20 educandos conectados
simultaneamente, cada um em seu próprio computador/tablet/celular.

Backend em **Node.js + Express + Socket.IO**, persistência em **SQLite**
(via `better-sqlite3`, sem serviço externo) e frontend em **HTML/CSS/JS
puro** (sem build step) — fácil de rodar em qualquer host que suporte
Node.js e WebSockets.

---

## 1. Como rodar localmente

Pré-requisito: Node.js 18 ou superior.

```bash
cd bingo-virtual
npm install
npm start
```

Acesse `http://localhost:3000`. Abra em outra aba (ou peça para um colega
na mesma rede acessar `http://SEU_IP:3000`) para simular um segundo
participante.

A porta pode ser alterada com a variável de ambiente `PORT` (veja
`.env.example`).

---

## 2. Como hospedar fora do Claude

Este projeto é um servidor Node.js comum — sobe em qualquer provedor que
rode Node + permita WebSockets persistentes. Sugestões prontas:

### Render / Railway / Fly.io (mais simples)
1. Crie um repositório Git com este conteúdo (ou faça upload direto, se o
   provedor aceitar).
2. Build command: `npm install`
3. Start command: `npm start`
4. Não é necessário configurar banco de dados externo — o SQLite é criado
   automaticamente em `data/bingo.sqlite` na primeira execução.
   ⚠️ Em plataformas com **sistema de arquivos efêmero** (ex: alguns
   planos free do Render), o arquivo SQLite é apagado a cada deploy/restart
   — isso não afeta o funcionamento do jogo (o estado "ao vivo" da
   partida fica em memória), só o histórico persistido para estatísticas
   futuras. Se precisar manter esse histórico entre deploys, anexe um
   *volume persistente* apontando para a pasta `data/`.

### VPS próprio (Ubuntu, DigitalOcean, etc.) com PM2
```bash
npm install -g pm2
cd bingo-virtual
npm install
pm2 start server.js --name bingo-virtual
pm2 save
```
Coloque um Nginx (ou Caddy) na frente como proxy reverso para HTTPS e
encaminhamento de WebSocket:

```nginx
location / {
  proxy_pass http://localhost:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

### Docker (opcional)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 3. Capacidade

Dimensionado para ~20 participantes simultâneos por sala (limite técnico
configurado em `MAX_PLAYERS_PER_ROOM = 40` em `src/roomManager.js`, com
folga). Múltiplas salas podem rodar ao mesmo tempo no mesmo servidor —
cada uma é isolada por código único.

---

## 4. Arquitetura

```
bingo-virtual/
├── server.js                 # Sobe Express (estáticos) + Socket.IO no mesmo HTTP server
├── src/
│   ├── roomManager.js        # Fonte única da verdade do estado "ao vivo" de cada sala
│   ├── socketHandlers.js     # Registra os eventos Socket.IO (mestre e educando)
│   ├── bingoTypes.js         # Estratégias por tipo de bingo (números/palavras/emojis/custom)
│   ├── winChecker.js         # Validação server-side das condições de vitória
│   ├── idGenerator.js        # Código de sala, IDs e tokens de sessão
│   └── db.js                 # Persistência SQLite (salas, jogadores, sorteios, vitórias)
├── public/
│   ├── index.html            # Todas as "telas" (home, entrar, criar, espera, jogo, mestre)
│   ├── css/style.css         # Design system (tokens, componentes, responsivo)
│   └── js/
│       ├── socket-client.js  # Conexão Socket.IO + wrapper em Promise
│       ├── ui.js              # Toasts, modal de confirmação, troca de telas
│       ├── app.js             # Sessão do usuário, reconexão automática, roteamento
│       ├── master.js          # Painel do Mestre (config, sorteio, controles, participantes)
│       └── player.js          # Tela do educando (cartela, histórico, banners)
├── test/integration.test.js  # Teste ponta a ponta via socket.io-client (ver seção 6)
└── data/bingo.sqlite         # Criado automaticamente na primeira execução
```

### Por que essa arquitetura

- **Estado ao vivo em memória (`roomManager.js`) + persistência em SQLite**:
  a partida precisa de baixíssima latência (sorteios, marcações), então o
  estado "quente" fica em um `Map` em memória. O SQLite grava eventos
  (sorteios, vitórias, snapshots de sala/jogador) para auditoria e para
  permitir, no futuro, estatísticas e reaproveitamento de configurações —
  sem no entanto ser o caminho crítico de latência.
- **Tudo validado no servidor**: nenhuma ação de jogo (marcar casa,
  sortear, declarar vitória, expulsar) é decidida pelo cliente. O cliente
  só *pede*; o servidor decide e distribui o novo estado via broadcast.
- **Tipos de bingo como estratégias plugáveis** (`bingoTypes.js`): cada
  tipo só precisa implementar uma função `(config) => string[]` que gera o
  "pool" de itens possíveis. Adicionar um novo tipo no futuro (ex.: bingo
  de imagens) não exige tocar no resto do sistema.
- **Reconexão por token**: cada educando recebe um `playerToken` (e o
  Mestre um `masterToken`) guardados no `localStorage` do navegador. Se a
  página recarregar ou a conexão cair, o cliente reconecta automaticamente
  e recupera cartela, marcações, histórico e papel (Mestre/educando).

---

## 5. Fluxo principal

```
Educador cria sala → recebe código
        │
        ▼
Educandos entram com o código → tela de espera (atualiza sozinha)
        │
        ▼
Educador configura (tipo de bingo, tamanho da cartela, regras de vitória)
        │
        ▼
Educador inicia partida → cartelas distribuídas automaticamente
        │
        ▼
Educador sorteia → todos recebem o resultado em tempo real
        │
        ▼
Cartelas marcam automaticamente o item sorteado / educando confirma o clique
        │
        ▼
Servidor valida Bingo → vencedor anunciado para todos
```

---

## 6. Funcionalidades implementadas

- Criar sala / entrar em sala com código, nome único por sala, sala
  bloqueável para novos participantes, limite de participantes.
- Painel do Mestre: configurar tamanho da cartela (3×3 a 6×6), casa livre,
  tipo de bingo (números, palavras, emojis, personalizado), regras de
  vitória habilitáveis (linha, coluna, diagonal, cartela completa),
  pausar/retomar/reiniciar/encerrar, gerar novas cartelas (via reiniciar),
  desfazer último sorteio, expulsar participante, bloquear/liberar sala.
- Sorteio com animação, histórico completo, impossibilidade de repetir
  item já sorteado, auto-marcação nas cartelas, pausa automática opcional
  ao detectar vitória (configurável).
- Validação 100% server-side de marcação de casas e de vitória (linha,
  coluna, diagonal, cartela completa).
- Reconexão automática (recupera cartela, marcações, histórico e status).
- Interface responsiva (mobile/tablet/desktop) com identidade visual
  própria (tema "quadro-negro de recreio": azul-ardósia + giz-amarelo +
  menta), animações leves e feedback visual claro.

### Testado (ver `test/integration.test.js`)
Criação de sala, entrada de múltiplos jogadores, código inválido, nome
duplicado, autenticação forjada do Mestre rejeitada, início de partida,
bloqueio de marcação de item não sorteado, sorteio até vitória por
cartela completa, pausa automática, expulsão (e bloqueio de ações do
expulso), reinício de partida, reconexão por token, encerramento de sala
e bloqueio de entrada após encerramento.

Para rodar o teste automatizado (com o servidor já rodando em outra aba):
```bash
npm install --no-save socket.io-client
node test/integration.test.js
```

### Não implementado nesta primeira versão (próximos passos sugeridos)
- Múltiplas cartelas por jogador na mesma partida.
- Painel de estatísticas históricas consultando o SQLite já persistido.
- Internacionalização (hoje 100% em português).
- Testes automatizados de carga com 20 conexões simultâneas reais (o
  teste incluído cobre a lógica de ponta a ponta, não performance sob
  carga).

---

## 7. Segurança e validação — resumo

O servidor nunca confia no cliente. Toda ação passa por `roomManager.js`,
que valida: código de sala, autenticação do Mestre (`masterToken`),
identidade do educando (`playerToken`), status da partida compatível com
a ação (ex.: não é possível marcar casa com a partida pausada), item
realmente sorteado antes de aceitar marcação, limites de participantes,
nomes duplicados e sala bloqueada/encerrada.
