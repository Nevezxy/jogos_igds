# 🌻 Plano — De "Bingo Virtual" para Plataforma de Jogos Educativos

> **Situação:** plano aprovado. Etapas **A** a **G** concluídas (reorganização, contas, painel, bingo integrado, Teclado Mágico e área do professor); próxima: **H (polimento e documentação)**.
> **Decisões já tomadas** (marcadas com **[DECIDIDO]** no texto): a criança
> cria a própria conta com confirmação; o login ignora maiúsculas, espaços
> extras e acentos; a área do professor é protegida por PIN no `.env`; a
> plataforma se chama **Jogos IGDS**.

Objetivo: transformar o projeto atual (um bingo em tempo real) numa
**plataforma** onde cada educando tem a sua conta, escolhe um jogo num
painel e tem o seu progresso salvo. O bingo vira o primeiro jogo da
plataforma, e entra um segundo jogo novo: **Teclado Mágico**, para praticar
digitação. A estrutura precisa permitir adicionar outros jogos depois sem
mexer no núcleo.

A base técnica continua a mesma: Node + Express + Socket.IO + SQLite
(`better-sqlite3`) e HTML/CSS/JS puro, **sem build step**. Também continua
funcionando numa rede local sem internet.

---

## 1. Diagnóstico do projeto atual

### O que reaproveitar sem mudar
- **Visual e identidade** (`tokens.css`, `components.css`, fundo animado,
  botões de brinquedo, mascote Bingolino, `sound.js`, `fx.js`). A
  plataforma inteira usa o mesmo visual "Poki".
- **Utilitários** de `ui.js` (telas, toasts, modal, `escapeHtml`).
- **Servidor como fonte da verdade** e **reconexão por token**: os dois
  padrões passam a valer também para as contas.
- **SQLite** já configurado (`src/db.js`), com WAL ligado.
- **Testes por socket** (`test/*.test.js`): continuam valendo para o bingo.

### O que impede a plataforma hoje
| # | Problema | Onde |
|---|----------|------|
| P1 | Não existe conta: o nome é digitado a cada sala e fica só naquela sala | `join.js` passo 2, `roomManager.joinRoom` |
| P2 | Tudo assume que só existe o bingo: tela inicial, `app.js` (sessão = sala), títulos e meta tags | `index.html`, `app.js` |
| P3 | Todos os scripts carregam de uma vez e se registram em `window.BingoX`, então um novo jogo aumentaria a página para todo mundo | `index.html` linhas 454–467 |
| P4 | O código do bingo está misturado com o código geral em `src/` e `public/js/` | estrutura de pastas |
| P5 | Não há lugar para guardar progresso de um educando entre aulas | `db.js` só tem tabelas do bingo |
| P6 | O "professor" não tem identidade: qualquer pessoa cria uma sala | `screen-create` |

---

## 2. Visão geral da nova arquitetura

```
             ┌────────────────────── NÚCLEO DA PLATAFORMA ──────────────────────┐
 Navegador   │  Login (nome + sobrenome) → Painel de jogos → carrega o jogo     │
             │  Sessão do educando · Roteador · Carregador de jogos · SDK (ctx) │
             └───────────────┬──────────────────────────────┬───────────────────┘
                             │                              │
                ┌────────────▼───────────┐     ┌────────────▼────────────┐
                │  Jogo: Bingo           │     │  Jogo: Teclado Mágico    │   ← jogos futuros
                │  multiplayer (sala)    │     │  solo, progresso salvo   │     entram aqui
                └────────────┬───────────┘     └────────────┬────────────┘
                             │ Socket.IO                    │ HTTP (REST)
             ┌───────────────▼──────────────────────────────▼───────────────────┐
 Servidor    │  /api/auth · /api/games · /api/progress   +   Socket.IO (bingo)  │
             │  Contas · Sessões · Registro de jogos · Progresso genérico       │
             └───────────────────────────────┬──────────────────────────────────┘
                                             ▼
                                   SQLite (data/bingo.sqlite)
```

