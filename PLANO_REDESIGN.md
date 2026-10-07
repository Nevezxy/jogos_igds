# 🎪 Plano de Redesign — Bingo Virtual "modo Poki"

Objetivo: transformar o bingo num jogo que a criança **quer** jogar. Hoje ele
parece uma ferramenta de sala de aula. A referência são portais como o Poki:
cores saturadas, botões "gordinhos" que afundam ao clicar, tudo saltitante,
sons de recompensa e comemorações exageradas.

A base técnica continua a mesma (Node + Socket.IO + HTML/CSS/JS puro, sem
build). O servidor já é sólido e validado, então o foco é o **frontend**,
com poucos ajustes no backend.

---

## 1. Diagnóstico do projeto atual

### O que já está bom (manter)
- A arquitetura do servidor é a fonte da verdade: sorteio, marcação e
  vitória são validados no backend.
- A reconexão por token funciona (a criança recarrega a página e volta para a cartela).
- Os tipos de bingo são plugáveis (números, palavras, emojis, personalizado).
- Já usa a fonte Baloo 2, que é redonda e combina com o estilo Poki.
- Já existe `prefers-reduced-motion` no CSS.

### Problemas de design
| # | Problema | Onde |
|---|----------|------|
| D1 | Tema escuro "quadro-negro" (azul-ardósia + creme), sóbrio demais para crianças | `style.css` `:root` |
| D2 | Botões planos, sem profundidade nem "clique gostoso" | `.btn`, `.choice-card` |
| D3 | Só 4 animações simples (pulse, bannerIn, drawPop, toastIn) | `style.css` |
| D4 | Nenhum som | — |
| D5 | Vitória mostrada só como banner de texto | `player.js` `showBanner` |
| D6 | O jogador só vê o número sorteado num toast pequeno no canto | `player.js` `draw_result` |
| D7 | Sem personagem, mascote ou avatar, então não há identidade nem pertencimento | — |
| D8 | A casa livre aparece como "GRÁTIS" em texto | `player.js` `cellLabel` |

### Problemas de usabilidade (para criança)
| # | Problema | Impacto |
|---|----------|---------|
| U1 | **A marcação é automática** no sorteio (`roomManager.drawItem` marca tudo) | A criança não tem nada para fazer e só assiste |
| U2 | Clicar numa casa marcada **desmarca** (`markCell` alterna) | Toques acidentais desfazem o progresso e confundem |
| U3 | Precisa digitar um código como "7QXKD" | Difícil para quem está se alfabetizando |
| U4 | Termos adultos: "educando", "Mestre da Sala", "status", "aguardando" | Linguagem distante |
| U5 | Mensagens de erro técnicas ("Código de sala inválido ou sala não encontrada.") | Frustra e não explica o que fazer |
| U6 | Tela de espera parada (só um ⏳ pulsando) | Tédio e ansiedade antes do jogo |
| U7 | Não mostra "quase lá" (faltando 1 casa) | Perde o momento de maior emoção do bingo |
| U8 | `maximum-scale=1` no viewport impede o zoom | Problema de acessibilidade |
| U9 | O mestre não tem "modo telão/projetor" | Em sala de aula todos olham para a TV |
| U10 | Não há anúncio falado do número | A criança que não lê bem fica para trás |

---

## 2. Direção visual — "Parque de Diversões Digital"

### Paleta (alto contraste, saturada)
```css
--bg-1: #6C3BFF;      /* roxo vibrante (fundo principal) */
--bg-2: #2EC4FF;      /* azul céu (gradiente) */
--yellow: #FFD23F;    /* ação principal / destaque */
--pink: #FF4FA3;      /* energia, vitória */
--green: #3DDC84;     /* acerto / marcado */
--orange: #FF8A3D;    /* alerta amigável */
--red: #FF4D5E;       /* perigo (só para o mestre) */
--ink: #1E1240;       /* texto (roxo quase preto, mais "amigável" que preto) */
--white: #FFFFFF;
```
- **Fundo:** um gradiente roxo→azul animado bem devagar, com formas flutuantes
  (estrelas, círculos e bolinhas de bingo) em parallax suave. Isso é o mais
  "Poki" de todo o plano.
