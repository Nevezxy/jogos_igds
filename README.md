# 🎮 Jogos IGDS — Plataforma de Jogos Educativos

Plataforma de jogos para a sala de aula, com cara de portal de jogos
infantil (inspirada no Poki). Cada educando tem a sua conta — o login é só
o **nome e sobrenome** — e escolhe o jogo num painel. O progresso fica
salvo no servidor, então a criança continua de onde parou em qualquer
computador da escola.

Jogos de hoje:

| Jogo | Modo | O que é |
|------|------|---------|
| ⌨️ **Teclado Mágico** | sozinho(a) | Digitação com os 10 dedos: teclado ABNT2 na tela com uma cor por dedo, mãos que mostram o dedo certo e 127 fases (letras, palavras, acentos, frases, pontuação, números e textos). |
| 🔤 **Letras Cadentes** | sozinho(a) | Letras, números, sílabas e palavras caem do céu e a criança digita cada uma antes que chegue ao chão. 72 fases, opção "apenas maiúsculas" e o céu ocupando a tela toda. |
| 🔢 **Conta Comigo** | sozinho(a) | Matemática: mundo das figurinhas, adição e subtração da unidade ao milhar, multiplicação e divisão até a dezena, depois números negativos, potências, raízes e expressões. 152 fases e teclado numérico na tela (funciona no tablet). |
| 🏁 **Desafio de Digitação** | com a turma | Corrida de digitação ao vivo: o professor escolhe o texto (uma fase do Teclado Mágico ou um texto dele) e o modo, a turma digita junta e o telão mostra a pista com os bichinhos e o pódio. |
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
- **10 mundos, 127 fases** (12 a 14 por mundo): fileira do meio → de cima →
  de baixo → maiúsculas → palavras → acentuação → frases → pontuação →
  números e símbolos → textos. As fases de letras só usam as teclas já
  aprendidas.
- **Mapa de fases** (o mesmo do Conta Comigo, em `js/shared/levelmap.js`):
  fase feita em verde com ✓, tentada sem estrela em laranja com ↻,
  pendente em branco tracejado, e a próxima em amarelo ("agora"). Cada mundo
  mostra quantas fases já fez, e o filtro "Todas · Pendentes · Feitas"
  esconde o resto.
- **Todas as fases liberadas:** a criança escolhe qualquer fase no mapa
  (chave `ALL_UNLOCKED` em `levels.js`; com `false`, cada fase abre quando a
  anterior tem 1 ⭐ e o professor pode liberar todas para um educando).
- **Estrelas:** 85% de precisão = ⭐, 93% = ⭐⭐,
  97% + velocidade mínima do mundo = ⭐⭐⭐. Resultado com PPM (palavras por
  minuto), precisão, tempo e as teclas que mais deram trabalho.
- No texto, o espaço aparece como **␣** (o símbolo de espaço dos teclados),
  para não se confundir com o ponto final.
- Treino livre (não conta estrelas) e as opções "Esperar a tecla certa" e
  **"Apenas maiúsculas"** (todas as letras e palavras em MAIÚSCULA, nas
  fases e no treino; a dica ensina o Shift do lado contrário e, com o Caps
  Lock ligado, avisa que não precisa segurar o Shift). As duas opções ficam
  guardadas no aparelho.
- Precisa de teclado físico; em tablet/celular aparece um aviso.

### 🔤 Letras Cadentes (digitação)
- Letras, números, sílabas e palavras caem do céu; a criança digita cada
  uma antes que chegue ao chão. **Alvo travado:** a primeira letra escolhe
  a peça mais perto do chão que começa com ela (fica amarela) e as letras
  seguintes completam aquela peça; letra errada faz a peça tremer e conta
  um erro, mas não perde a peça. Esc ou Backspace soltam o alvo.