Princípios:
1. **O núcleo não conhece as regras de nenhum jogo.** Ele só sabe quem é
   o educando, quais jogos existem e como guardar resultados e progresso
   de forma genérica.
2. **Cada jogo é uma pasta** no servidor (`src/games/<id>/`) e outra no
   cliente (`public/games/<id>/`), mais uma entrada no registro. Para
   adicionar um jogo, cria-se uma pasta e uma entrada no registro.
3. **Os jogos carregam sob demanda.** O painel baixa os arquivos de um
   jogo só quando a criança entra nele.
4. **Os jogos usam um SDK (`ctx`)** que o núcleo entrega: dados do
   educando, salvar resultado, ler e gravar progresso, som, efeitos,
   mascote, toasts e voltar ao painel.

---

## 3. Contas dos educandos

### 3.1 Regras do login
- O login é **só o nome e o sobrenome**, sem senha.
- A comparação **não diferencia maiúsculas de minúsculas** e também ignora
  espaços extras: `"  maria   SILVA "` é a mesma conta que `"Maria Silva"`.
- **[DECIDIDO] Acentos:** a comparação **também ignora
  acentos** (`"Joao Silva"` = `"João Silva"`). Muitas crianças esquecem o
  acento ao digitar, e sem isso criariam uma segunda conta sem perceber. O
  nome continua **exibido** com acento, do jeito que foi cadastrado.
- São exigidas **pelo menos 2 palavras** (nome e sobrenome), com 2 a 40
  caracteres no total, só letras, espaço, hífen e apóstrofo. O filtro de
  nomes impróprios que já existe (`src/platform/avatars.js`) é reaproveitado.
- Chave interna: `name_key = minúsculas(sem acentos(colapsar espaços(nome)))`,
  com índice `UNIQUE` no banco. É ela que garante uma conta por nome.

### 3.2 Como a conta é criada — [DECIDIDO]
**A própria criança cria a conta, com uma confirmação.**
1. A criança digita o nome → `POST /api/auth/lookup`.
2. Se a conta existe: mostra *"É você?"* com o nome e o bichinho dela
   → **Sou eu!** entra.
3. Se a conta não existe: mostra *"Não achei ninguém com esse nome. É a
   sua primeira vez?"* → **Criar minha conta** (escolhe o bichinho) ou
   **Digitei errado** (volta).

Sem essa confirmação, um erro de digitação ("Maira Silva") criaria uma
conta nova sem a criança perceber, e o progresso dela ficaria dividido.

Alternativa: o professor cadastra a turma antes, colando uma lista de
nomes, e a criança só entra em contas que já existem. É mais seguro, mas
dá trabalho antes da primeira aula. As duas formas podem coexistir: a
área do professor teria a chave "permitir que educandos criem conta".

### 3.3 Sessão
- No login, o servidor gera um `studentToken` aleatório (o mesmo
  `generateToken` de hoje) e grava em `student_sessions`. O navegador
  guarda o token no `localStorage`.
- Ao abrir a página, `GET /api/auth/me` com o token: se for válido, a
  criança cai direto no painel.
- O painel tem o botão **"Não sou eu / Sair"**. Isso é importante porque
  computadores da escola são compartilhados.
- **Limite de segurança (vai ficar documentado):** sem senha, qualquer um
  que saiba o nome de um colega consegue entrar na conta dele. Para sala
  de aula isso é aceitável. A conta não guarda nenhum dado sensível, só o
  nome, o bichinho e o progresso nos jogos.

### 3.4 Bichinho (avatar)
É escolhido uma vez, na criação da conta, e pode ser trocado no painel.
O bingo deixa de perguntar o bichinho e usa o da conta.

---

## 4. Painel de seleção de jogos

Tela principal depois do login, no estilo Poki:

```
┌──────────────────────────────────────────────────────────────┐
│ 🌻 Jogos IGDS                        🐼 Maria Silva  [Sair]  │
│                                                              │
│  Oi, Maria! Do que vamos brincar hoje? (mascote)             │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │      ⌨️        │  │      🎯        │  │      🧩        │  │
│  │ Teclado Mágico │  │     Bingo      │  │   Em breve…    │  │
│  │ Fase 7 · ⭐ 18 │  │ 👥 com a turma │  │                │  │
│  │   [ JOGAR ]    │  │   [ ENTRAR ]   │  │                │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- Os cartões são gerados a partir de `GET /api/games` (o registro). Nada
  fica fixo no HTML.
- Cada cartão mostra ícone, nome, uma frase curta, uma etiqueta (`solo` ou
  `👥 com a turma`), uma etiqueta "Novo!" opcional e um **resumo do
  progresso**. O resumo vem do próprio jogo (`summary(progress)`); no
  Teclado Mágico, por exemplo, é "Fase 7 · ⭐ 18".
- O cartão "Em breve…" aparece só se houver jogos com `status: 'soon'`
  no registro.
- O botão do professor sai da tela inicial e vira um link discreto
  "Área do professor" no rodapé da tela de login.

### Rotas (History API; o servidor já devolve `index.html` para qualquer rota)
| Rota | Tela |
|------|------|
| `/` | Login (ou o painel, se já houver sessão) |
| `/jogos` | Painel de jogos |
| `/jogos/digitacao` | Teclado Mágico |
| `/jogos/bingo?sala=CODE` | Bingo (o QR Code passa a apontar para cá) |
| `/telao?sala=CODE` | Telão do bingo (sem login, igual a hoje) |
| `/professor` | Área do professor |

O QR Code e o link da sala **continuam no formato curto** `/?sala=CODE`
(mais fácil de digitar e um QR mais leve): o roteador redireciona para
`/jogos/bingo?sala=CODE` e pede login antes, se for preciso.

---

## 5. Contrato de um jogo (o que permite adicionar jogos no futuro)

### 5.1 Registro no servidor — `src/games/registry.js`
```js
module.exports = [
  {
    id: 'digitacao',
    name: 'Teclado Mágico',
    icon: '⌨️',
    tagline: 'Aprenda a digitar com todos os dedos!',
    mode: 'solo',              // 'solo' | 'turma'
    status: 'active',          // 'active' | 'soon' | 'hidden'
    color: 'sky',              // cor do cartão (token do tema)
    requiresKeyboard: true,    // mostra um aviso em celular/tablet
    client: { styles: ['game.css'], view: 'view.html', scripts: ['game.js'] },
    server: require('./digitacao/server'),  // opcional: valida resultados
  },
  { id: 'bingo', name: 'Bingo', icon: '🎯', mode: 'turma', ...,
    server: require('./bingo/server') },   // registra os eventos de socket
];
```
O `server` de cada jogo pode exportar:
- `registerSockets(io)`: para jogos em tempo real (o bingo).
- `routes(router)`: rotas HTTP próprias, montadas em `/api/games/<id>/`.
- `validateResult(result)`: confere um resultado antes de gravar (ex.: a
  fase existe, a precisão está entre 0 e 100, a duração é plausível).
- `mergeProgress(old, result)`: como um resultado novo atualiza o
  progresso guardado (ex.: guarda o melhor número de estrelas de cada fase).

### 5.2 Módulo no cliente — `public/games/<id>/`
```
public/games/digitacao/
  game.js       ← ponto de entrada (obrigatório)
  view.html     ← HTML do jogo (opcional; injetado no contêiner)
  game.css      ← estilos do jogo (opcional)
  ...outros arquivos que o próprio game.js carregar
