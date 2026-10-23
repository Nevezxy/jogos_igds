# 🔀 Modo Dinâmico: planejamento técnico e funcional

Documento de planejamento, escrito depois de ler o código da branch `pr/17-maratona-configuracao`.

> **Andamento (2026-10-23): implementado.** As 6 fases da seção 7 estão no código, com as decisões da seção 2 como propostas (D8 continua fora do escopo). Testes em `test/dinamico.test.js` e conferência no navegador (Hanói, Velha, Matemática e Teclado Mágico de ponta a ponta; os 18 jogos abrindo pelo link da fase). Diferenças do plano:
> - Cadentes (`js/shared/cadentes.js`) é só um kit: Letras e Números têm telas próprias e foram ligados como a Matemática.
> - O ajudante do navegador é `public/js/shared/dynamic.js` (`window.Dinamico`) e o modal fica em `public/js/platform/dinamico.js`.
> - D7: no tablet (sem teclado de verdade) o servidor não sugere jogos que precisam de teclado (`noKeyboard`).

Cada item é marcado assim:
- **[existe]**: já está no código, com o arquivo indicado.
- **[alterar]**: existe, mas precisa mudar.
- **[novo]**: não existe.

---

## 1. O que é

Um botão **🔀 Modo Dinâmico** no painel abre um modal onde a criança escolhe:

1. **Quais jogos entram** (só os jogos individuais com fases; Bingo, Desafio e Maratona ficam de fora).
2. **O intervalo**: de quantas em quantas fases concluídas o jogo troca (1, 2, 3, 4, 5…).

Com o modo ligado, ao **concluir uma fase** (ganhar pelo menos 1 ⭐) em qualquer jogo escolhido e em qualquer mundo, a tela de resultado troca o botão "Próxima fase ▶" por **"Próximo desafio: 🚗 Carrinhos · Fase 12 ▶"**. A fase sugerida é de **outro jogo**, com **dificuldade parecida**, e **nunca uma fase que a criança já jogou** (no modo livre, na Maratona ou no próprio Modo Dinâmico).

Objetivo: variar os jogos para a criança não cansar de um só, sem perder o nível em que ela está.

---

## 2. Decisões (precisam de confirmação)

| # | Decisão | Proposta |
|---|---|---|
| D1 | O que é o "intervalo" | Quantas fases **concluídas seguidas no mesmo jogo** antes de trocar. Intervalo 1 = troca a cada fase; intervalo 3 = 3 fases no jogo e depois troca. Padrão: **1**. Opções no modal: 1 a 5 |
| D2 | O que é "concluir" uma fase | Ganhar **≥ 1 ⭐**. Com 0 ⭐ a criança continua no mesmo jogo ("Jogar de novo") e o contador não anda |
| D3 | O que é "fase já realizada" | Fase com `plays > 0` **ou** `stars > 0` em `game_progress.levels` (vale para modo livre e Maratona, que já gravam no mesmo progresso). Se o jogo não guarda `plays`, vale só `stars > 0` |
| D4 | Onde guardar a configuração | **No servidor, por educando** (segue a criança em qualquer computador da escola). Uma linha em `game_progress` com `game_id = '_dinamico'` |
| D5 | Quem escolhe a próxima fase | **O servidor** (tem as fases de todos os jogos, os `tier`s e o progresso completo). O navegador só mostra |
| D6 | Jogos de tabuleiro | Entram com as fases **contra o robô** (o "jogar com um amigo" fica fora) |
| D7 | Jogos que exigem teclado | Entram, mas o modal avisa (`requiresKeyboard`) e o navegador pode desmarcá-los num aparelho sem teclado (fase 2) |
| D8 | Professor | Fora do escopo agora. Futuro: o professor liga o Modo Dinâmico para a turma e fixa os jogos |

---

## 3. O que já existe e será reaproveitado

| Peça | Para que serve aqui | Arquivo |
|---|---|---|
| `points.levelsOf(gameId)` e `points.tierOf(Levels, level)` **[existe]** | Carregam as fases de qualquer jogo no servidor e dão a dificuldade (1 a 4) de cada fase, a mesma usada nos pontos e na Maratona | `src/platform/points.js` |
| `progress.allProgress(studentId)` **[existe]** | O progresso de todos os jogos de uma vez: quais fases já foram jogadas | `src/platform/progress.js` |
| `ctx.competition` **[existe]** | Os 6 tipos de tela (PuzzleShell, BoardGame, Cadentes, Matemática, Click, Teclado Mágico) já sabem **abrir direto numa fase, sem mapa**. O Modo Dinâmico usa o mesmo caminho, mas **sem** esconder os botões nem trocar o envio do resultado | `public/js/shared/competition.js` e os shells |
| Rota `/jogos/<id>` com `params` **[existe]** | O jogo recebe a query string em `ctx.params`: `/jogos/carrinhos?fase=c12&dinamico=1` | `public/js/platform/router.js` |
| Catálogo da Maratona **[existe]** | Modelo de como listar jogos e fases a partir do registro (sem lista escrita à mão) | `src/marathon/catalog.js` |
| Modal de bichinho do painel **[existe]** | Modelo de modal (abre, Esc fecha, foco) | `public/js/platform/hub.js`, `public/index.html` |