- **Cartões:** brancos, com `border-radius: 28px`, borda grossa de 4px na cor
  da seção e sombra "sólida" deslocada para baixo (`box-shadow: 0 8px 0 <cor escura>`).

### Botões "3D de brinquedo" (padrão Poki)
```css
.btn {
  background: var(--yellow);
  border: 3px solid var(--ink);
  border-radius: 18px;
  box-shadow: 0 6px 0 var(--ink);
  transform: translateY(0);
  transition: transform .08s, box-shadow .08s;
}
.btn:hover  { transform: translateY(-2px) scale(1.03); box-shadow: 0 8px 0 var(--ink); }
.btn:active { transform: translateY(6px); box-shadow: 0 0 0 var(--ink); } /* "afunda" */
```
- Área mínima de toque de **56px** (dedos pequenos e tablets).
- Ícone grande + texto curto em todos os botões.

### Tipografia
- Títulos: **Baloo 2 800** com contorno (`-webkit-text-stroke` + `text-shadow`
  em camadas), no estilo do logo de jogo.
- Números da cartela: Baloo 2 800, grandes (≥ 28px no celular).
- Texto: Nunito 700 (nunca 400, que é fino demais para leitura infantil).

### Mascote
Uma **bolinha de bingo com carinha** ("Bingolino"), feita em SVG inline, sem
arquivos externos, com estados:
- 😊 parado / piscando (tela inicial, espera)
- 🤩 animado (número sorteado)
- 😱 "quase!" (falta 1)
- 🥳 comemorando (bingo)
- 😴 dormindo (partida pausada)

---

## 3. Mudanças por tela

### 3.1 Tela inicial
- Logo "BINGO!" grande com letras que quicam em sequência (stagger).
- O mascote quica ao lado.
- Dois botões gigantes:
  - **🎮 JOGAR** (amarelo, pulsando de leve), para entrar numa sala
  - **🧑‍🏫 Sou professor(a)** (menor, roxo), para criar uma sala
- Botão de som 🔊/🔇 fixo no canto (padrão de jogo).

### 3.2 Entrar na sala (criança)
Vira um **fluxo em 3 passos**, um de cada vez, com barra de progresso de estrelas:
1. **Código:** 5 caixinhas grandes, uma letra por caixa (estilo código de
   verificação), com teclado em caixa alta e foco automático.
   - Se a URL tiver `?sala=7QXKD` (vindo do QR Code), **pula este passo**.
2. **Nome:** campo grande, com o teclado já aberto.
3. **Escolha seu bichinho:** grade de 16 avatares emoji (🐶🐱🦊🐼🐸🦁🐵🐧🦄🐙🐢🐝🦖🐰🐯🐨)
   em círculos coloridos. Ao tocar, o avatar dá um pulo e toca um som.

Erros traduzidos para linguagem infantil e mostrados pelo mascote:
| Código do servidor | Mensagem nova |
|---|---|
| `SALA_NAO_ENCONTRADA` | "Hmm, não achei essa sala 🤔 Confere o código com o(a) professor(a)!" |
| `NOME_DUPLICADO` | "Já tem alguém com esse nome! Que tal colocar a inicial do sobrenome?" |
| `SALA_ENCERRADA` | "Essa sala já fechou 🌙" |
| sala bloqueada | "A sala está trancada 🔒 Peça ao professor(a) para abrir!" |

### 3.3 Sala de espera (criança)
- Mostra os **avatares de todos que entraram**, flutuando. Cada novo jogador
  "cai" na tela com um quique e um som de *pop*.
- Frase rotativa do mascote: "Esperando a turma...", "Já somos 12! 🎉".
- **Mini-brincadeira enquanto espera:** balões coloridos sobem e estouram ao
  toque (só client-side, para passar o tempo e testar o toque).
- Quando o jogo começa: **contagem 3… 2… 1… BINGO!** em tela cheia, e a
  cartela entra montando casa por casa.