- **6 mundos, 72 fases:** letras e números (todas as letras e todos os
  números juntos, sem separar por fileira), maiúsculas, sílabas, palavras
  simples, palavras com acento e desafio. Cada mundo tem 4 conteúdos, e cada conteúdo vem em 3 velocidades
  (🐢 devagar, 🐇 médio, 🚀 rápido: tempo de queda, intervalo e quantas
  peças ao mesmo tempo).
- **Sem game over:** a rodada vai até a última peça. Estrelas: pegar 60% =
  ⭐, 80% = ⭐⭐, 95% com até 10% de teclas erradas = ⭐⭐⭐.
- Acentos como no Teclado Mágico; maiúscula só conta nos mundos de
  maiúsculas e desafio (nos outros, o Caps Lock ligado não atrapalha).
- **🔠 Apenas maiúsculas** (opção no mapa, guardada no aparelho): tudo cai
  em MAIÚSCULA e tem que ser digitado em maiúscula; o jogo sugere ligar o
  Caps Lock.
- Durante o jogo, o céu ocupa toda a largura e a altura que sobra na tela.
- Pausa com Esc, pelo botão ⏸, ou sozinha quando a criança troca de aba
  ou a página perde o foco.
- O servidor refaz a lista de peças pela semente e confere o resultado;
  na área do professor aparecem a fase, as estrelas, quanto a criança pega
  e o que mais cai (ou mais erra).

### 🔢 Conta Comigo (matemática)
- **9 mundos, 152 fases** (12 a 37 por mundo, com etapas no mapa; toda fase
  tem pelo menos 10 contas diferentes, para não repetir conta na rodada):
  🍎 contando com figurinhas, ➕ adição e subtração juntas (unidade até 10,
  unidade até 20, dezena, centena e milhar, sem e com vai-um/empréstimo,
  número que falta), ✖️ multiplicação (tabuadas das mais fáceis às mais
  difíceis, dezena × unidade), ➗ divisão (tabuada ao contrário, dezena ÷
  unidade, com resto), 🎲 misturadas ("qual é o sinal?", contas em
  sequência), 🌡️ números negativos, 🚀 potências, 🌱 raízes (quadrada e
  cúbica) e 🧠 expressões (ordem das operações, parênteses, colchetes, a
  diferença entre −3² e (−3)²).
- **Centena e milhar só na adição e subtração:** nos outros mundos nenhum
  número da conta, nem o resultado, passa de 100 (`maxAbs` do mundo em
  `levels.js`; o gerador descarta o que passar).
- **Rodada de 10 contas.** Errou: dica que ensina o caminho (vai-um,
  empréstimo, tabuada, regra dos sinais...) e uma 2ª tentativa. Errou de
  novo: o jogo mostra a resposta e a conta volta nas próximas rodadas
  daquela fase (revisão).
- **Estrelas:** acerto de primeira vale 1 e na 2ª tentativa vale ½;
  6 = ⭐, 8 = ⭐⭐, 9 + tempo médio dentro do alvo da fase = ⭐⭐⭐. Não há
  cronômetro na tela.
- **🍎 Mundo das figurinhas** (o único com figurinhas, porque as contas
  são pequenas o bastante para contar; o tema, entre 5, é escolhido antes
  da fase): grupos que se juntam (+), figurinhas riscadas (−), cestas com
  grupos iguais (×), repartir entre crianças (÷, com e sem sobra) e, no
  fim, material dourado (barras e cubinhos) com dezenas até 60 (17 fases). Nas
  primeiras fases dá para responder escolhendo entre 3 opções, e o tempo
  não conta para a 3ª estrela.
- **Teclado numérico na tela** (e o do computador), com a tecla − nos
  mundos de negativos em diante; divisão com resto tem dois campos
  (quociente e resto). **🔊 Ler em voz alta** (voz do navegador em pt-BR).
- **O servidor refaz as contas:** o navegador manda só a semente da rodada
  e as respostas; o servidor gera as mesmas contas (mesmo `levels.js` e
  `problems.js`) e confere cada uma.
