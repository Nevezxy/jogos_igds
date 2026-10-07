# 🎮 Jogos IGDS — Plataforma de Jogos Educativos

Bingo em tempo real com cara de jogo (inspirado em portais de jogos infantis
como o Poki), feito para um(a) professor(a) conduzir uma partida com ~20
crianças conectadas ao mesmo tempo, cada uma em seu celular, tablet ou
computador — e um telão opcional para o projetor.

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

Acesse `http://localhost:3000` e clique em **Sou professor(a)**. O painel
mostra um QR Code e o link da rede local (`http://SEU_IP:3000/?sala=CÓDIGO`)
para a turma entrar pelo celular ou tablet — todos no mesmo Wi-Fi. Para
projetar, use **📺 Abrir telão** no painel.

> No Windows, se os aparelhos da turma não conseguirem abrir o link, marque
> a rede Wi-Fi como **Privada** (ou libere a porta 3000 no firewall).

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

Pensado para uma turma de ~20 crianças, com folga: limite de
`MAX_PLAYERS_PER_ROOM = 40` em `src/games/bingo/roomManager.js`. O teste de carga
(`npm run test:carga`) coloca 40 crianças marcando casas ao mesmo tempo e
mede quanto cada sorteio leva para chegar a todas: em rede local fica na
casa de 50 ms. Várias salas podem rodar ao mesmo tempo no mesmo servidor,
cada uma isolada pelo seu código.

---

## 4. Arquitetura

```
jogos_igds/
├── server.js                 # Express (estáticos, /api/auth, /api/games, /api/join-info, /qr.svg) + Socket.IO
├── src/
│   ├── platform/             # Núcleo da plataforma (vale para todos os jogos)
│   │   ├── db.js             # Persistência SQLite
│   │   ├── accounts.js       # Contas dos educandos (login por nome e sobrenome) e sessões
│   │   ├── routes.js         # Rotas HTTP do núcleo (/api/auth/...)
│   │   ├── idGenerator.js    # Códigos, IDs e tokens
│   │   └── avatars.js        # Bichinhos permitidos e filtro de nomes impróprios
│   └── games/
│       ├── registry.js       # Lista de jogos da plataforma (o painel e o carregador leem daqui)
│       └── bingo/
│           ├── server.js         # Ponto de entrada do bingo para o registro
│           ├── roomManager.js    # Fonte única da verdade do estado "ao vivo" de cada sala
│           ├── socketHandlers.js # Eventos Socket.IO, sorteio automático e telão
│           ├── bingoTypes.js     # Estratégias por tipo de bingo (números/palavras/emojis/custom)
│           └── winChecker.js     # Vitória e "quase lá" (falta 1), sempre no servidor
├── public/
│   ├── index.html            # Telas (login, painel de jogos, tela de jogo, entrar, criar, espera, cartela, professor, telão)
│   ├── css/
│   │   ├── tokens.css        # Cores, raios, sombras e fontes
│   │   ├── base.css          # Reset, fundo animado, tipografia
│   │   ├── animations.css    # Todos os @keyframes (+ prefers-reduced-motion)
│   │   ├── components.css    # Botões 3D, cartões, campos, toasts, modal, mascote
│   │   ├── screens.css       # Home, cartela e painel do professor (base)
│   │   └── platform.css      # Login, painel de jogos (cartões) e tela genérica de jogo
│   ├── js/
│   │   ├── shared/           # Usados por todos os jogos
│   │   │   ├── socket-client.js # Conexão Socket.IO + wrapper em Promise
│   │   │   ├── mascot.js     # Bingolino, o mascote em SVG, e suas expressões
│   │   │   ├── avatars.js    # Lista de bichinhos (igual à do servidor)
│   │   │   ├── sound.js      # Sons sintetizados (Web Audio) e voz pt-BR
│   │   │   ├── fx.js         # Confete, estrelinhas e tremida
│   │   │   └── ui.js         # Telas, toasts, modal, ajuste de texto, quadro de números, links
│   │   └── platform/
│   │       ├── api.js        # Chamadas à API com o token do educando (window.PlataformaApi)
│   │       ├── auth.js       # Login "É você?", criação de conta e sessão (window.PlataformaAuth)
│   │       ├── games.js      # Registro e carregador de jogos sob demanda (window.Plataforma)
│   │       ├── hub.js        # Painel de jogos: cartões do registro, trocar bichinho, sair
│   │       ├── router.js     # Rotas: /, /jogos, /jogos/<id>, /professor (History API)
│   │       └── app.js        # Som, cliques e navegação comuns a todas as telas
│   └── games/
│       └── bingo/
│           ├── play.css      # Entrada em 3 passos, espera, jogo e camadas de tela cheia
│           ├── master.css    # Configuração visual, quadro de números e telão
│           ├── packs.js      # Pacotes prontos de palavras, emojis e itens
│           ├── overlays.js   # Contagem 3-2-1, bola em tela cheia e comemoração de BINGO
│           ├── master.js     # Painel do professor
│           ├── player.js     # Sala de espera e tela de jogo da criança
│           ├── join.js       # Entrada da criança em 3 passos
│           ├── screen.js     # Modo telão (/telao?sala=CODE)
│           └── session.js    # Sessão da sala, reconexão automática e criação de sala
├── test/
│   ├── platform.test.js      # Contas e API da plataforma (sobe um servidor próprio, banco temporário)
│   ├── integration.test.js   # Fluxo completo de uma partida
│   ├── features.test.js      # Avatar, filtro de nome, quase lá, sorteio automático, telão, QR
│   └── load.test.js          # Turma inteira jogando ao mesmo tempo
└── data/bingo.sqlite         # Criado automaticamente na primeira execução
```