---

## 4. Escolha da próxima fase (o algoritmo)

Entrada: o educando, o jogo e a fase que ele acabou de concluir.

1. **Nível atual** = `tier` da fase concluída (1 a 4) e a **posição relativa** dela dentro do jogo (`index / LEVELS.length`, de 0 a 1).
2. **Contador**: soma 1 em `streak` (fases concluídas seguidas neste jogo). Se `streak < intervalo`, **não troca**: devolve a próxima fase pendente do mesmo jogo (o comportamento normal) e para aqui.
3. **Candidatos**: para cada jogo escolhido, **menos o atual**, as fases **ainda não jogadas** (D3).
4. **Faixa de dificuldade**, nesta ordem, até achar candidatos:
   1. mesmo `tier`;
   2. `tier` ± 1 (prefere o de baixo se a criança tirou 1 ⭐, o de cima se tirou 3 ⭐);
   3. qualquer `tier` (fase pendente mais próxima do nível).
5. **Dentro de cada jogo**, só a **primeira fase pendente** da faixa, na ordem do jogo (os mundos ensinam em sequência: não pular para o meio de um assunto).
6. **Entre os jogos**, sorteia com peso:
   - menos peso para os jogos jogados há pouco (guarda os **últimos 3 jogos** em `recent`, evitando A → B → A);
   - desempate pela posição relativa mais próxima da atual.
7. **Sem candidatos** em nenhum jogo (todas as fases jogadas): oferece as fases com menos de 3 ⭐, com o texto "Você já jogou tudo! Que tal conquistar 3 ⭐ aqui?". Se nem isso houver: "🏆 Você completou todos os jogos escolhidos!".
8. Ao trocar: `streak = 0`, empurra o jogo atual em `recent`.

Função pura e testável: `src/platform/dynamic.js → pickNext({ settings, progressAll, from: { gameId, levelId, stars } })`.

---

## 5. Servidor

### 5.1 `src/platform/dynamic.js` **[novo]**
- `catalog(registry)`: jogos que podem entrar (`mode: 'solo'`, `status: 'active'`, com `levels.js` carregável por `points.levelsOf`). Cada jogo: `{ id, name, icon, subject, requiresKeyboard, levels: N }`.
- `getSettings(studentId)` / `saveSettings(studentId, body)`: valida `{ on: bool, games: [ids do catálogo, mínimo 2], interval: 1..10 }`; guarda junto `{ streak, current, recent }`. Armazena em `game_progress` com `game_id = '_dinamico'` (D4) — sem tabela nova. Cuidar para o `GET /progress` e os pontos ignorarem esse id (nenhum jogo do registro tem esse id, então já ignoram).
- `pickNext(...)` (seção 4).

### 5.2 Rotas **[alterar]** `src/platform/routes.js`
- `GET  /api/dinamico` → `{ settings, catalog }` (para o modal e para o selo no painel).
- `POST /api/dinamico` → salva as configurações.
- `POST /api/dinamico/proxima` `{ gameId, levelId, stars }` → `{ next: { gameId, levelId, title, icon, gameName, tier } | null, reason }`. Atualiza `streak` / `recent`.
  - Alternativa considerada: devolver `next` dentro da resposta de `POST /progress/:gameId/results` quando o modo estiver ligado. **Não recomendada**: mistura duas coisas e não funciona com o resultado guardado na caixa de saída (offline).

### 5.3 Offline
Se `POST /api/dinamico/proxima` falhar (sem internet), a tela de resultado volta ao "Próxima fase ▶" normal, sem aviso de erro.

---

## 6. Navegador

### 6.1 Painel **[alterar]** `public/js/platform/hub.js`, `public/index.html`, `public/css/platform.css`
- Botão **🔀 Modo Dinâmico** no topo do painel (ao lado de 🏅 Ranking), com selo "ligado" quando ativo.
- **Modal** (mesmo padrão do modal de bichinho):
  - interruptor Ligar / Desligar;
  - jogos agrupados pelas seções do painel (Digitação, Matemática, Mouse, Raciocínio, Tabuleiro), cada um com caixinha, ícone e nome; botão "marcar todos" por seção; ⌨️ nos que exigem teclado;
  - **intervalo**: botões 1 · 2 · 3 · 4 · 5 com o texto "Trocar de jogo a cada **N** fase(s)";
  - validação: pelo menos 2 jogos;
  - Salvar → `POST /api/dinamico`.
- Com o modo ligado, o mascote do painel diz "🔀 Modo Dinâmico ligado! Escolha um jogo para começar."