- Na área do professor: mundo e fase atual, estrelas, % de acerto de
  primeira e as contas que mais erra ("7 × 8").

### 🏁 Desafio de Digitação
- O professor cria a sala na área do professor (**Desafio de Digitação**), a
  turma entra pelo QR Code ou pelo código, com a conta (nome e bichinho
  vêm sozinhos).
- **Modos:** *corrida* (todos digitam o mesmo texto; vence quem terminar
  primeiro) e *contra o relógio* (30 s a 2 min; vence quem digitar mais
  letras certas), com a opção **turma contra o mascote** (a turma soma as
  letras para vencer o Bingolino — sem ranking individual no placar).
- **Texto:** qualquer fase do Teclado Mágico ou um texto do professor; opção
  **apenas maiúsculas**.
- A criança digita com o mesmo teclado colorido, as mãos e as dicas do
  Teclado Mágico, vê a posição ao vivo e, no fim, o resultado.
- **Telão** (`/telao/desafio?sala=CODE`): QR na espera, contagem 3-2-1, uma
  raia por criança com o bichinho andando, relógio, barras turma × mascote e
  o **pódio com três prêmios** — ⚡ mais rápido, 🎯 mais preciso e 📈 quem
  mais melhorou em relação à própria média (para não premiar só quem já
  digita bem). Opção de esconder os nomes no telão.
- **Painel de acompanhamento** (professor, durante a rodada): relógio,
  quantos estão digitando, terminaram ou parados, PPM e precisão médios,
  uma linha por criança (progresso no texto, PPM, precisão, erros e
  situação) com ordenação por posição, nome, precisão ou "quem precisa de
  ajuda", e um aviso de quem pode precisar de ajuda: parado há mais de 12 s,
  errando bastante (menos de 80% de acerto) ou que saiu da página. Os dois
  limites (5 a 120 s; 50 a 100%) mudam na própria tela e ficam guardados no
  navegador do professor (botão "↺ padrão" volta para 12 s e 80%).
- **Contra trapaça:** cada tecla é conferida no servidor pelo mesmo motor do
  Teclado Mágico, com teto de 20 teclas por segundo.