### 3.4 Tela de jogo (criança), o coração do redesign
**Layout (celular, em pé):**
```
┌───────────────────────────┐
│ 🐶 Ana      ⭐ 7/24  🔊   │  ← topo: avatar, progresso, som
├───────────────────────────┤
│      ( 42 )  ← bola       │  ← última bola, grande e girando
│  41 · 17 · 8 · 33 · 2     │  ← últimas 5 bolas em fila
├───────────────────────────┤
│  B   I   N   G   O        │  ← cabeçalho colorido (só no 5×5 com números)
│ [12][27][ 41][58][ 70]    │
│ [ 3][19][ ★ ][52][ 64]    │  ← cartela
│ ...                       │
├───────────────────────────┤
│   🔥 FALTA 1 PARA O BINGO! │  ← só aparece quando falta 1
└───────────────────────────┘
```

**Sorteio de cada número (o grande momento):**
1. Overlay em tela cheia: uma bola colorida rola da direita, gira e para no centro (~1,2s).
2. O número aparece com *pop* e é **falado em voz alta** (Web Speech API, `pt-BR`).
3. A bola encolhe e voa para a fila de "últimas bolas".
4. Se a criança **tem** o número: a casa começa a **brilhar e balançar**
   ("me toca!") e o mascote aparece dizendo "Você tem!".
5. Se **não tem**: um "Ops, não tenho" curto e neutro (sem som triste).

**Marcar casa (U1 + U2):**
- Novo modo padrão: **marcação manual com ajuda**. A casa sorteada brilha e a
  criança toca para marcar. O toque faz o **efeito de carimbo (dab)**: um
  círculo colorido "esmagado" com rotação aleatória, estrelinhas saindo e o som *boing*.
- Tocar numa casa **não sorteada** faz a casa tremer (shake) e mostra a
  dica "Esse ainda não saiu!", sem toast de erro.
- **Desmarcar removido** para a criança. Só o servidor desfaz, quando o mestre usa "desfazer sorteio".
- O mestre pode escolher **marcação automática** (como hoje) nas configurações,
  para turmas muito pequenas.

**"Quase lá!" (U7):**
- Quando falta 1 casa para qualquer padrão: a linha, coluna ou diagonal ganha uma
  borda pulsante laranja, o mascote faz cara de 😱 e aparece a faixa "🔥 FALTA 1!".
- Toca uma batida de tambor curta que acelera nos próximos sorteios.

**BINGO!:**
- Tela cheia: a palavra **B-I-N-G-O** entra letra por letra com quique,
  junto com **chuva de confete** (canvas), fogos de artifício e fanfarra.
- A linha vencedora fica dourada e brilhando.
- Ganha uma **medalha/troféu** que fica no topo pelo resto da partida.
- Para os **outros jogadores**: um banner divertido com o avatar do vencedor
  ("🦊 Ana fez BINGO! 🎉") e confete menor, sem tom de derrota.

**Partida pausada:**
- A cartela fica com filtro acinzentado e o mascote dorme (😴 Zzz…) no centro.

### 3.5 Painel do professor(a)
Continua mais "sério" (é ferramenta), mas com a mesma identidade visual.
- **QR Code grande + link** para a turma entrar (`http://IP:3000/?sala=CODE`),
  gerado no cliente com uma lib de QR (vendorizada, sem CDN, para funcionar
  em rede local sem internet).
- **Botão "Abrir telão 📺"** abre `/telao?sala=CODE` em nova aba para o projetor (ver 3.6).
- **Configuração em cartões visuais** em vez de selects:
  - Tipo de bingo: 4 cartões grandes com ícone (🔢 🔤 😀 🧩)
  - Tamanho: miniaturas de cartela 3×3, 4×4, 5×5, 6×6
  - Regras de vitória: mini-desenhos da linha/coluna/diagonal/cheia
  - **Novo:** modo de marcação (manual com ajuda / automático)
  - **Novo:** sorteio automático a cada X segundos (desligado, 10s, 15s, 20s, 30s)
  - **Novo:** voz que anuncia o número (liga/desliga)
- **Quadro de números** (estilo painel de bingo real): grade com todos os
  itens possíveis, acendendo conforme saem.