### 6.2 Ajudante comum **[novo]** `public/js/shared/dynamic.js`
```
window.Dinamico = {
  levelFromParams(ctx)       // ?fase=<id>: fase para abrir direto (sem mapa)
  async next(ctx, { gameId, levelId, stars }) -> next | null
  button(el, next)           // transforma "Próxima fase ▶" em "Próximo desafio: 🚗 Carrinhos · Fase 12 ▶"
  go(next)                   // PlataformaRouter.go(`/jogos/${gameId}?fase=${levelId}&dinamico=1`)
}
```
Carregado uma vez no `index.html` (como `competition.js`), não por jogo.

### 6.3 Os 6 shells **[alterar]**
Em cada um, dois pontos pequenos:
1. **Abrir direto na fase** quando `ctx.params.get('fase')` existir (abre a tela "antes da fase", não o mapa; o botão ← Mapa continua lá).
2. **Na tela de resultado**, se a fase foi concluída (≥ 1 ⭐) e o modo está ligado, chama `Dinamico.next(...)` e troca o botão "Próxima fase".

| Shell | Jogos | Arquivo |
|---|---|---|
| PuzzleShell | Memória, Hanói, Carrinhos, Labirinto, Pixel, Diferenças, Quebra-cabeça, Dinheiro, Balança | `public/js/shared/puzzleshell.js` (`load`, `showResult`) |
| BoardGame | Velha, Ligue 4, Dama, Xadrez | `public/js/shared/boardgame.js` |
| Cadentes | Letras, Números | `public/js/shared/cadentes.js` |
| Próprios | Conta Comigo, Click, Teclado Mágico | `public/games/matematica/game.js`, `click/game.js`, `digitacao/game.js` |

Nenhuma mecânica de jogo muda.

### 6.4 Detalhes de experiência
- Na tela "antes da fase" aberta pelo Modo Dinâmico, um selinho **🔀 Desafio dinâmico** e o mundo da fase.
- Transição curta com o mascote: "Agora é a vez do 🚗 Carrinhos!" (reaproveita `BingoMascot`).
- Botão "🔁 Jogar de novo" continua igual; "Jogar de novo" **não** conta para o intervalo (só a primeira conclusão).
- Se a criança sair para o mapa, o modo continua ligado; ele age de novo na próxima fase concluída.

---

## 7. Fases de implementação

| Fase | Entrega | Arquivos |
|---|---|---|
| 1 | `dynamic.js` no servidor (catálogo, configurações, `pickNext`) + rotas + testes do algoritmo | `src/platform/dynamic.js`, `routes.js`, `test/dinamico.test.js` |
| 2 | Botão e modal no painel | `hub.js`, `index.html`, `platform.css` |
| 3 | `public/js/shared/dynamic.js` + PuzzleShell (9 jogos) — já dá para testar de ponta a ponta | `dynamic.js`, `puzzleshell.js` |
| 4 | BoardGame e Cadentes | `boardgame.js`, `cadentes.js` |
| 5 | Matemática, Click e Teclado Mágico | os 3 `game.js` |
| 6 | Acabamento: transição com o mascote, aviso de teclado, README | — |

---

## 8. Testes

`test/dinamico.test.js` **[novo]**, no estilo de `test/maratona-catalogo.test.js`:
- nunca sugere o mesmo jogo quando há outro com fase pendente;
- nunca sugere fase com `plays > 0` ou `stars > 0`, inclusive fases jogadas na Maratona (`source: 'maratona'`);
- respeita o intervalo (2 → fica no jogo na 1ª conclusão, troca na 2ª);
- 0 ⭐ não conta;
- prefere o mesmo `tier`; cai para ± 1 e depois para qualquer `tier`;
- não repete os 3 últimos jogos quando há alternativa;
- tudo jogado → oferece fases com < 3 ⭐; nada → `next: null`;
- configurações inválidas (jogo de turma, 1 jogo só, intervalo 0) são recusadas;
- `'_dinamico'` não aparece em `GET /progress` nem nos pontos.

Teste de integração (em `test/integration.test.js`): concluir uma fase da Memória com o modo ligado e intervalo 1 devolve uma fase de outro jogo.

---

## 9. Riscos

| Risco | Como tratar |
|---|---|
| `tier` de alguns jogos é calculado pela posição (sem `tier` explícito) e pode não bater com a dificuldade real entre jogos | Mesmo critério dos pontos e da Maratona; revisar os `TIERS` dos jogos se a troca parecer injusta |
| Criança cai num jogo que não sabe jogar (primeira fase de um jogo novo) | Na faixa de `tier`, a primeira fase pendente do jogo; a tela "antes da fase" mostra a introdução do mundo (`world.intro`) |
| Jogo com teclado num tablet | D7 |
| Trocar demais irrita | Intervalo configurável; padrão pode virar 2 depois de testar com a turma |