- Cada rodada conta no progresso da criança (painel e área do professor).

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
- **Turmas:** cada educando pode ter uma turma ("5A", "3º ano B"). Botões
  no alto da lista filtram por turma (com quantos tem em cada uma e "Sem
  turma"); a turma de cada um muda clicando nela, ou marcando vários e
  usando "🏫 Mudar a turma". Quem cria a conta com a turma no nome ("Ana
  Souza 5A") já entra nela; turmas escritas de outro jeito ("5a") caem na
  que já existe. Mudar a turma não mexe no progresso.
- **Cadastrar a turma** de uma vez (um nome por linha, todos na turma
  escolhida) e **ligar/desligar o autocadastro** (desligado, só o professor
  cria contas).

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
│       ├── matematica/
│       │   └── server.js     # Conta Comigo: refaz as contas pela semente, estrelas, revisão e resumos
│       ├── desafio/
│       │   ├── raceManager.js    # Salas, rodadas, teclas conferidas no servidor, pódio
│       │   ├── socketHandlers.js # Eventos "dz:" e o relógio que encerra as rodadas
│       │   └── server.js         # Progresso (corridas, vitórias, PPM) e resumos
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
│   │   │                     #    e levelmap.js (mapa de fases: feitas, tentadas, pendentes e a próxima)
│   │   │                     #    e falling.js (motor de queda dos jogos "Cadentes")
│   │   └── platform/
│   │       ├── api.js        # Chamadas à API com o token do educando (window.PlataformaApi)
│   │       ├── auth.js       # Login "É você?", criação de conta e sessão (window.PlataformaAuth)
│   │       ├── games.js      # Registro e carregador de jogos sob demanda (window.Plataforma)
│   │       ├── hub.js        # Painel de jogos
│   │       ├── teacher.js    # Área do professor (window.PlataformaTeacher)
│   │       ├── router.js     # Rotas (History API)
│   │       └── app.js        # Som, cliques e navegação comuns a todas as telas
│   └── games/
│       ├── letras/           # 🔤 Letras Cadentes (usa o banco de palavras do Teclado Mágico)
│       │   ├── levels.js     # Mundos, conteúdos × velocidades e estrelas (também no servidor)
│       │   ├── items.js      # O que cai em cada fase, com semente (também no servidor)
│       │   └── game.js, view.html, game.css
│       ├── matematica/       # 🔢 Conta Comigo (carregado sob demanda)
│       │   ├── levels.js     # Mundos e fases (usado também pelo servidor)
│       │   ├── problems.js   # Gerador com semente, conferência, dicas, textos e voz (também no servidor)
│       │   ├── emoji.js      # Figurinhas e material dourado
│       │   ├── game.js       # Telas: mapa, antes da fase, jogando (teclado numérico), resultado
│       │   └── view.html, game.css
│       ├── desafio/          # 🏁 Desafio de digitação (persistente; usa teclado, mãos e motor do Teclado Mágico)
│       │   ├── view.html     # Telas: entrar, espera, corrida, resultado, painel do professor e telão
│       │   ├── common.js     # Relógio acertado com o servidor, pódio, ranking, contagem 3-2-1
│       │   ├── player.js     # Criança · master.js: professor · screen.js: telão · session.js: liga na plataforma
│       │   └── desafio.css
│       ├── digitacao/        # ⌨️ Teclado Mágico (carregado sob demanda)
│       │   ├── game.js       # Telas: mapa, antes da fase, jogando, resultado, treino livre
│       │   ├── view.html     # HTML das telas
│       │   ├── game.css      # Teclado, mãos, texto e mapa (uma cor por dedo)
│       │   ├── layouts/abnt2.js # Teclado brasileiro: teclas, dedos e como digitar cada caractere
│       │   ├── levels.js     # Mundos e fases, estrelas e liberação (usado também pelo servidor)
│       │   ├── content.js    # Banco de palavras, frases, textos e gerador de exercícios
│       │   ├── engine.js     # Motor da rodada: acertos, precisão e PPM
│       │   ├── keyboard.js   # Teclado na tela
│       │   ├── hint.js       # Dica da próxima tecla (usada também pelo desafio)
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
| `/telao/<id>?sala=CODE` | Telão de outro jogo (ex.: `/telao/desafio`), sem login |

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
| `test/cadentes.test.js` | Letras Cadentes: peças certas em todas as fases (só as teclas da fase, sem acento onde não pode, tudo digitável no ABNT2), mesma semente = mesmas peças, servidor recusando resultado impossível, estrelas, progresso, painel por assunto e área do professor. |
| `test/matematica.test.js` | Conta Comigo: regras do gerador em todas as fases (vai-um/empréstimo onde deve, divisão exata, negativos só nos mundos certos, "qual é o sinal?" com uma resposta só), mesma semente = mesmas contas, servidor conferindo respostas, estrelas, revisão e área do professor. |
| `test/platform.test.js` | Contas (nome e sobrenome, maiúsculas/acentos/espaços, conta repetida, sessão, bichinho, sair) e progresso pela API (estrelas do servidor, fase bloqueada, velocidade impossível, resumos). |
| `test/teacher.test.js` | Área do professor com PIN: cadastro em lote, autocadastro, renomear, juntar contas, liberar fases, desativar, sala de bingo só pelo professor. |
| `test/desafio.test.js` | Desafio de digitação: sala com PIN, mesmo texto para todos, teclas conferidas no servidor, teto de velocidade, fim automático, pódio, relógio contra o mascote, progresso, telão sem tokens. |
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
- Minijogos de digitação (chuva de palavras).
- Novos jogos: tabuada, ortografia, quiz.