- **Botão SORTEAR** gigante, em forma de alavanca/roleta, com atalho de teclado **Espaço**.
- **Lista de participantes** com avatar, barra de progresso de cada um e
  selo 🔥 para quem está "quase lá" (para o professor criar suspense: "tem
  gente quase lá, hein!").
- As ações perigosas (encerrar, expulsar) ficam num menu "⋯", para evitar cliques acidentais.

### 3.6 Novo: Modo Telão (projetor/TV)
Uma rota somente-leitura (`/telao`) que entra como espectador:
- Bola sorteada **enorme** no centro, com a mesma animação e voz.
- Quadro de números iluminados ao lado.
- Avatares da turma embaixo, com os "quase lá" pulsando.
- Comemoração de BINGO em tela cheia com o nome do vencedor.
- Antes de começar: QR Code gigante + código da sala ("Entre aqui!").

---

## 4. Sistema de animações

Biblioteca própria e pequena em `public/js/fx.js`, sem dependências:

| Efeito | Técnica | Uso |
|---|---|---|
| `bounceIn` | CSS keyframes com overshoot (`cubic-bezier(.34,1.56,.64,1)`) | Entrada de telas, cartões e avatares |
| `wiggle` | CSS rotate ±6° | Casa sorteada "me toca", botão JOGAR |
| `shake` | CSS translateX | Toque errado |
| `stamp` | CSS scale 1.6→0.9→1 + rotate aleatório via CSS var | Marcar casa |
| `ballRoll` | CSS transform + rotação | Sorteio |
| `confetti` | `<canvas>` com ~150 partículas e física simples | Bingo |
| `fireworks` | `<canvas>`, explosões radiais | Bingo (telão) |
| `sparkle` | Partículas DOM (5–8 estrelinhas) | Marcar casa, escolher avatar |
| `floatBg` | CSS keyframes infinitos lentos | Fundo animado |
| `stagger` | `animation-delay: calc(var(--i) * 40ms)` | Montagem da cartela, letras do logo |

Regras:
- Animar **só `transform` e `opacity`**, para manter 60fps em celulares fracos.
- Respeitar `prefers-reduced-motion`: troca tudo por fades curtos e desliga o confete.
- Animações de feedback (≤ 300ms) nunca bloqueiam a interação.

## 5. Sistema de som

`public/js/sound.js`, usando a **Web Audio API com sons sintetizados** (osciladores),
sem arquivos de áudio. Fica leve e funciona offline.
- `pop` (avatar entra, botão), `boing` (marcar), `whoosh` (bola rolando),
  `ding` (você tem o número), `drum` (quase lá), `fanfare` (bingo), `click`.
- Voz: `speechSynthesis` com `lang = 'pt-BR'`, falando "Número quarenta e dois!".
- Botão 🔊/🔇 global, com a preferência guardada no `localStorage`.
- O áudio só é desbloqueado após o primeiro toque (regra dos navegadores);
  aproveitar o toque no botão "JOGAR".

---

## 6. Mudanças no servidor (pequenas)

| Mudança | Arquivo | Detalhe |
|---|---|---|
| Avatar do jogador | `roomManager.joinRoom`, `publicPlayerSummary`, `db.js` | Novo campo `avatar` (validado contra uma lista permitida) |
| Modo de marcação | `DEFAULT_CONFIG`, `drawItem` | `markingMode: 'manual' \| 'auto'`; no manual, `drawItem` **não** marca |
| Sem desmarcar | `markCell` | No modo manual, só marca (não alterna) |
| "Quase lá" | `winChecker.js` | Nova função `getNearWins(card, patterns)` que retorna as linhas com 1 faltando e as células que faltam |
| Progresso | `publicPlayerSummary` | Adicionar `nearWin: boolean` para o painel do mestre e o telão |
| Sorteio automático | `roomManager` + `socketHandlers` | `setInterval` por sala, limpo ao pausar/encerrar e ao detectar vitória com autopause |
| Espectador (telão) | `socketHandlers` | Evento `watch_room` que entra no canal sem ser jogador e recebe `room_summary` + `draw_result` + `win_announced` |
| Rota `/telao` | `server.js` | Já funciona pela rota `*`; o JS detecta pelo `location.pathname` |
| Pré-preencher código | — | Só no cliente (`URLSearchParams`) |
| Voz no servidor? | — | **Não**; fica no cliente |

Os testes de integração (`test/integration.test.js`) precisam cobrir:
avatar, modo manual (sorteio não marca), marcação sem toggle, `nearWin` e o espectador.

---

## 7. Organização do frontend

Continua sem build step. Os arquivos novos ou reorganizados ficam assim:
```
public/
├── index.html            # telas reestruturadas + SVG do mascote
├── css/
│   ├── tokens.css        # cores, raios, sombras, fontes
│   ├── base.css          # reset, fundo animado, tipografia
│   ├── components.css    # botões 3D, cartões, chips, modal, toasts
│   ├── animations.css    # todos os @keyframes
│   └── screens.css       # estilos por tela (home, join, espera, jogo, mestre, telão)
└── js/
    ├── socket-client.js  # (igual)
    ├── ui.js             # + mensagens infantis de erro, transições de tela
    ├── sound.js          # NOVO: sons sintetizados + voz
    ├── fx.js             # NOVO: confete, fogos, sparkle, stamp
    ├── mascot.js         # NOVO: troca de expressão do mascote
    ├── qrcode.min.js     # NOVO: lib de QR vendorizada (MIT)
    ├── app.js            # + fluxo de 3 passos, ?sala=, avatar
    ├── player.js         # + overlay de sorteio, marcação manual, quase lá, bingo
    ├── master.js         # + cartões de config, quadro de números, QR, auto-sorteio
    └── screen.js         # NOVO: modo telão
```

---

## 8. Acessibilidade e cuidados com crianças
- Remover `maximum-scale=1` do viewport.
- Contraste mínimo de 4.5:1 no texto. A casa marcada usa **cor + ícone** (não só cor).
- `aria-live="assertive"` anunciando cada número sorteado.
- Navegação por teclado no painel do mestre (Espaço = sortear).
- Sem perda e sem ranking negativo: quem não ganhou vê "Quase! Próxima rodada é sua 💪".
- Nome do jogador limitado e filtrado (lista simples de palavras impróprias no servidor).
- Os sons começam em volume moderado; nada de som alto inesperado.

---

## 9. Roteiro de implementação (fases)

**Antes de começar:** rodar `git init` e fazer um commit do estado atual, para
podermos voltar atrás se algo der errado (hoje o projeto não está versionado).

| Fase | Entrega | Resultado visível |
|---|---|---|
| **1. Fundação visual** | Tokens novos, fundo animado, botões 3D, tipografia, mascote SVG, separação do CSS | O jogo inteiro já "parece Poki" |
| **2. Som + FX** | `sound.js`, `fx.js` (confete, stamp, sparkle), botão de mudo | Tudo faz barulho e brilha |
| **3. Experiência da criança** | Fluxo de entrada em 3 passos, avatares, `?sala=`, sala de espera viva, contagem 3-2-1 | A entrada fica divertida e fácil |
| **4. Jogo** | Overlay de sorteio + voz, marcação manual com carimbo, "quase lá", tela de BINGO, pausa com mascote dormindo | O coração do jogo |
| **5. Backend** | Avatar, `markingMode`, sem toggle, `nearWin`, auto-sorteio, espectador + testes | Suporte às fases 3, 4 e 6 |
| **6. Professor + Telão** | Config em cartões, quadro de números, QR Code, participantes com progresso, rota `/telao` | A sala de aula inteira joga junto |
| **7. Polimento** | Reduced motion, contraste, teste em celular/tablet/Chromebook, performance com 20+ jogadores | Pronto para uso real |

A fase 5 é feita junto com a 3 e a 4, conforme cada tela precisa dela.

### Como validar cada fase
- Abrir o professor + 3 abas de criança (uma em modo celular 375px) e jogar
  uma partida completa até o BINGO.
- Rodar `node test/integration.test.js`.
- Testar com `prefers-reduced-motion` ligado.
- Testar num celular real na mesma rede Wi-Fi (`http://192.168.x.x:3000`).