```
O `game.js` se registra no núcleo:
```js
Plataforma.registerGame('digitacao', {
  async mount(container, ctx) { ... },  // monta o jogo dentro do contêiner
  unmount() { ... },                    // remove listeners e timers ao sair
});
```
O carregador (`public/js/platform/games.js`) injeta `game.css`, busca o
`view.html`, carrega o `game.js` (com `<script>` dinâmico, sem build) e
chama `mount`. Ao voltar ao painel, chama `unmount`.

### 5.3 SDK entregue ao jogo (`ctx`)
| `ctx.` | O que faz |
|--------|-----------|
| `student` | `{ id, name, firstName, avatar }` |
| `progress.get()` / `progress.save(data)` | Lê e grava o progresso deste jogo (JSON livre) |
| `results.submit(result)` | Grava o resultado de uma rodada (fase, pontos, estrelas, precisão…) |
| `sound`, `fx`, `mascot`, `ui` | Os módulos visuais e sonoros já existentes |
| `params` | Parâmetros da URL (ex.: `sala` do bingo) |
| `exit()` | Volta ao painel |

### 5.4 Tabelas genéricas (servem para qualquer jogo)
```sql
students(id TEXT PK, display_name TEXT, name_key TEXT UNIQUE, avatar TEXT,
         created_at INTEGER, last_login_at INTEGER, active INTEGER DEFAULT 1)
student_sessions(token TEXT PK, student_id TEXT, created_at INTEGER, last_seen_at INTEGER)
game_progress(student_id TEXT, game_id TEXT, data_json TEXT, updated_at INTEGER,
              PRIMARY KEY(student_id, game_id))
game_results(id INTEGER PK, student_id TEXT, game_id TEXT, level_id TEXT,
             score INTEGER, stars INTEGER, accuracy REAL, speed REAL,
             duration_ms INTEGER, details_json TEXT, created_at INTEGER)
