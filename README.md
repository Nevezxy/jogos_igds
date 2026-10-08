# 🎮 Jogos IGDS — Plataforma de Jogos Educativos

Plataforma de jogos para a sala de aula, com cara de portal de jogos
infantil (inspirada no Poki). Cada educando tem a sua conta — o login é só
o **nome e sobrenome** — e escolhe o jogo num painel. O progresso fica
salvo no servidor, então a criança continua de onde parou em qualquer
computador da escola.

Jogos de hoje:

| Jogo | Modo | O que é |
|------|------|---------|
| ⌨️ **Teclado Mágico** | sozinho(a) | Digitação com os 10 dedos: teclado ABNT2 na tela com uma cor por dedo, mãos que mostram o dedo certo e 58 fases (letras, palavras, acentos, frases, pontuação, números e textos). |
| 🎯 **Bingo** | com a turma | Bingo em tempo real conduzido pelo professor, com ~20 crianças em celulares, tablets ou computadores, e um telão opcional para o projetor. |

A plataforma foi feita para receber **novos jogos** sem mexer no núcleo
(veja a seção 5).

Backend em **Node.js + Express + Socket.IO**, persistência em **SQLite**
(via `better-sqlite3`, sem serviço externo) e frontend em **HTML/CSS/JS
puro** (sem build step).

---

## 1. Como rodar localmente

Pré-requisito: Node.js 18 ou superior.

```bash
npm install
npm start
```

Acesse `http://localhost:3000`.

- **Educando:** digita o nome e o sobrenome. Na primeira vez, confirma que é
  uma conta nova e escolhe um bichinho; depois cai no **painel de jogos**.
- **Professor:** link **🧑‍🏫 Área do professor** abaixo do login (ou
  `/professor`). Lá estão a turma, com o progresso de cada um, e o
  **Bingo** (criar sala, QR Code, telão).

Para a turma entrar pelo celular ou tablet, todos precisam estar no mesmo
Wi-Fi; o painel do bingo mostra o QR Code e o link da rede local
(`http://SEU_IP:3000/?sala=CÓDIGO`).

> No Windows, se os aparelhos da turma não conseguirem abrir o link, marque
> a rede Wi-Fi como **Privada** (ou libere a porta 3000 no firewall).

### Variáveis de ambiente (veja `.env.example`)

| Variável | Para que serve |
|----------|----------------|
| `PORT` | Porta do servidor (padrão 3000). |
| `PROFESSOR_PIN` | PIN da área do professor. Com PIN, só quem o digitar vê a turma, cadastra contas e cria salas de bingo. Sem PIN, a área fica aberta. **Recomendado em produção.** |
| `DB_FILE` | Arquivo do banco SQLite (padrão `data/bingo.sqlite`). |

---

## 2. Como hospedar

É um servidor Node.js comum: sobe em qualquer provedor que rode Node e
permita WebSockets persistentes.

### Render / Railway / Fly.io (mais simples)
1. Crie um repositório Git com este conteúdo.
2. Build command: `npm install`
3. Start command: `npm start`
4. Defina `PROFESSOR_PIN` nas variáveis de ambiente do serviço.
5. O SQLite é criado sozinho em `data/bingo.sqlite`.
   ⚠️ Ele guarda as **contas e o progresso** dos educandos. Em planos com
   **sistema de arquivos efêmero** (ex.: alguns planos gratuitos do
   Render), o arquivo é apagado a cada deploy/reinício — anexe um *volume
   persistente* na pasta `data/` (ou aponte `DB_FILE` para ele).