> A plataforma está em transformação: veja `PLANO_PLATAFORMA.md`. Por
> enquanto o bingo ainda é carregado direto pelo `index.html` e cuida das
> próprias telas (`enter`/`leave`); os próximos jogos usam o carregador sob
> demanda (`mount`/`unmount`, em `public/js/platform/games.js`).

### Rotas

| Rota | Tela |
|------|------|
| `/` | Login (ou o painel, se já houver alguém logado) |
| `/jogos` | Painel de jogos |
| `/jogos/<id>` | Um jogo (ex.: `/jogos/bingo?sala=CODE`) |
| `/professor` | Área do professor (hoje: criar/retomar sala de bingo) |
| `/telao?sala=CODE` | Telão do bingo, sem login |

O QR Code e o link da sala continuam no formato curto `/?sala=CODE`, mais
fácil de digitar; o roteador leva para `/jogos/bingo?sala=CODE`, pedindo o
login antes, se for preciso.

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
- **Sem build step e sem internet na sala**: sons sintetizados no
  navegador, mascote em SVG, QR Code gerado no servidor — tudo funciona
  numa rede local sem acesso à internet (só as fontes do Google ficam de
  fora nesse caso, com fonte do sistema no lugar).
- **Reconexão por token**: cada criança recebe um `playerToken` (e o
  professor um `masterToken`) guardados no `localStorage` do navegador. Se
  a página recarregar ou a conexão cair, o cliente reconecta sozinho e
  recupera cartela, marcações, histórico, bichinho e papel.

---

## 5. Como uma partida acontece

```
Professor cria a sala → painel mostra QR Code e link da rede local
        │                (opcional: 📺 Abrir telão no projetor)
        ▼
Crianças apontam a câmera (ou digitam o código) → nome → bichinho
        │
        ▼
Sala de espera: a turma vai aparecendo, balões para estourar
        │
        ▼
Professor escolhe tipo, pacotes, tamanho, regras e sorteio automático → Iniciar
        │
        ▼
Contagem 3-2-1 → cada criança recebe a sua cartela
        │
        ▼
Sorteio (botão, barra de espaço ou automático) → bola rola na tela de todos,
a voz anuncia no computador do professor
        │
        ▼
A criança PROCURA o item na cartela e toca para marcar (nada é marcado sozinho)
        │
        ▼
Falta 1 → "🔥 FALTA 1!" para a criança, 🔥 no painel e no telão
        │
        ▼
Servidor valida o BINGO → comemoração em tela cheia → 🎉 Nova partida
```

---

## 6. Funcionalidades

**Para a criança**
- Visual de jogo (fundo animado, botões de brinquedo, mascote Bingolino
  com expressões) e textos em linguagem infantil.