```
`players` (bingo) ganha a coluna `student_id`, adicionada por uma migração
simples com `ALTER TABLE` só quando a coluna ainda não existe. O arquivo
`data/bingo.sqlite` continua o mesmo, então o histórico atual não se perde.

### 5.5 Receita "Como criar um novo jogo" (vai para o README)
1. Criar `public/games/<id>/game.js` com `mount`/`unmount`.
2. (Opcional) criar `src/games/<id>/server.js`.
3. Adicionar a entrada em `src/games/registry.js`.
4. Reiniciar o servidor: o cartão aparece no painel.

---

## 6. Bingo dentro da plataforma

O bingo continua funcionando **igual** para a turma e para o professor. As
mudanças são de integração:
- A entrada pula o passo do nome e o do bichinho: a criança logada só
  digita o código, ou nem isso se veio pelo QR. Então "3 passos" vira
  "1 passo".
- Um botão "← Jogos" na sala de espera e na sala encerrada, para a
  criança voltar ao painel sem depender do botão voltar do navegador.
- `join_room` passa a receber o `studentToken`. O servidor descobre o
  nome e o bichinho pela conta e liga o jogador da sala ao `student_id`.
  A checagem de nome duplicado passa a ser por `student_id`: a mesma
  criança em dois aparelhos é tratada como reconexão, não como erro.
- O telão e o painel do professor não mudam.
- Vitórias do bingo podem ser gravadas em `game_results`. Isso é opcional,
  mas deixa o histórico pronto para a área do professor.

**Reorganização de arquivos** (só move e renomeia; a lógica não muda):
| Hoje | Depois |
|------|--------|
| `src/roomManager.js`, `socketHandlers.js`, `bingoTypes.js`, `winChecker.js` | `src/games/bingo/` |
| `public/js/master.js`, `player.js`, `join.js`, `screen.js`, `overlays.js`, `packs.js` | `public/games/bingo/` |
| Seções do bingo em `index.html` | `public/games/bingo/view.html` |
| `public/css/play.css`, `master.css` | `public/games/bingo/` |
| Parte "sala" de `app.js` (sessão de sala, reconexão) | `public/games/bingo/session.js` |
| `mascot.js`, `sound.js`, `fx.js`, `ui.js`, `avatars.js` | `public/js/shared/` (usados por todos os jogos) |

Cuidado especial: hoje a reconexão do bingo roda assim que a página abre
(`tryResume` em `app.js`). Na plataforma, ela roda ao **montar** o jogo
bingo. Se a criança recarregar a página dentro de `/jogos/bingo`, o
roteador monta o bingo de novo e ela volta para a cartela. Os testes
`npm test` precisam continuar passando sem alterações na lógica do jogo.

---

## 7. Novo jogo: ⌨️ Teclado Mágico (digitação)

### 7.1 A tela
```
┌──────────────────────────────────────────────────────────────────┐
│ ← Mundos   Mundo 1 · Fase 3: "D e K"     ⏱ 0:42  🎯 97%  ⚡ 12 PPM │
│                                                                  │
│            f j f j d k d k  [k]  d f j k ...                     │  ← texto da fase
│            ✓✓✓✓✓✓✓✓  ↑ próxima letra (destacada)                  │
│                                                                  │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬─────┐                  │
│  │ '│ 1│ 2│ 3│ 4│ 5│ 6│ 7│ 8│ 9│ 0│ -│ =│  ⌫  │                  │
│  ├──┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬────┤  ← teclado ABNT2│
│  │ ↹ │ Q│ W│ E│ R│ T│ Y│ U│ I│ O│ P│ ´│ [│    │    colorido por  │
│  ├───┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┬─┴┐ ↵ │    dedo; tecla  │
│  │ ⇪  │ A│ S│ D│ F̲│ G│ H│ J̲│ [K]│ L│ Ç│ ~│ ]│   │    da vez pulsa │
│  ├───┬┴─┬┴─┬┴─┬┴─┬┴─┬┴─┬┴─┬┴─┬┴─┬┴─┬┴─┬┴──┴───┤                  │
│  │ ⇧ │ \│ Z│ X│ C│ V│ B│ N│ M│ ,│ .│ ;│ /│  ⇧  │                  │
│  └───┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴─────┘                  │
│        ✋ mão esquerda            mão direita 🤚                   │
│              (o dedo que deve apertar a tecla acende)            │
└──────────────────────────────────────────────────────────────────┘
```
- **Teclado na tela** no layout **ABNT2** (o padrão no Brasil, com `Ç`,
  as teclas de acento `´` `~` e `/?` ao lado do Shift direito). O
  desenho fica num arquivo de dados (`layouts/abnt2.js`), então dá para
  acrescentar outros layouts depois.
- **Cores por dedo:** cada tecla tem a cor do dedo responsável (mindinho,
  anelar, médio, indicador, polegar), seguindo a digitação de 10 dedos.
  `F` e `J` mostram a marquinha de relevo da posição inicial.
- **Mãos em SVG** abaixo do teclado: o dedo que deve apertar a próxima
  tecla acende com a mesma cor.
- **Próxima tecla pulsa** no teclado. Quando ela precisa de Shift (letra
  maiúscula, `!`, `?`), o **Shift do lado oposto** acende junto, e a fase
  ensina essa regra.
- **Acentos (teclas "mortas"):** para `á`, o jogo mostra a sequência em
  dois passos: primeiro `´` pulsa ("aperte o acento e solte"), depois `A`.
  Quando o acento foi digitado e aguarda a letra, aparece uma bolinha
  "acento pronto: ´".
- **Feedback de cada tecla:** acerto deixa a letra verde no texto, a tecla
  "afunda" e toca um som curto. Erro deixa a letra vermelha, a tecla
  certa treme e toca um som de "ops". Por padrão o jogo **espera a tecla
  certa** (não avança no erro); isso é melhor para crianças e pode ser
  desligado.
- **Postura e dicas:** antes de cada mundo, uma tela do mascote explica a
  posição das mãos ("indicadores no F e no J, sinta o tracinho!").

### 7.2 Como capturar as teclas (o ponto técnico mais delicado)
- Um `<textarea>` invisível, sempre com foco, recebe o que é digitado. O
  **caractere final** vem do evento `input`/`beforeinput` (`event.data`).
  É a única forma confiável de receber `á`, `ã`, `ç` montados pelo sistema
  operacional a partir das teclas mortas.
- O `keydown` (`event.code`, ex.: `KeyF`, `Quote`, `BracketLeft`) é usado
  só para **animar a tecla física** apertada e para detectar o acento
  "armado" (`event.key === 'Dead'`).
- A comparação é feita em Unicode NFC, então `á` composto e `á`
  decomposto valem igual.
- **Caps Lock ligado** mostra um aviso ("o Caps Lock está ligado!"),
  usando `getModifierState('CapsLock')`.
- **Layout diferente:** se `event.code` e o caractere recebido não
  baterem com o ABNT2 várias vezes seguidas (computador com teclado
  americano), o jogo sugere trocar o layout desenhado. Isso fica para
  depois: na primeira versão só existe o ABNT2.
- **Celular e tablet:** o jogo precisa de teclado físico. Nesses aparelhos
  aparece um aviso amigável, mas ainda dá para jogar com teclado bluetooth.

### 7.3 Níveis: mundos e fases
Cada **mundo** tem de 5 a 8 **fases**. Cada fase só usa teclas já
aprendidas. Uma fase é um arquivo de dados, com o tipo de exercício e as
teclas permitidas, então **novas fases não exigem código novo**.

| Mundo | Tema | Conteúdo (exemplos de fases) |
|-------|------|------------------------------|
| 1 🏠 | **Fileira do meio** (posição inicial) | `F J` → `D K` → `S L` → `A Ç` → `G H` → revisão da fileira toda |
| 2 ⬆️ | **Fileira de cima** | `R U` → `E I` → `W O` → `Q P` → `T Y` → revisão |
| 3 ⬇️ | **Fileira de baixo** | `V M` → `C ,` → `X .` → `Z ;` → `B N` → revisão |
| 4 🔠 | **Maiúsculas (Shift)** | Shift esquerdo + letras da direita → Shift direito + letras da esquerda → misturado |
| 5 📝 | **Palavras** | sílabas (ba, ca, la…) → palavras de 2–3 letras → 4–5 letras → palavras longas → nomes próprios com maiúscula |
| 6 ✨ | **Acentuação** | `´` agudo (á é í ó ú) → `~` til (ã õ) → `^` circunflexo (â ê ô) → `ç` em palavras → crase `à` → misturado em palavras |
| 7 💬 | **Frases** | frases curtas sem pontuação → com maiúscula no início → com acentos → frases mais longas |
| 8 ❗ | **Pontuação** | `.` e `,` → `!` e `?` → `:` e `;` → reticências `...` → aspas `"` e travessão `-` → parênteses `( )` |
| 9 🔢 | **Números e símbolos** | `1–5` → `6–0` → números em frases ("tenho 10 anos") → `@ # $ % & * + =` |
| 10 📖 | **Textos** | parágrafos curtos (fábulas e curiosidades escritas para o jogo) e desafios de velocidade |