### VPS própria (Ubuntu, DigitalOcean etc.) com PM2
```bash
npm install -g pm2
npm install
PROFESSOR_PIN=1234 pm2 start server.js --name jogos-igds
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
(Monte um volume em `/app/data` para não perder as contas.)

---

## 3. Funcionalidades

### Contas e painel
- Login só com **nome e sobrenome**, sem senha. A comparação ignora
  maiúsculas, acentos e espaços extras ("joao  silva" = "João Silva").
- Conta nova pede confirmação ("É a sua primeira vez?"), para um erro de
  digitação não virar uma conta duplicada. Conta que existe mostra "É
  você?" com o bichinho da criança.
- Painel com um cartão por jogo, o resumo do progresso ("Fase 7 · ⭐ 18",
  "🏆 3 bingos"), troca de bichinho e o botão **Não sou eu / Sair** (para
  computadores compartilhados).

### ⌨️ Teclado Mágico (digitação)
- Teclado ABNT2 desenhado na tela, com uma cor por dedo (mindinho rosa,
  anelar laranja, médio verde, indicador azul, polegar violeta), e as mãos
  em SVG: a próxima tecla pulsa e o dedo certo acende.
- Maiúsculas acendem também o **Shift do lado oposto**; **acentos** são
  ensinados em dois passos (aperte o acento, solte, depois a letra), com o
  aviso "acento pronto". Dica em texto para cada tecla e aviso de Caps Lock.
- **10 mundos, 58 fases:** fileira do meio → de cima → de baixo →
  maiúsculas → palavras → acentuação → frases → pontuação → números e
  símbolos → textos. As fases de letras só usam as teclas já aprendidas.
- **Estrelas:** 85% de precisão = ⭐ (libera a próxima fase), 93% = ⭐⭐,
  97% + velocidade mínima do mundo = ⭐⭐⭐. Resultado com PPM (palavras por
  minuto), precisão, tempo e as teclas que mais deram trabalho.
- Treino livre (não conta estrelas) e a opção "Esperar a tecla certa".
- Precisa de teclado físico; em tablet/celular aparece um aviso.

### 🎯 Bingo
- A criança logada só digita o código da sala (pelo QR Code, entra
  sozinha); nome e bichinho vêm da conta. "← Jogos" na sala de espera e na
  sala encerrada volta ao painel.
- Sala de espera com a turma chegando, contagem 3-2-1, bola sorteada em
  tela cheia, marcação manual com carimbo, "🔥 FALTA 1!", BINGO em tela
  cheia. Cada bingo conta no progresso da criança.
- Professor: tipos (números, palavras, emojis, personalizado), pacotes
  prontos, cartela 3×3 a 6×6, regras, sorteio por botão, barra de espaço ou
  automático, voz pt-BR, desfazer, pausar, bloquear entrada, remover
  participante, nova partida com a mesma turma.
- **Telão** (`/telao?sala=CODE`): QR gigante na espera, bola enorme,
  quadro de números, turma com 🔥/🏆 e comemoração de BINGO. O botão
  "← Voltar" (canto superior direito, discreto no projetor) fecha a aba do
  telão ou, se ela foi aberta pelo link, leva ao painel da sala.

### 🧑‍🏫 Área do professor
- Protegida pelo `PROFESSOR_PIN`. Com PIN, só o professor cria salas de bingo.
- **Turma:** bichinho, último acesso, mundo/fase atual no Teclado Mágico,
  estrelas, PPM médio, teclas com mais erro e bingos; busca por nome.
- **Renomear** (ex.: "Ana Souza 5A" para diferenciar duas crianças),
  **juntar** duas contas da mesma criança (fica o melhor progresso de cada
  fase), **liberar todas as fases**, **desativar/reativar**.
- **Cadastrar a turma** de uma vez (um nome por linha) e **ligar/desligar o
  autocadastro** (desligado, só o professor cria contas).

---

## 4. Arquitetura

```
jogos_igds/
├── server.js                 # Express (estáticos, /api, /qr.svg) + Socket.IO; liga os jogos do registro
├── src/
│   ├── platform/             # Núcleo da plataforma (vale para todos os jogos)
│   │   ├── db.js             # Conexão SQLite (DB_FILE) e tabelas do bingo
│   │   ├── accounts.js       # Contas dos educandos (login por nome e sobrenome) e sessões
│   │   ├── progress.js       # Progresso genérico por educando e jogo (game_progress, game_results)
│   │   ├── teacher.js        # Área do professor: PIN, turma, juntar contas, liberar fases, cadastro em lote
│   │   ├── settings.js       # Configurações da plataforma (ex.: autocadastro)
│   │   ├── routes.js         # /api/auth, /api/progress, /api/teacher
│   │   ├── idGenerator.js    # Códigos, IDs e tokens
│   │   └── avatars.js        # Bichinhos permitidos e filtro de nomes impróprios
│   └── games/
│       ├── registry.js       # ⭐ Lista de jogos (o painel, o carregador e as rotas leem daqui)
│       ├── digitacao/
│       │   └── server.js     # Teclado Mágico: valida resultados, estrelas, progresso e resumos
│       └── bingo/
│           ├── server.js         # Ponto de entrada do bingo para o registro
│           ├── roomManager.js    # Fonte única da verdade do estado "ao vivo" de cada sala
│           ├── socketHandlers.js # Eventos Socket.IO, sorteio automático e telão
│           ├── bingoTypes.js     # Tipos de bingo (números/palavras/emojis/custom)
│           └── winChecker.js     # Vitória e "quase lá" (falta 1), sempre no servidor
├── public/
│   ├── index.html            # Telas do núcleo (login, painel, tela de jogo, professor); os jogos trazem as suas
│   ├── css/                  # tokens, base, animações, componentes, telas e platform.css
│   ├── js/
│   │   ├── shared/           # Usados por todos os jogos: socket, mascote, bichinhos, som, efeitos, ui
│   │   └── platform/
│   │       ├── api.js        # Chamadas à API com o token do educando (window.PlataformaApi)
│   │       ├── auth.js       # Login "É você?", criação de conta e sessão (window.PlataformaAuth)
│   │       ├── games.js      # Registro e carregador de jogos sob demanda (window.Plataforma)
│   │       ├── hub.js        # Painel de jogos
│   │       ├── teacher.js    # Área do professor (window.PlataformaTeacher)
│   │       ├── router.js     # Rotas (History API)
│   │       └── app.js        # Som, cliques e navegação comuns a todas as telas
│   └── games/
│       ├── digitacao/        # ⌨️ Teclado Mágico (carregado sob demanda)
│       │   ├── game.js       # Telas: mapa, antes da fase, jogando, resultado, treino livre
│       │   ├── view.html     # HTML das telas
│       │   ├── game.css      # Teclado, mãos, texto e mapa (uma cor por dedo)
│       │   ├── layouts/abnt2.js # Teclado brasileiro: teclas, dedos e como digitar cada caractere
│       │   ├── levels.js     # Mundos e fases, estrelas e liberação (usado também pelo servidor)
│       │   ├── content.js    # Banco de palavras, frases, textos e gerador de exercícios
│       │   ├── engine.js     # Motor da rodada: acertos, precisão e PPM
│       │   ├── keyboard.js   # Teclado na tela
│       │   └── hands.js      # Mãos em SVG
│       └── bingo/            # 🎯 Bingo (carregado sob demanda, modo persistente): view.html com as telas,
│                             #    master, player, join, screen (telão), overlays, packs, session e css
├── test/                     # Ver seção 6
└── data/bingo.sqlite         # Criado automaticamente (contas, progresso e histórico do bingo)
```

### Rotas

| Rota | Tela |
|------|------|
| `/` | Login (ou o painel, se já houver alguém logado) |
| `/jogos` | Painel de jogos |
| `/jogos/<id>` | Um jogo (ex.: `/jogos/digitacao`, `/jogos/bingo?sala=CODE`) |
| `/professor` | Área do professor: turma e ferramentas dos jogos |
| `/professor/<id>` | Ferramenta de um jogo (ex.: `/professor/bingo`) |
| `/telao?sala=CODE` | Telão do bingo, sem login |

O QR Code do bingo usa o link curto `/?sala=CODE`, mais fácil de digitar;
o roteador leva para `/jogos/bingo?sala=CODE`, pedindo login antes, se for
preciso.

### API

| Rota | Para quê |
|------|----------|
| `POST /api/auth/lookup` · `login` · `register` · `logout` · `avatar`, `GET /api/auth/me` | Contas (token no cabeçalho `X-Student-Token`) |
| `GET /api/games` | Jogos do registro (painel e carregador) |
| `GET /api/progress` | Resumos de progresso para os cartões do painel |
| `GET /api/progress/<jogo>` · `POST /api/progress/<jogo>/results` | Progresso de um jogo e gravação de uma rodada (validada pelo jogo) |
| `/api/teacher/...` | Área do professor (token no cabeçalho `X-Teacher-Token`) |

### Por que essa arquitetura

- **O núcleo não conhece as regras dos jogos.** Ele sabe quem é o
  educando, quais jogos existem e como guardar progresso de forma
  genérica; cada jogo decide como validar uma rodada e como ela muda o
  progresso.
- **Tudo validado no servidor.** No bingo, nenhuma ação (marcar casa,
  sortear, declarar vitória) é decidida pelo cliente. No Teclado Mágico, o
  servidor confere a fase (existe e está liberada), a coerência entre
  caracteres, tempo e velocidade, e calcula ele mesmo as estrelas.
- **Uma fonte só para as fases.** `public/games/digitacao/levels.js` é lido
  pelo navegador (mapa e exercícios) e pelo servidor (validação e
  estrelas).
- **Jogos sob demanda e sem build step.** O painel só baixa o núcleo; os
  arquivos de um jogo chegam quando a criança entra nele. Sons
  sintetizados, mascote em SVG e QR Code gerado no servidor: funciona numa
  rede local sem internet (só as fontes do Google ficam de fora).
- **Estado ao vivo do bingo em memória + SQLite para o que precisa durar**
  (contas, progresso, histórico).

---

## 5. Como criar um novo jogo

1. **Crie a pasta do jogo** em `public/games/<id>/` com um `game.js` que se
   registra na plataforma:

   ```js
   // public/games/meu-jogo/game.js
   Plataforma.registerGame('meu-jogo', {
     async mount(container, ctx) {
       // container já tem o HTML de view.html (se houver)
       // ctx.student  → { id, name, firstName, avatar }
       // ctx.api      → ctx.api.get('/progress/meu-jogo'), ctx.api.post('/progress/meu-jogo/results', {...})
       // ctx.sound, ctx.fx, ctx.mascot, ctx.ui → som, confete, mascote, toasts/modal
       // ctx.params   → parâmetros da URL; ctx.exit() → volta ao painel
       ctx.mascot.mount(container);
     },
     unmount() {
       // remova timers e listeners de document/window
     },
   });
   ```

   Opcionais: `view.html` (HTML do jogo), `game.css` e outros scripts.
   Use `.btn`, `.speech`, `[data-mascot]` e os tokens de cor do tema para
   manter o visual.

2. **(Opcional) Crie o módulo do servidor** em `src/games/<id>/server.js`:

   | Função | Quando é usada |
   |--------|----------------|
   | `validateResult(body, progress)` | `POST /api/progress/<id>/results`: confira a rodada e devolva o resultado limpo (com `levelId`, `stars`, `score`...). Lance `GameError` de `src/platform/progress.js` para recusar. |
   | `mergeProgress(old, result)` | Como a rodada muda o JSON de progresso guardado. |
   | `summary(progress)` | Texto do cartão no painel (ou `null`). |
   | `teacherSummary(progress)` | Dados da coluna do jogo na área do professor. |
   | `mergeAccounts(a, b)` | Juntar o progresso de duas contas da mesma criança. |
   | `setUnlockedAll(progress, value)` | "Liberar todas as fases" na área do professor. |
   | `registerSockets(io)` | Jogos em tempo real (como o bingo). |

3. **Acrescente o jogo em `src/games/registry.js`:**

   ```js
   {
     id: 'meu-jogo',
     name: 'Meu Jogo',
     icon: '🧩',
     tagline: 'Uma frase curta para o cartão.',
     mode: 'solo',          // 'solo' | 'turma'
     status: 'active',      // 'active' | 'soon' (aparece "Em breve") | 'hidden'
     color: 'green',        // cor do cartão (token do tema)
     isNew: true,           // etiqueta "Novo!"
     client: { styles: ['game.css'], view: 'view.html', scripts: ['game.js'] },
     // jogo com telas próprias e que precisa continuar vivo fora do painel
     // (como o bingo): client.persistent = true e enter/leave no lugar de
     // mount/unmount; teacherTool: { icon, name, description } cria o
     // cartão dele na área do professor (/professor/meu-jogo)
     server: require('./meu-jogo/server'), // opcional
   },
   ```

4. **Reinicie o servidor.** O cartão aparece no painel e o jogo abre em
   `/jogos/meu-jogo`. Se o módulo do servidor tiver `teacherSummary`, o
   jogo ganha uma coluna na tabela da turma (com os campos do resumo; para
   um visual próprio, acrescente uma função em `GAME_CELLS` de
   `public/js/platform/teacher.js`).

---

## 6. Testes

Cada arquivo de teste sobe o próprio servidor, numa porta separada e com
um banco SQLite temporário (`test/helpers.js`): não é preciso deixar o
`npm start` ligado e nenhuma conta de teste fica no banco de verdade.

```bash
npm test
```

| Arquivo | O que testa |
|---------|-------------|
| `test/digitacao.test.js` | Teclado Mágico sem navegador: motor (precisão, PPM, acento composto e decomposto), ABNT2 (Shift do lado oposto, acentos, `?` e `;`), fases e estrelas, todo exercício digitável e só com as teclas da fase, validação do servidor. |
| `test/platform.test.js` | Contas (nome e sobrenome, maiúsculas/acentos/espaços, conta repetida, sessão, bichinho, sair) e progresso pela API (estrelas do servidor, fase bloqueada, velocidade impossível, resumos). |
| `test/teacher.test.js` | Área do professor com PIN: cadastro em lote, autocadastro, renomear, juntar contas, liberar fases, desativar, sala de bingo só pelo professor. |
| `test/integration.test.js` | Partida completa de bingo: entrada só com conta, mesma conta em dois aparelhos, sorteio, marcação, vitória, expulsão, nova partida, reconexão, encerramento. |
| `test/features.test.js` | Bingo: nome e bichinho da conta, sair da sala, casa travada, "quase lá", sorteio automático, telão sem tokens, QR Code, bingo contando no progresso. |

Teste de carga do bingo (40 crianças marcando ao mesmo tempo; mede o tempo
de cada sorteio até a última criança — em rede local, na casa de 50 ms):

```bash
npm run test:carga
```

---

## 7. Segurança e privacidade — resumo

- **Login sem senha (decisão pedagógica).** Crianças pequenas não precisam
  decorar senha. Limite conhecido: quem souber o nome de um colega
  consegue entrar na conta dele. Por isso a conta guarda só nome, bichinho
  e progresso nos jogos, o painel tem "Não sou eu / Sair" e o professor
  pode desativar contas. As sessões deixam de valer depois de 180 dias sem
  uso.
- **Área do professor com PIN** (`PROFESSOR_PIN`), comparado em tempo
  constante e com espera depois de 10 tentativas erradas seguidas. O token
  do professor dura 12 horas e só existe na memória do servidor.
- **O servidor nunca confia no cliente:** bingo validado em
  `roomManager.js` (código de sala, `masterToken`, conta do educando e
  `playerToken`, status da partida, item sorteado, uma vaga por conta);
  resultados do Teclado Mágico validados em `src/games/digitacao/server.js`.
- Bichinho só da lista permitida; filtro de cortesia contra nomes
  impróprios (`src/platform/avatars.js`); o telão recebe só a visão de
  espectador; nomes sempre inseridos na página como texto, nunca como HTML.

---

## 8. Próximos passos possíveis

- Outros layouts de teclado (US-Internacional) no Teclado Mágico.
- Minijogos de digitação (chuva de palavras) e um desafio de digitação da
  turma em tempo real, reaproveitando o Socket.IO e o telão.
- Novos jogos: tabuada, ortografia, quiz.