- Entrada em 3 passos: código em caixinhas (conferido na hora), nome e
  escolha de bichinho. O link do QR Code já traz o código.
- Sala de espera com a turma chegando, fala do mascote e balões.
- Contagem 3-2-1, bola sorteada em tela cheia e últimas bolas sempre à vista.
- Marcação manual: a criança procura e toca; carimbo com som e estrelinhas.
  Toque em item que não saiu só treme a casa. Casa marcada fica travada.
- "🔥 FALTA 1 PARA O BINGO!" com tambor e borda nas casas da linha.
- BINGO em tela cheia, linha vencedora dourada e troféu no cabeçalho.
- Pausa com o mascote dormindo; botão 🔊/🔇 em todas as telas.

**Para o professor**
- QR Code e link da rede local (com escolha da rede, se houver mais de uma).
- Configuração em cartões: tipo (números, palavras, emojis, personalizado),
  pacotes prontos (301 palavras, 240 emojis, 214 itens), tamanho 3×3 a
  6×6, casa livre, regras (linha, coluna, diagonal, cartela cheia) e
  sorteio automático (8 a 30 s).
- Sorteio por botão, barra de espaço ou automático, com voz pt-BR.
- Quadro com todos os itens acendendo; desfazer último sorteio.
- Participantes com bichinho, barra de progresso, 🔥 quase lá e 🏆.
- Nova partida com a mesma turma, mudar regras, pausar/retomar, bloquear
  entrada, remover participante, encerrar sala.
- **Telão** (`/telao?sala=CODE`): QR gigante na espera, bola enorme,
  quadro de números, turma com 🔥/🏆 e comemoração de BINGO.

### Testes

Com o servidor ligado (`npm start`), em outro terminal:

```bash
npm test
```

Roda `test/platform.test.js` (contas: nome e sobrenome obrigatórios,
login sem diferenciar maiúsculas, acentos e espaços, conta repetida,
sessão, troca de bichinho e saída; ele sobe o próprio servidor na porta
3101 com um banco temporário), `test/integration.test.js` (criação de sala, entrada, nomes
duplicados, autenticação do professor, sorteio, marcação manual, vitória,
pausa automática, expulsão, nova partida, reinício, reconexão e
encerramento) e `test/features.test.js` (avatar, filtro de nomes, casa
travada, "quase lá", sorteio automático, telão sem tokens, QR Code e
endereços de rede). Para o teste de carga com 40 crianças:

```bash
npm run test:carga
```

### Próximos passos possíveis
- Múltiplas cartelas por jogador na mesma partida.
- Painel de estatísticas históricas consultando o SQLite já persistido.
- Internacionalização (hoje 100% em português).

---

## 7. Segurança e validação — resumo

**Contas dos educandos.** O login é só o nome e o sobrenome, sem senha
(decisão pedagógica: crianças pequenas não precisam decorar senha). A
comparação ignora maiúsculas, acentos e espaços extras. Antes de criar uma
conta nova, a criança confirma que é a primeira vez, para um erro de
digitação não virar uma conta duplicada. Limite conhecido: quem souber o
nome de um colega consegue entrar na conta dele; por isso o início tem o
botão "Não sou eu / Sair", e a conta guarda só nome, bichinho e progresso
nos jogos. As sessões ficam em `student_sessions` e deixam de valer depois
de 180 dias sem uso.

O servidor nunca confia no cliente. Toda ação passa por `src/games/bingo/roomManager.js`,
que valida: código de sala, autenticação do Mestre (`masterToken`),
identidade do educando (`playerToken`), status da partida compatível com
a ação (ex.: não é possível marcar casa com a partida pausada), item
realmente sorteado antes de aceitar marcação, limites de participantes,
nomes duplicados e sala bloqueada/encerrada.

Além disso: o avatar só é aceito se estiver na lista de bichinhos, nomes
impróprios comuns são recusados (filtro de cortesia em `src/platform/avatars.js`),
o telão recebe só a visão de espectador (sem tokens nem cartelas), cada
criança recebe apenas a parte pública da configuração e nomes de jogadores
são sempre inseridos na página como texto, nunca como HTML.