**Geração do conteúdo:**
- **Treino de teclas:** sequências aleatórias com as teclas da fase e
  repetição maior das teclas novas (ex.: `fff jjj fj jf fjf`).
- **Palavras:** um banco de palavras em português, adequado para crianças,
  é filtrado automaticamente pelas letras já aprendidas. Já no Mundo 1 dá
  para formar palavras de verdade como "asa", "sala", "fala", "lá",
  "jaca". O banco atual (301 palavras em `packs.js`) é reaproveitado e
  ampliado.
- **Frases e textos:** listas escritas à mão, por nível, com vocabulário
  infantil. Os textos são escritos para o jogo, não copiados de livros.

### 7.4 Pontuação, estrelas e progresso
- **Métricas:** precisão (% de teclas certas na primeira tentativa),
  velocidade em **PPM** (palavras por minuto = caracteres ÷ 5 ÷ minutos) e
  tempo.
- **Estrelas** (os limites variam por mundo; velocidade só conta a partir
  do Mundo 5):
  - ⭐ precisão ≥ 85% (destrava a próxima fase)
  - ⭐⭐ precisão ≥ 93%
  - ⭐⭐⭐ precisão ≥ 97% **e** velocidade mínima da fase
- **Fim de fase:** comemoração com confete, estrelas uma a uma, PPM e
  precisão, e "teclas que mais deram trabalho". Botões: **Repetir**,
  **Próxima fase**, **Mundos**.
- **Mapa de mundos:** trilha com as fases bloqueadas, liberadas e
  concluídas, e as estrelas de cada uma (no estilo de jogo de celular).
- **Salvo no servidor** (`game_progress`): fases concluídas, melhores
  estrelas, melhor PPM e um mapa de erros por tecla. Assim a criança
  continua de onde parou em qualquer computador da escola.
- **Treino livre:** a criança escolhe o que treinar (letras, palavras,
  acentos, frases); o modo não conta para o progresso.
- O servidor valida o resultado (`validateResult`): a fase existe, os
  números estão em faixas plausíveis, e só pode concluir uma fase que já
  estava liberada. É uma validação simples, sem pretensão de ser
  antitrapaça.

### 7.5 Arquivos do jogo
```
public/games/digitacao/
  game.js        ← mount/unmount, troca de telas internas (mapa, fase, resultado)
  view.html      ← telas do jogo
  game.css       ← estilos (teclado, mãos, texto, mapa de mundos)
  keyboard.js    ← desenha o teclado a partir do layout e destaca teclas/dedos
  hands.js       ← SVG das mãos e destaque do dedo
  layouts/abnt2.js ← posições, dedos e caracteres (normal/Shift/acentos)
  engine.js      ← motor: captura das teclas, comparação, métricas
  levels.js      ← mundos e fases (dados)
  content.js     ← banco de palavras, frases e textos + gerador de exercícios
src/games/digitacao/
  server.js      ← validateResult, mergeProgress, summary e teacherSummary
                   (usa o mesmo public/games/digitacao/levels.js do navegador:
                   uma fonte só para fases, estrelas e liberação)
```

---

## 8. Área do professor

Primeira versão, simples:
- **[DECIDIDO] Proteção:** um **PIN do professor** definido em `.env`
  (`PROFESSOR_PIN`). Sem PIN configurado, a área fica aberta, como hoje.
- **Bingo:** "Criar sala de bingo" leva ao painel do professor que já
  existe, sem mudanças.
- **Turma:** lista de educandos com bichinho, último acesso e progresso no
  Teclado Mágico (mundo e fase atual, estrelas, PPM médio, teclas com mais
  erro).
- **Gerenciar contas:** renomear (corrige um erro de digitação), **juntar
  duas contas** (quando a criança criou uma conta duplicada), desativar e
  liberar todas as fases de um educando.
- Opcional: cadastro em lote (colar uma lista de nomes) e a chave
  "educandos podem criar conta".

---

## 9. Fases de implementação

Cada fase termina com o projeto funcionando, `npm test` passando e um
commit próprio.

| Fase | Entrega | Principais arquivos |
|------|---------|---------------------|
| **A. Reorganização** ✅ | Move os arquivos do bingo para `src/games/bingo/` e `public/games/bingo/`, separa `public/js/shared/`, e cria o registro de jogos (`/api/games`) e o carregador sob demanda. O bingo continua idêntico. O roteador entra na etapa C, junto com as rotas. | `server.js`, `src/games/registry.js`, `public/js/platform/games.js` |
| **B. Contas** ✅ | Tabelas, `/api/auth/lookup`, `/login`, `/register`, `/me`, `/logout`. Tela de login com confirmação "É você?", criação de conta com bichinho, sessão salva. | `src/platform/accounts.js`, `src/platform/routes.js`, `public/js/platform/auth.js` |
| **C. Painel de jogos** ✅ | Cartões a partir de `/api/games`, resumo do progresso, sair e trocar bichinho. Rotas `/jogos/...`. Nome "Bingo Virtual" trocado pelo da plataforma em títulos e meta tags. | `public/js/platform/hub.js`, `public/css/hub.css` |
| **D. Bingo integrado** ✅ | Entrada com a conta (só o código), `student_id` nos jogadores, botão "← Jogos" na espera e na sala encerrada. Os testes sobem o próprio servidor com banco temporário e entram com contas. | `src/games/bingo/*`, `public/games/bingo/*`, `test/*` |
| **E. Teclado Mágico: núcleo** ✅ | Teclado ABNT2 colorido, mãos em SVG, motor de captura (teclas mortas, Shift, Caps Lock), uma fase jogável de ponta a ponta. | `public/games/digitacao/*` |
| **F. Teclado Mágico: conteúdo e progresso** ✅ | Os 10 mundos e as fases, gerador de exercícios, banco de palavras e frases, estrelas, mapa de mundos, tela de resultado, progresso salvo e validado no servidor, treino livre. | `levels.js`, `content.js`, `src/games/digitacao/server.js` |
| **G. Área do professor** ✅ | PIN, lista da turma com progresso, renomear, juntar, desativar e liberar fases. | `public/js/platform/teacher.js`, rotas `/api/teacher/*` |
| **H. Polimento e docs** | Testes novos (contas, progresso, validação), acessibilidade (navegação por teclado, contraste, `prefers-reduced-motion`), README com a seção "Como criar um novo jogo", atualização do `.env.example`. | `test/platform.test.js`, `README.md` |

### Testes novos
- `test/platform.test.js`: login sem diferenciar maiúsculas, minúsculas e
  acentos (`"maria silva"` = `"MARIA SILVA"` = `"María Silva"`), recusa
  de nome com uma só palavra, recusa de nome impróprio, token inválido,
  sair, gravar e ler progresso, recusa de resultado de fase bloqueada,
  e `/api/games` listando os jogos.
- Os testes atuais do bingo continuam, agora logando um educando antes de
  entrar na sala.
- Teste de unidade do motor de digitação (Node, sem navegador): comparação
  NFC, cálculo de PPM e de precisão, e o gerador de exercícios respeitando
  as teclas permitidas.

---

## 10. Riscos e cuidados

| Risco | Cuidado |
|-------|---------|
| Duas crianças com o mesmo nome e sobrenome na escola | A área do professor permite renomear (ex.: "Ana Souza 5A"); a tela de criação de conta sugere acrescentar a turma ou o segundo sobrenome. |
| Uma criança entra na conta de outra (não há senha) | Botão "Não sou eu" sempre à vista; a conta só guarda progresso de jogo. Fica documentado. |
| Teclas mortas e acentos variam entre sistemas operacionais e navegadores | Captura pelo evento `input` com normalização NFC; teste manual no Windows (Chrome e Edge), que é o ambiente da escola. |
| A reorganização quebrar o bingo | Fase A só move arquivos; `npm test` e o teste de carga rodam antes do commit. |
| Página pesada com muitos jogos | Os jogos carregam sob demanda; o painel só baixa o núcleo. |

---

## 11. Fora deste plano (ideias para depois)
- Layouts de teclado US e US-Internacional.
- Minijogos de digitação ("chuva de palavras", corrida contra o mascote).
- Desafio de digitação da turma em tempo real, reaproveitando o
  Socket.IO e o telão.
- Conquistas e medalhas compartilhadas entre jogos.
- Novos jogos: tabuada, ortografia, quiz.
