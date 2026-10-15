# 🏃 Modo Maratona: planejamento técnico e funcional

Documento de planejamento. As decisões estão na seção 13.1 e o andamento logo depois dela. Ele foi escrito depois de ler o código da branch `pr/8-limite-dicas`, que tem todos os 22 jogos e as correções recentes.

Cada item é marcado assim:
- **[existe]**: já está no código, com o arquivo indicado.
- **[alterar]**: existe, mas precisa mudar.
- **[novo]**: não existe.

---

## 1. Diagnóstico da arquitetura atual

### 1.1 O que existe hoje

| Área | Como funciona hoje | Arquivo |
|---|---|---|
| Servidor | Node + Express + Socket.IO no mesmo processo, sem etapa de build | `server.js` |
| Banco | SQLite (better-sqlite3, síncrono, modo WAL) num arquivo só | `src/platform/db.js` (`data/bingo.sqlite`) |
| Contas de educando | Login só com nome e sobrenome, sem senha. O token de sessão fica no navegador. Turma opcional (`class_name`) | `src/platform/accounts.js` |
| Professor | **Um único PIN** (`PROFESSOR_PIN`). O token fica **só em memória** e vale 12 h; reiniciar o servidor pede o PIN de novo. **Não existe conta de professor nem "dono" de sala** | `src/platform/teacher.js` |
| Catálogo de jogos | `registry.js` lista os jogos com `id`, `name`, `icon`, `mode` ('solo' ou 'turma'), `subject`, `status`, `requiresKeyboard`, `client` e `server` (`validateResult`, `mergeProgress`, `summary`, `teacherSummary`). A API pública é `GET /api/games` | `src/games/registry.js` |
| Resultados | `POST /api/progress/:gameId/results`: o jogo valida a rodada (`validateResult`), o resultado é gravado **numa transação** (`recordResult`), atualiza `game_progress` (um JSON por educando e jogo) e insere uma linha em `game_results` | `src/platform/routes.js`, `src/platform/progress.js` |
| Validação | Quase todos os jogos **refazem a rodada no servidor pela semente** (`seed`) ou pelos lances. Ver a tabela 6.2 | `src/games/*/server.js` |
| Estrelas | Cada jogo dá de 0 a 3 ⭐ por fase. O progresso guarda o **melhor** de cada fase (`levels[id].stars`) | `levels.js` de cada jogo |
| Fases | Cada jogo tem `WORLDS → levels`, montados por `puzzlelevels.js`, `boardlevels.js` ou por um builder próprio (matemática, letras, números, click, digitação). Cada fase tem `index` e `indexInWorld`. **Não existe um campo de dificuldade explícito** | `public/games/*/levels.js` |
| Telas comuns | **PuzzleShell** (9 jogos), **BoardGame** (4 jogos), **Cadentes** (letras e números), e telas próprias em Matemática, Click e Teclado Mágico | `public/js/shared/*.js` |
| Tempo real | Socket.IO com prefixos por jogo: Bingo, `dz:` (Desafio) e `bg:` (partidas de tabuleiro). O padrão das salas é: o professor cria com o `teacherToken` e recebe um `masterToken`; os educandos entram com o `studentToken` e um código de 4 letras; há QR Code e um telão (`watch`) | `src/games/bingo/*`, `src/games/desafio/*`, `src/platform/match.js` |
| Estado das salas ao vivo | **Em memória**. O Bingo grava snapshots e eventos (`rooms`, `players`, `draws`, `wins`); o Desafio e as partidas `bg:` não gravam nada | `roomManager.js`, `raceManager.js`, `match.js` |
| Modo offline | Service worker e uma "caixa de saída": o resultado que não chegou ao servidor é **reenviado** depois | `public/js/platform/api.js`, `src/platform/offline.js` |
| Área do professor | Lista de educandos, turmas, juntar contas, evolução, planilha e as ferramentas (`teacherTool`) | `src/platform/teacher.js`, `public/js/platform/teacher.js` |
| Efeitos | Confete, sons e mascote | `public/js/shared/fx.js`, `sound.js`, `mascot.js` |

### 1.2 O que pode ser reaproveitado

1. **O padrão de sala ao vivo do Bingo e do Desafio:** código de sala, QR Code, `masterToken`, `teacherToken`, entrada com a conta, telão e reconexão. É o mesmo fluxo que a Maratona precisa.
2. **`validateResult` de cada jogo:** é a validação oficial da rodada. A Maratona **não reescreve validação**; ela chama a mesma função com a semente e a fase que o servidor sorteou.
3. **`recordResult` e a transação SQLite:** a gravação continua a mesma, ganhando só a origem ("maratona") e a proteção contra duplicação.
4. **As telas comuns de jogo:** basta ensinar 3 delas (PuzzleShell, BoardGame e Cadentes) e 3 telas próprias a rodar **uma fase dada, com uma semente dada, sem o mapa**. Assim os 18 jogos entram sem mexer na mecânica de nenhum.
5. **`match.js` (partida pela rede):** já é o juiz de duelos 1×1 de Velha, Ligue 4, Dama e Xadrez, com reconexão e abandono.
6. **O motor de digitação do Desafio** (`TypingRun` no servidor): confere cada tecla no servidor. É a forma mais segura de pôr o Teclado Mágico numa disputa.
7. **O campo `requiresKeyboard`** do registro: serve para avisar o professor quando um jogo exige teclado.

### 1.3 Limitações encontradas (precisam ser resolvidas ou aceitas)

| # | Limitação | Impacto na Maratona |
|---|---|---|
| L1 | **Não há conta de professor**: é um PIN único e o token fica em memória | "Dono da sala" = quem tem o `masterToken` daquela maratona. Dá para guardar o hash dele no banco, para o professor voltar depois de reiniciar o servidor. Vários professores com salas separadas funcionam, mas **não há "minhas maratonas" por professor** |
| L2 | **As salas ao vivo só existem em memória** | A Maratona precisa de estado **persistido** (tabelas novas) e de uma retomada ao reiniciar o servidor |
| L3 | **Sem proteção contra resultado duplicado**: a caixa de saída reenvia o resultado quando a requisição passa de 20 s, mesmo que o servidor já o tenha gravado. Não há chave única em `game_results` | Precisa de uma chave de idempotência (**Fase 1**) antes de qualquer ranking |
| L4 | **Não há dificuldade explícita**. Em vários jogos os mundos são **assuntos, não níveis**: na Matemática, "Multiplicação" vem antes de "Conta armada"; na Memória, os mundos são tipos de par | Precisa de uma classificação de dificuldade (`tier`) por fase (**Fase 2**) |
| L5 | **Validação fraca em alguns jogos.** Letras, Números e Click aceitam a lista de "peças que caíram" enviada pelo navegador. O Teclado Mágico aceita a precisão informada. O Quebra-cabeça só confere o tempo | Numa competição, isso facilita resultado falso. Ver a seção 6 (proposta por jogo) |
| L6 | **Aleatoriedade sem semente**. O texto do Teclado Mágico (`Content.generate`) e as peças especiais dos Cadentes (bomba, gelo) usam `Math.random` | Dois adversários teriam rodadas diferentes. É preciso semear ou desligar esses sorteios no modo competitivo |
| L7 | **Partidas contra o robô** não são justas para comparar: o robô é aleatório e o navegador manda os lances dele | As fases contra robô **ficam fora** da Maratona. Os jogos de tabuleiro entram como duelo pela rede |
| L8 | **Jogos longos**: Xadrez completo, Hanói de 7 discos (127 lances), Teclado Mágico com textos longos | É preciso um tempo máximo por rodada e uma lista de fases elegíveis |
| L9 | **O estado da partida fica no navegador** | Se a página for recarregada no meio, a fase recomeça. A regra fica no item 8.6 |
| L10 | **Não existe ranking**: há só estrelas por jogo, somadas no painel | Ranking e pontos globais são **[novo]** (**Fase 1**) |

---

## 2. Descrição funcional

### 2.1 Fluxo do professor

1. **Área do professor → cartão "🏃 Maratona"** (um `teacherTool` novo).
2. **Criar a maratona:** dar o nome, escolher os jogos (a lista vem do registro), o formato, o nível (1 a 4), a rotação, o número de rodadas, o balanceamento e as opções extras.
3. **Abrir a sala:** aparecem o código de 4 letras e o QR Code. Os educandos vão entrando na sala de espera.
4. **Montar as equipes:** com o balanceamento ligado, o sistema monta as equipes e o professor pode trocar alguém. Com ele desligado, o professor arrasta os nomes ou clica em "🎲 Sortear".
5. **Começar:** a configuração fica travada (ver 2.3).
6. **Em cada rodada:** o sistema mostra o jogo e a fase escolhidos, os confrontos e uma contagem regressiva. Durante a disputa, o professor acompanha quem já terminou. No fim, aparece a tela entre rodadas e o botão "▶ Próxima rodada", ou a passagem automática se ela estiver configurada.
7. **Ações excepcionais:**
   - pausar ou retomar;
   - encerrar uma rodada por tempo;
   - dar W.O. num confronto;
   - dispensar um educando ausente;
   - encerrar a maratona antes do fim.

   Todas essas ações ficam registradas no histórico de eventos.
8. **Fim:** o ranking animado aparece no telão. Os resultados ficam salvos em "Maratonas anteriores", na área do professor.

### 2.2 Fluxo do educando

1. Entra com a conta, pelo código ou pelo QR Code (`/jogos/maratona?sala=ABCD`), e espera na sala de espera vendo a própria equipe.
2. Em cada rodada, vê o jogo, a fase, o adversário e a contagem regressiva. Com votação ligada, primeiro vota no jogo.
3. A fase abre direto, sem o mapa e com a mesma semente do adversário. Quando termina, o resultado vai para o servidor e a criança vê "esperando os outros terminarem…".
4. Depois vêm o resultado do confronto e a classificação. No fim, o pódio.

### 2.3 O que pode mudar depois de criada a maratona

| Configuração | Na sala de espera | Depois de começar |
|---|---|---|
| Nome | ✅ | ✅ (só o texto) |
| Jogos participantes | ✅ | ❌ (mudaria o sorteio e a votação) |
| Formato | ✅ | ❌ |
| Nível de dificuldade | ✅ | ❌ |
| Rotação | ✅ | ❌ |
| Limite de rodadas | ✅ | ✅, só para **mais** ou para o número da rodada atual (vale como "encerrar ao fim desta rodada") |
| Balanceamento automático | ✅ | ❌ (as equipes já estão formadas) |
| Equipes | ✅ | Só entre rodadas e só para **pôr quem chegou depois ou quem está de reserva**. Ninguém troca de equipe depois de pontuar |
| Tempo da rodada, passagem automática, votação (duração) | ✅ | ✅, vale a partir da próxima rodada |
| Entrada de novos educandos | ✅ | ✅, como **reserva** ou "entra na próxima rodada" (ver 4.3) |

---

## 3. Regras oficiais da competição

### 3.1 Formatos

| Formato | Lados | Confronto |
|---|---|---|
| Solo | cada educando | 1 × 1 |
| Dupla, Trio, Quarteto | equipes de 2, 3 ou 4 | equipe × equipe |
| Duas Equipes | 2 equipes com todos | uma única disputa por rodada: equipe A × equipe B |

### 3.2 Quantidade incompatível de participantes (regra decidida antes de começar)

- **Equipes de tamanho fixo (s):** o número de equipes é `k = max(2, floor(n / s))`. As `n − k·s` pessoas que sobram entram **uma por equipe**, então as equipes ficam com `s` ou `s + 1` integrantes. Como a nota da equipe é a **média** (3.4), uma equipe maior não leva vantagem. Se `n < 2·s`, o professor recebe o aviso "poucos educandos para Trio: use Dupla ou Solo" e não consegue começar.
- **Solo com número ímpar:** a cada rodada, uma pessoa **descansa** (ver 3.6).
- **Duas Equipes:** tamanhos `ceil(n/2)` e `floor(n/2)`, também comparados pela média.
- **Mínimo para começar:** 2 lados com pelo menos 1 pessoa conectada.

### 3.3 Dois tipos de confronto (para não apagar o que cada jogo tem de próprio)

- **Corrida de fase:** os dois lados jogam **a mesma fase, com a mesma semente**, ao mesmo tempo. Vence quem tiver o melhor desempenho normalizado (3.4). Vale para 14 jogos: os 9 do PuzzleShell, Letras, Números, Matemática, Click e Teclado Mágico.
- **Duelo:** os lados jogam **um contra o outro** pela rede (`match.js`). Vale para Velha, Ligue 4, Dama e Xadrez, nas variantes de partida, não nas fases contra o robô.
  - Em **equipes**, cada integrante joga uma partida contra um integrante da outra equipe, como num match de xadrez por equipes. Vence a equipe com mais vitórias; o empate em vitórias decide pelos empates de partida, depois pelo tempo total, e no fim fica empate.
  - Se as equipes tiverem tamanhos diferentes, quem sobra **descansa naquela rodada**. (Mudou na implementação: jogar contra alguém que já está num tabuleiro não dá, porque as partidas são ao mesmo tempo.)
  - O Xadrez "Fim de partida" (mate em 1 ou 2) entra como **corrida**: as duas crianças resolvem a mesma posição.

### 3.4 Desempenho normalizado (corrida de fase)

O problema: as escalas de cada jogo são diferentes (jogadas, erros, toques, palavras por minuto). Por isso cada jogo ganha um **adaptador** no servidor que transforma o resultado **já validado** em:

```
perf = { concluiu: bool, estrelas: 0..3, qualidade: 0..1, tempoMs }
nota = concluiu ? 100 + 100·estrelas + round(99·qualidade) : 0     (0 a 499)
```

- **Estrelas:** a regra de estrelas do próprio jogo, que o professor e as crianças já entendem.
- **Qualidade:** desempata entre quem tem as mesmas estrelas, usando a medida de cada jogo. Quase todas já são calculadas hoje no `validateResult` (o campo `accuracy`). Ver a tabela 6.2.
- **Nota da equipe:** a média das notas dos integrantes escalados. O ausente conta 0 (decisão pendente D5).

**Quem vence o confronto:**
1. A maior nota vence se a diferença for de **4 pontos ou mais**. Assim, centésimos de qualidade não decidem.
2. Senão, vence o menor tempo médio (medido **pelo servidor**, da largada ao recebimento do resultado), se a diferença passar de 10%.
3. Senão, é **empate**.

### 3.5 Pontos da maratona

| Resultado do confronto | Pontos da equipe (ou do educando no Solo) |
|---|---|
| Vitória | **3** |
| Empate | **1** |
| Derrota | **0** |
| Vitória por W.O. (adversário todo ausente) | 3 |
| Descanso (lado ímpar) | **1** (vale um empate; ninguém descansa duas vezes enquanto houver quem não descansou) |
| Os dois ausentes | 0 para os dois |

**Bônus:** desligado por padrão. A opção do professor "⭐ Bônus de perfeição" dá +1 ponto ao lado cuja média de estrelas da rodada for 3. É justo entre jogos porque usa a escala de estrelas de cada um.

**Desempate na classificação**, nesta ordem:
1. pontos;
2. saldo de nota (soma de nota a favor menos nota contra);
3. confronto direto;
4. número de vitórias;
5. sorteio feito e **gravado** no histórico de eventos.

### 3.6 Pareamentos

- **Até 8 lados: todos contra todos.** Usa o "método do círculo": em `n − 1` rodadas, ninguém repete adversário. Com número ímpar de lados, o lado "fantasma" é o descanso.
- **Mais de 8 lados: sistema suíço.** A cada rodada, os lados são ordenados pela classificação e cada um enfrenta o mais próximo que **ainda não enfrentou**. O descanso vai para o último colocado que ainda não descansou.
- **Duas Equipes:** sempre A × B.
- **A ordem é decidida pelo servidor**, com um sorteio de semente gravada para poder ser auditado. Quando as rodadas acabam antes do ciclo completo, ninguém fica com mais partidas que os outros: no todos contra todos, todos jogam em todas as rodadas, exceto quem descansa.

### 3.7 Rotação dos jogos

| Modo | Regra |
|---|---|
| **Ordem definida** | O professor monta a lista das rodadas (pode repetir jogos). A rodada `r` usa o item `r`; se a lista acabar, volta ao começo |
| **Sequencial** | Percorre os jogos escolhidos em ciclo, na ordem do catálogo |
| **Aleatório** | "Saco" embaralhado: cada jogo sai uma vez antes de qualquer jogo repetir, e nunca duas rodadas seguidas com o mesmo jogo (se houver 2 ou mais jogos) |
| **Votação** | 30 s, configurável de 15 a 60 s, com 3 opções sorteadas do saco. Cada educando tem 1 voto e pode trocar até o fim do tempo. Vence a maioria simples. **Empate**: sorteio entre os empatados. **Quem não vota** não conta. **Ninguém votou**: sorteio. O jogo da rodada anterior não entra nas opções |
| Sugestão extra: **Escolha do professor** | A cada rodada, o professor toca no jogo |

**Fase da rodada:** é escolhida **depois** do jogo. Sai de um saco com as fases elegíveis daquele jogo no nível da maratona, sem repetir nenhuma até o saco esvaziar. A semente é sorteada pelo servidor. Jogo, fase, semente, como foi escolhido e os votos ficam gravados na rodada **antes** da largada, então uma reconexão ou um reinício do servidor encontra tudo pronto.

### 3.8 Nível de dificuldade (1 a 4)

Cada fase ganha um `tier` de 1 a 4 (seção 6.3):

| Nível da maratona | Tiers aceitos |
|---|---|
| 1 | 1 |
| 2 | 1 e 2 |
| 3 | 2 e 3 |
| 4 | 1, 2, 3 e 4 (todas as elegíveis) |

**Elegível** = tem o tier aceito, **não é contra o robô**, cabe no tempo da rodada (`estMs ≤ tempo da rodada`) e o jogo está selecionado.

**Se faltarem fases:**
- Um jogo sem nenhuma fase elegível **fica desabilitado** na configuração, com o motivo ("Dama não tem fases no nível 1").
- Quando o saco de fases de um jogo esvazia, ele é **reabastecido**: a mesma fase pode voltar com outra semente, priorizando a menos usada.
- A maratona só começa com pelo menos 1 jogo elegível.

### 3.9 Encerramento

A maratona termina quando:
- a última rodada configurada acaba; ou
- o professor encerra, e então a rodada em andamento termina normalmente ou é anulada, à escolha dele.

Cada rodada termina quando **todos os confrontos estiverem resolvidos**. Um confronto é resolvido por um destes caminhos:
- todos os escalados mandaram o resultado;
- o tempo da rodada acabou: quem não concluiu fica com nota 0, e os duelos são decididos pela regra 8.5;
- o professor resolveu, com motivo registrado.

---

## 4. Equipes e balanceamento

### 4.1 Força estimada de cada educando

`força = pontos globais` (seção 5), convertidos em **percentil dentro dos participantes da sala** (0 a 100). O percentil evita que a turma com mais tempo de jogo distorça a escala.

- **Sem histórico** (menos de 5 fases concluídas): recebe a **mediana da sala** (50). Assim não começa em desvantagem nem é tratado como fraco.
- **Depois da primeira maratona:** soma-se um **índice de maratona** (Elo simples por confronto, guardado no educando). Fica `força = 0,7·percentil(pontos) + 0,3·percentil(Elo)`. Os pesos são configuráveis.

### 4.2 Algoritmo recomendado

Para k equipes com tamanhos fixos:

1. Ordena por força, da maior para a menor. O desempate é determinístico: nome e depois id.
2. **Distribuição em serpentina:** equipes 1→k, depois k→1, e assim por diante.
3. **Melhoria local:** repete enquanto houver ganho, no máximo 2.000 iterações. Para cada par de equipes e cada par de integrantes, troca os dois se isso **diminuir a diferença entre a maior e a menor média** de força. Num empate, escolhe a troca que mais diminui a variância.
4. Resultado: a lista de equipes, com a "força média" de cada uma, que o professor vê e pode mudar.

- **Complexidade:** O(n log n) para ordenar, mais O(iterações·n²) na melhoria. Com n ≤ 40, leva bem menos de 10 ms.
- **Segurança:** roda **só no servidor**, numa transação que grava as equipes e o "snapshot" da força usada. Para recalcular, o professor clica em "🔄 Rebalancear" (só na sala de espera).

**Exemplo em Duplas (A 950, B 820, C 600, D 450):**
- Ordem de força: A, B, C, D.
- Serpentina: Equipe 1 = A + D = 1.400 e Equipe 2 = B + C = 1.420.
- Diferença de 20, e nenhuma troca melhora.
- Agrupar por ordem (A + B contra C + D, 1.770 × 1.050) é o que o sistema evita.

**Exemplo em Duas Equipes com 7 educandos (forças 95, 90, 80, 60, 55, 40, 20):**
- Serpentina: A = 95, 60, 55, 20 → média 57,5; B = 90, 80, 40 → média 70.
- A troca 60 ↔ 40 dá A = 95, 40, 55, 20 → média 52,5 (pior).
- A troca 20 ↔ 40 dá A = 95, 60, 55, 40 → média 62,5 e B = 90, 80, 20 → média 63,3. Diferença de 0,8, e é essa a escolhida.

### 4.3 Balanceamento desligado

O professor arrasta os nomes entre equipes na sala de espera ou usa "🎲 Sortear". O servidor confere os limites de tamanho do formato.

**Quem entra depois do início:**
- **Solo:** entra na próxima rodada com 0 pontos e aparece na classificação.
- **Equipes:** vai para a equipe com **menos integrantes**; no empate, para a de menor força média. Só passa a jogar na **próxima rodada**, e a média da equipe absorve a chegada sem distorcer o resultado.

**Quem sai ou cai:** continua na equipe como ausente. Os confrontos em andamento nunca mudam de composição.

---

## 5. Pontuação global e ranking (vale para a plataforma toda)

### 5.1 Pontos, estrelas ou os dois?

**Recomendação: os dois, com papéis diferentes.**
- **Estrelas ⭐** continuam como estão: de 0 a 3 por fase, com o melhor resultado guardado, como as crianças já conhecem.
- **Pontos 🏅** são um número único para a plataforma toda, **derivado das estrelas**. Uma fase vale `melhores estrelas × 10 × tier`:
  - uma fase difícil vale mais que uma fácil (tier 4 com 3 ⭐ = 120; tier 1 com 3 ⭐ = 30);
  - **repetir uma fase só soma pontos se melhorar as estrelas.** Treinar continua livre, gera histórico e não infla o ranking. É a regra contra repetição: nada é proibido, mas o que conta é o **melhor resultado por fase**;
  - qualquer jogo novo entra sozinho: basta ter estrelas e tier por fase;
  - pode ser **calculado a partir do que já existe** (`game_progress.levels[*].stars`), então todos começam com os pontos de tudo o que já fizeram.
- **Pontos da maratona** (3/1/0) são **outra escala, guardados à parte**. Eles **não** entram nos pontos globais; os globais só sobem com as estrelas das fases jogadas na maratona.

### 5.2 Registro e proteção contra duplicação [alterar]

**Em `game_results`**, entram as colunas:
- `attempt_id TEXT`: identificador da tentativa, gerado pelo navegador **no início** da rodada e mandado junto com o resultado;
- `source TEXT`: `'livre'` ou `'maratona'`;
- `marathon_entry_id INTEGER NULL`;
- `points_delta INTEGER`: quanto essa rodada somou aos pontos globais (0 quando não melhorou).

**A trava:** um índice `UNIQUE (student_id, game_id, attempt_id)`. Um reenvio da caixa de saída, um duplo clique ou uma requisição repetida **não grava de novo**: o servidor reconhece a tentativa e devolve o mesmo resultado (resposta idempotente).
- **Navegadores com a versão antiga, sem `attempt_id`:** nos jogos com semente, o servidor usa `levelId:seed` como `attempt_id`, porque a semente é um sorteio de 32 bits por rodada.

**Cache de pontos:** uma tabela nova `student_points (student_id, game_id, points, levels_done, updated_at)`, PK `(student_id, game_id)`.
- É atualizada **dentro da mesma transação** de `recordResult`.
- Pode ser recalculada do zero a partir de `game_progress` (script de migração e botão do professor).
- Serve só para o ranking ser rápido; ela não guarda nada que não esteja em outro lugar.
- **Juntar contas** (`teacher.mergeStudents`) passa a recalcular os pontos do educando de destino.

### 5.3 Consultas novas

| Endpoint | Quem | O que devolve |
|---|---|---|
| `GET /api/me/points` | educando | pontos por jogo, total e posição na turma, se a decisão D1 permitir |
| `GET /api/me/history?game=&limit=` | educando | últimas rodadas de `game_results` |
| `GET /api/teacher/ranking?class=&game=&period=` | professor | ranking calculado de `student_points` (geral, por turma ou por jogo) e evolução no período (soma de `points_delta`) |
| `GET /api/teacher/students/:id/history` | professor | histórico completo de um educando |

### 5.4 Como os jogos passam a registrar

- **Nenhuma mecânica muda.** Só as telas comuns (PuzzleShell, BoardGame, Cadentes) e as 3 telas próprias (Matemática, Click e Teclado Mágico) passam a criar um `attemptId` no início da rodada e mandá-lo no corpo do POST que já existe.
- O `tier` de cada fase fica no próprio `levels.js` (6.3), que o servidor já carrega.

---

## 6. Integração com os jogos existentes

### 6.1 Adaptador por jogo [novo, pequeno]

No módulo de servidor de cada jogo (`src/games/<id>/server.js`), entra um campo `marathon`:

```js
marathon: {
  kind: 'corrida' | 'duelo',
  // fases que podem cair: { id, tier, estMs, elegivel }
  levels() { ... },              // a partir de Levels.LEVELS (+ tier)
  // corrida: o resultado já validado vira desempenho
  perf(result, level) { return { concluiu, estrelas, qualidade, tempoMs }; },
  // duelo: a variante do match.js e o tempo máximo
  duel?: { variant(level), maxMs },
}
```

- **O que fica em comum:** a Maratona só conversa com essa interface. Um **jogo novo entra** escrevendo `levels()` e `perf()`; quem usa uma das telas comuns ganha o resto de graça.
- **Montagem:** um módulo novo `src/marathon/catalog.js` monta o catálogo a partir de `registry.games.filter(g => g.server && g.server.marathon && g.status === 'active')`. **Nada é escrito à mão:** um jogo sem `marathon` simplesmente não aparece.

### 6.2 Situação de cada jogo

| Jogo | Tela | Tipo na Maratona | Conclusão detectada por | Validação no servidor | Qualidade (0..1) | Adaptações |
|---|---|---|---|---|---|---|
| Memória | PuzzleShell | corrida | todos os pares achados | **forte** (refaz as cartas viradas) | pares ÷ tentativas | excluir mm6 (contra o robô) |
| Torre de Hanói | PuzzleShell | corrida | torre no destino | **forte** | mínimo ÷ movimentos | excluir as fases longas (estMs) |
| Carrinhos | PuzzleShell | corrida | carro vermelho saiu | **forte** | mínimo ÷ jogadas | — |
| Labirinto | PuzzleShell | corrida | chegou na saída | **forte** | mais curto ÷ passos | — |
| Pixel Art | PuzzleShell | corrida | desenho completo | **forte** | 1 ÷ (1 + erros ÷ casas) | — |
| Encontre a Diferença | PuzzleShell | corrida | todas as diferenças achadas | **forte** | 1 ÷ (1 + erros) | dicas contam (já limitadas) |
| Quebra-cabeça | PuzzleShell | corrida | todas as peças | **fraca** (só tempo e peças) | par ÷ tempo (máx. 1) | ver D4 |
| Dinheiro e Troco | PuzzleShell | corrida | todas as tarefas | **forte** | pontos ÷ tarefas | — |
| Balança | PuzzleShell | corrida | todas as tarefas | **forte** | 1 ÷ (1 + extra ÷ tarefas) | — |
| Conta Comigo | própria | corrida | 10 contas respondidas | **forte** (refaz pela semente) | acertos de primeira ÷ contas | sem as contas de revisão (as duas crianças precisam das mesmas contas) |
| Números Cadentes | Cadentes | corrida | todas as peças passaram | **média** (o navegador diz quais caíram) | pegas × precisão | desligar as peças especiais ou semeá-las (L6) |
| Letras Cadentes | Cadentes | corrida | idem | **média** | pegas × precisão | idem |
| Click | própria | corrida | todos os alvos | **média** | acertos × precisão | mouse obrigatório (aviso) |
| Teclado Mágico | própria | corrida | texto digitado | **fraca** hoje | precisão × (ppm ÷ alvo da fase, máx. 1) | **recomendação: usar o motor do Desafio no servidor** (teclas conferidas lá) e semear o `Content.generate` |
| Velha | BoardGame | duelo | `state.result` | **forte** (`match.js` é o juiz) | — | duelo direto |
| Ligue 4 | BoardGame | duelo | idem | **forte** | — | — |
| Dama | BoardGame | duelo | idem | **forte** | — | tempo máximo e regra 8.5 |
| Xadrez | BoardGame | duelo (partida) e corrida (Fim de partida) | idem | **forte** | estrelas e lances do Fim de partida | partida completa só no nível 4 e com tempo (D3) |
| Bingo, Desafio | salas da turma | **fora** | — | — | — | já são atividades da turma inteira |

### 6.3 Classificação de dificuldade (`tier`)

**Regra padrão**, para jogos em que a ordem das fases já é a ordem de dificuldade (Teclado, Letras, Números, Dinheiro, Balança, Click, Hanói, Carrinhos, Labirinto, Pixel, Diferenças, Quebra-cabeça):

```
tier = ceil(4 × (posição da fase no jogo + 1) ÷ total de fases)
```

**Exceção explícita** (campo `tier` no mundo ou na fase do `levels.js`), onde os mundos são assuntos:
- **Matemática:** figurinhas = 1. Adição e subtração: até 20 = 1, dezena = 2, centena e milhar = 3. Multiplicação: tabuadas = 2, números maiores = 3. Conta armada = 3. Divisão: tabuada = 2, maiores e com resto = 3. Misturadas = 2 a 3. Negativos, potências, raízes e expressões = 4. Há uma sugestão extra (D2): deixar o professor filtrar **por assunto**, porque "nível 2" em Matemática vai do 1º ao 5º ano.
- **Memória:** pelo número de pares e pelo tipo. mm1a e mm1b = 1, mm1c = 2, mm1d = 3; números = 1 a 2; letras = 1 a 3; palavras = 2 a 3; contas = 2 a 4; contra o robô = fora.
- **Xadrez:** Fim de partida mate em 1 = 2, mate em 2 = 3, rei e dama ou torre = 4, partida = 4.
- **Velha:** 3 × 3 = 1, 4 × 4 = 2.
- **Ligue 4:** Ligue 4 = 2, Ligue 5 = 3.
- **Dama** = 3.

**Elegibilidade:** `elegivel = !contraRobô && estMs ≤ tempo máximo da rodada`.
- O `estMs` é uma estimativa por fase, que pode ser ajustada depois com o tempo médio real de `game_results`.
- **Tempo máximo padrão:** 5 min por rodada (configurável de 2 a 10).

**Um teste automático garante** que toda fase tem tier e que nenhum jogo selecionável fica sem fase elegível em algum nível sem aparecer como desabilitado.

### 6.4 Modo competitivo no navegador [alterar]

O `ctx` do `mountGame` ganha um campo opcional `ctx.competition = { levelId, seed, deadline, attemptId, submit(body) }`. Quando ele existe:

- **PuzzleShell:** não mostra o mapa e abre direto em `start(level)` com a semente recebida, sem sortear outra. Em `finish`, chama `ctx.competition.submit(body)` em vez do `POST /progress`. Não mostra "próxima fase" nem "jogar de novo".
- **Cadentes, Matemática e Click:** o mesmo, com semente fixa. Os Cadentes desligam as peças especiais (ou passam a sorteá-las pela semente).
- **Teclado Mágico:** o texto passa a vir da semente. Se a recomendação for aceita, as teclas vão por socket para o motor do servidor (como no Desafio).
- **BoardGame:** abre a partida pela rede com `matchId` e `variant` dados pela Maratona (o "jogar com um amigo" já existe; só falta a entrada direta).

**Fora da Maratona, nada muda.**

---

## 7. Arquitetura técnica

### 7.1 Visão geral

```
Navegador (professor / educando / telão)
   │  Socket.IO  'mt:*' (tempo real)      HTTP /api (consultas, histórico)
   ▼
src/marathon/socketHandlers.js  ──►  src/marathon/manager.js (máquina de estados, regras)
                                          │   ├─ balance.js   (equipes)
                                          │   ├─ pairing.js   (confrontos)
                                          │   ├─ rotation.js  (jogo e fase)
                                          │   ├─ scoring.js   (notas, pontos, classificação)
                                          │   └─ catalog.js   (jogos e fases a partir do registro)
                                          ▼
                                   src/marathon/store.js (SQLite, transações)
                                          │
              validateResult do jogo ◄────┘  (mesma validação do modo livre)
              progress.recordResult (source = 'maratona')
              match.js (duelos de tabuleiro)
```

### 7.2 Decisões e alternativas

| Decisão | Alternativas | Recomendação e por quê |
|---|---|---|
| Tempo real | Socket.IO, que já existe; SSE com HTTP; polling | **Socket.IO**: já está no servidor e no cliente, tem reconexão e salas, e o time conhece o padrão (`bg:`, `dz:`) |
| Onde fica o estado | Só em memória, como o Bingo; só no banco; os dois | **Banco como fonte da verdade e memória como cache.** Cada mudança de estado é uma transação SQLite; a memória guarda só o que é ao vivo (sockets, timers). Ao reiniciar, a memória é reconstruída do banco |
| Envio do resultado da corrida | HTTP `POST`; socket `mt:result` | **Socket com confirmação (`ack`)** e resposta idempotente. O resultado também vai para `game_results` com `attempt_id` = id da entrada, então um reenvio não duplica |
| Cronômetro | Tempo informado pelo navegador; tempo do servidor | **Servidor:** `startsAt` (largada combinada) e `receivedAt`. O `durationMs` do navegador só serve para a checagem de "tempo possível" que cada jogo já faz |
| Concorrência | Travas, filas | O better-sqlite3 é **síncrono** e o Node tem uma thread: cada evento roda inteiro. Somam-se `db.transaction` para as gravações de várias linhas, **restrições `UNIQUE`** como trava de duplicação e um campo `version` na maratona para recusar comandos antigos (por exemplo, dois cliques em "próxima rodada") |

### 7.3 Eventos de socket (prefixo `mt:`)

| Evento | De → para | Conteúdo |
|---|---|---|
| `mt:create {teacherToken, config}` | professor → servidor | devolve `{ code, masterToken }` |
| `mt:master {code, masterToken}` | professor | reconectar como dono |
| `mt:join {code, studentToken}` | educando | entra ou volta (pelo `student_id`, sem token próprio) |
| `mt:watch {code}` | telão | só leitura (não recebe tokens) |
| `mt:config`, `mt:teams`, `mt:balance`, `mt:start`, `mt:next`, `mt:pause`, `mt:resume`, `mt:end`, `mt:resolve {matchId, outcome, motivo}`, `mt:excuse {studentId}` | professor | ações com `masterToken` e a `version` atual |
| `mt:vote {roundId, gameId}` | educando | voto (pode trocar até fechar) |
| `mt:ready` / `mt:result {entryId, body}` | educando | pronto na largada / resultado da fase |
| `mt:state` | servidor → cada um | estado filtrado: o educando vê a própria entrada; o telão não vê tokens |
| `mt:tick` | servidor | `startsAt`, `deadline` e quem já terminou, para os placares ao vivo |

### 7.4 Segurança e permissões

- **Ações de dono:** exigem o `masterToken` da maratona. No banco fica **só o hash** (sha256).
- **Criar maratona:** exige o `teacherToken` (PIN).
- **Entrar:** exige o `studentToken` válido. Uma entrada (`entry`) só aceita resultado **do próprio educando escalado**, no status `jogando` e antes do prazo mais a tolerância.
- **Validação:** o resultado passa pelo `validateResult` do jogo **com a fase e a semente da rodada injetadas pelo servidor**. O navegador não escolhe nenhuma das duas.
- **Bloqueio:** um confronto resolvido não aceita mais nada. Uma mudança do professor gera um evento de auditoria e **recalcula** a classificação a partir dos confrontos (os totais são sempre deriváveis).
- **Limites:** até 40 educandos por sala (como o Bingo e o Desafio) e no máximo 20 rodadas. Os textos do professor são limpos como o `cleanText` do Desafio.

### 7.5 Falhas

| Situação | Comportamento |
|---|---|
| Servidor reinicia durante a rodada | Ao subir, carrega as maratonas com status `em_andamento` ou `rodada`. Se o prazo passou enquanto estava fora, ganha **mais 60 s de tolerância**. Os navegadores reconectam sozinhos (como em `bg:rejoin`) e, se a página não foi recarregada, a criança **continua a fase** e manda o resultado |
| Educando recarrega a página no meio | Volta para a mesma entrada. A fase **recomeça com a mesma semente** e o cronômetro do servidor continua correndo, então perde o tempo, mas não a vaga |
| Educando cai e não volta | Ao fim do prazo, a entrada fica como `tempo_esgotado` (nota 0). Num duelo, vale o abandono do `match.js` (60 s) |
| Resultado enviado duas vezes | O `UNIQUE(match_id, student_id)` e o `attempt_id` fazem o segundo envio devolver o primeiro resultado |
| Professor perde a conexão | A rodada continua. Ele volta com o `masterToken` guardado no navegador; se o PIN expirou, entra de novo no PIN e depois na sala |
| Dois "próxima rodada" ao mesmo tempo | A `version` recusa o segundo |

---

## 8. Rodadas em detalhe

### 8.1 Estados da maratona

`rascunho → sala_de_espera → (votacao →) preparando → disputa → apurando → entre_rodadas → … → encerrada` (e também `pausada` e `cancelada`)

### 8.2 Uma rodada

1. **Escolha:** pela rotação (com votação, se for o caso). O jogo, a fase e a semente são gravados.
2. **Pareamento:** confrontos gravados; o descanso é registrado.
3. **Largada:** `startsAt = agora + 5 s`, enviado a todos com a diferença de relógio de cada cliente. A tela mostra "3, 2, 1".
4. **Disputa:** cada entrada passa de `jogando` para `concluida`. O placar ao vivo mostra **quem terminou**, sem mostrar notas até o fim, para não pressionar.
5. **Apuração:** quando todos concluíram ou o prazo acabou, calcula notas, vencedores e pontos **numa transação**.
6. **Entre rodadas:** resultado de cada confronto, classificação com setas de sobe e desce, e a próxima rodada (manual ou automática em X s).

### 8.3 Prazo da rodada

`min(tempo configurado, 1,5 × estMs da fase)`, entre 2 e 10 min.

### 8.4 Corrida: quem não termina

- Nota 0.
- Se **ninguém** dos dois lados terminou, é **empate** (1 ponto para cada).

### 8.5 Duelo: tempo esgotado

- **Velha e Ligue 4:** viram empate (raramente chegam ao limite).
- **Dama e Xadrez:** vence quem tiver mais material:
  - Dama: pedra = 1 e dama = 3;
  - Xadrez: a tabela de valores que o robô já usa;
  - se a diferença for menor que uma pedra ou um peão, é empate.

### 8.6 Ninguém joga fases de novo

A rodada é uma tentativa única. Recomeçar a fase só acontece quando a página é recarregada (seção 7.5), e o tempo continua contando.

---

## 9. Modelo de dados proposto [novo]

São 8 tabelas com prefixo `mt_`, mais 3 colunas em `game_results` e 1 tabela de cache de pontos.

```sql
mt_marathons (
  id INTEGER PK, code TEXT UNIQUE, name TEXT,
  status TEXT,                     -- estados da seção 8.1
  config_json TEXT,                -- jogos, formato, nível, rotação, rodadas, opções
  master_hash TEXT,                -- sha256 do masterToken
  version INTEGER NOT NULL DEFAULT 0,
  current_round INTEGER, seed INTEGER,
  created_at, started_at, ended_at
)
mt_teams (
  id INTEGER PK, marathon_id → mt_marathons, name, color, icon, position,
  points, wins, draws, losses, perf_for, perf_against   -- derivados (recalculáveis)
)
mt_participants (
  marathon_id, student_id → students, team_id → mt_teams NULL,
  status TEXT ('ativo'|'reserva'|'ausente'|'dispensado'),
  strength REAL,                   -- força usada no balanceamento (snapshot)
  joined_at, left_at,
  PRIMARY KEY (marathon_id, student_id)
)
mt_rounds (
  id INTEGER PK, marathon_id, number,
  game_id, level_id, seed, chosen_by TEXT ('ordem'|'sequencial'|'aleatorio'|'votacao'|'professor'),
  status TEXT ('votacao'|'preparando'|'disputa'|'apurada'|'anulada'),
  starts_at, deadline_at, ended_at,
  UNIQUE (marathon_id, number)
)
mt_matches (                       -- confrontos
  id INTEGER PK, round_id, side_a INTEGER → mt_teams, side_b INTEGER NULL (descanso),
  kind TEXT ('corrida'|'duelo'),
  status TEXT ('aberto'|'resolvido'|'anulado'),
  outcome TEXT ('a'|'b'|'empate'|'descanso'|'wo_a'|'wo_b'|'nulo'),
  score_a REAL, score_b REAL, time_a INTEGER, time_b INTEGER,
  resolved_by TEXT ('auto'|'prazo'|'professor'), resolved_at,
  bg_match_id TEXT NULL            -- duelos: id do match.js
)
mt_entries (                       -- participação individual num confronto
  id INTEGER PK, match_id, student_id, team_id, opponent_student_id NULL (duelo),
  status TEXT ('escalado'|'jogando'|'concluida'|'tempo_esgotado'|'ausente'|'dispensado'),
  result_json TEXT, stars INTEGER, quality REAL, score INTEGER, time_ms INTEGER,
  game_result_id INTEGER NULL → game_results(id),
  submitted_at,
  UNIQUE (match_id, student_id)
)
mt_votes (round_id, student_id, game_id, voted_at, PRIMARY KEY (round_id, student_id))
mt_events (                        -- auditoria
  id INTEGER PK, marathon_id, round_id NULL, at, actor TEXT ('sistema'|'professor'|student_id),
  type TEXT, payload_json TEXT
)

-- pontuação global
ALTER TABLE game_results ADD attempt_id TEXT, source TEXT DEFAULT 'livre',
                            marathon_entry_id INTEGER, points_delta INTEGER DEFAULT 0;
CREATE UNIQUE INDEX ux_results_attempt ON game_results(student_id, game_id, attempt_id);
student_points (student_id, game_id, points, levels_done, updated_at, PRIMARY KEY (student_id, game_id))
```

**Índices:** `mt_rounds(marathon_id)`, `mt_matches(round_id)`, `mt_entries(student_id)`, `mt_events(marathon_id, at)` e `student_points(points)`.

**O que fica separado:**
1. pontos globais: `student_points` e `game_results.points_delta`;
2. desempenho individual na maratona: `mt_entries`;
3. pontos da equipe: `mt_teams`, derivados de `mt_matches`;
4. resultados dos confrontos: `mt_matches` e `mt_entries`;
5. classificação final: `mt_teams.position`, congelada ao encerrar, com o snapshot em `mt_events` ('final').

**Sem redundância:** os educandos ficam em `students`, as rodadas jogadas em `game_results` e as partidas de tabuleiro em `match.js`.

**Auditoria:** a classificação é sempre `f(confrontos resolvidos)`. Um script refaz tudo a partir de `mt_matches` e `mt_entries` e compara com os totais gravados.

---

## 10. Telas e experiência

| # | Tela | Quem | Estados e tempo real |
|---|---|---|---|
| 1 | Cartão "🏃 Maratona" no painel e na área do professor | todos | o educando vê "Entrar com código" |
| 2 | Criação e configuração | professor | os jogos vêm do catálogo, com tiers e motivo de desabilitado; uma prévia diz "≈ N fases elegíveis por jogo" |
| 3 | Entrada | educando | código ou QR Code, igual ao Bingo; erro amigável quando a sala está cheia ou já acabou |
| 4 | Sala de espera | todos | lista ao vivo com bichinhos; o telão mostra o código grande |
| 5 | Equipes | professor (edita), educando (vê a sua) | arrastar e soltar (no celular, tocar em dois nomes troca os dois), "Balancear", "Sortear", força média de cada equipe |
| 6 | Preparação da rodada | todos | cartão do jogo, nome da fase, "Você × Fulano" ou "Equipe Girassol × Equipe Foguete", contagem regressiva |
| 7 | Disputa | educando | o jogo ocupa a tela; uma faixa no topo mostra o tempo restante e "✔ 3 de 4 terminaram" |
| 7b | Acompanhamento | professor e telão | grade de confrontos com quem está jogando, terminou ou caiu |
| 8 | Resultado do confronto | todos | quem venceu, notas lado a lado e estrelas de cada integrante |
| 9 | Classificação intermediária | todos | tabela com animação de posição (setas ▲▼) |
| 10 | Votação | educando | 3 cartões grandes com contagem regressiva; o telão mostra os votos subindo |
| 11 | Ranking final | todos (o telão é o principal) | ver abaixo |

### 10.1 Ranking final animado [novo]

- **Revelação de trás para frente:** cada posição entra com um "slide e pulo" a cada 0,8 s, e os números de pontos sobem contando.
- **Rufar e pausa antes do 1º lugar**, depois o **pódio** (se houver 3 ou mais lados): os blocos crescem de baixo para cima, com o 2º, o 3º e o 1º no centro.
- **Campeão:** coroa 👑, luz em feixe (gradiente animado com CSS), confete (`fx.confetti`, que já existe) e fanfarra (`sound.play('fanfare')`).
- **Para cada lado:** pontos, V/E/D e a melhor rodada.
- **Destaques individuais:**
  - ⭐ mais estrelas;
  - ⚡ mais rápido (menor tempo médio);
  - 🎯 mais preciso (maior qualidade);
  - 📈 quem mais pontuou acima da própria força estimada.
- **Linha do tempo das rodadas:** jogo, fase e vencedores.
- **Desempenho:** só CSS `transform` e `opacity`, sem bibliotecas novas. Respeita `prefers-reduced-motion` (mostra direto, sem animação). O telão em 16:9 e o celular em coluna.
- **Fica salvo:** "Maratonas anteriores" na área do professor reabre a mesma tela a partir do banco. Opção: link para o educando rever.

**Navegação:** o jogo `maratona` é `persistent` (como o Bingo): a tela não recarrega, o estado vem por `mt:state` e o jogo da rodada é montado num contêiner interno com o `mountGame` existente. Isso não sai da página nem refaz requisições.

---

## 11. Plano de implementação por etapas

As dependências reais pedem a pontuação global e a classificação de dificuldade **antes** da sala, porque o balanceamento e a escolha de fases dependem delas.

### Fase 1: Resultados confiáveis e pontos globais
- **Arquivos:**
  - [alterar] `src/platform/progress.js` (attempt_id, idempotência, points_delta, student_points na transação), `src/platform/db.js` (migrações), `src/platform/routes.js` (endpoints 5.3), `src/platform/teacher.js` (merge recalcula pontos; tela de ranking);
  - [alterar] `public/js/platform/api.js` (manter o attemptId no reenvio), `puzzleshell.js`, `boardgame.js`, e os `game.js` de letras, números, matemática, click e digitação (criar o attemptId);
  - [novo] `src/platform/points.js` (regra de pontos), `scripts/recalcular-pontos.js`.
- **Pronto quando:**
  - reenviar o mesmo resultado não duplica;
  - os pontos batem com as estrelas de `game_progress` de todos os educandos;
  - os testes atuais continuam passando.

### Fase 2: Dificuldade e catálogo
- **Arquivos:** [alterar] os 18 `levels.js` (tier e estMs onde a regra padrão não serve) e os 18 `server.js` (adaptador `marathon`); [novo] `src/marathon/catalog.js`.
- **Pronto quando:** um teste garante tier em toda fase, pelo menos 1 fase elegível por jogo em algum nível, e a lista de fases elegíveis por jogo e nível.

### Fase 3: Modo competitivo dentro dos jogos (navegador)
- **Arquivos:** [alterar] `puzzleshell.js`, `cadentes.js`, os `game.js` de letras e números, `matematica/game.js`, `click/game.js`, `digitacao/game.js` e `content.js` (semente), `boardgame.js` (entrada direta numa partida); `match.js` (criar um duelo entre dois educandos escolhidos e avisar quem venceu).
- **Pronto quando:** para cada jogo, um teste abre a fase X com a semente S, joga automaticamente e o servidor valida com a mesma S. Fora do modo competitivo, nada muda.

### Fase 4: Núcleo da maratona (servidor, sem interface)
- **Arquivos:** [novo] `src/marathon/store.js`, `manager.js`, `balance.js`, `pairing.js`, `rotation.js`, `scoring.js` e `src/games/maratona/server.js` (o registro chama o manager).
- **Pronto quando:** testes puros cobrem as máquinas de estado, o balanceamento, os pareamentos, a rotação e votação, as notas e pontos, o desempate e a retomada a partir do banco.

### Fase 5: Tempo real
- **Arquivos:** [novo] `src/marathon/socketHandlers.js` (eventos `mt:*`, prazos, reconexão, telão); [alterar] `server.js` (registrar e retomar no boot).
- **Pronto quando:** o teste de integração com 2 a 8 sockets simulados completa uma maratona inteira, com queda, reconexão e reinício do manager no meio.

### Fase 6: Interface
- **Arquivos:** [novo] `public/games/maratona/` (`view.html`, `maratona.css`, `master.js`, `player.js`, `screen.js`, `runner.js` que monta o jogo da rodada, `session.js`); [alterar] `registry.js` (entrada `maratona` com `teacherTool`), `router.js` (`?sala=`).
- **Pronto quando:** professor, educando e telão funcionam no computador e no celular (375 px).

### Fase 7: Ranking final animado e histórico
- **Arquivos:** [novo] `public/games/maratona/finale.js` e `finale.css`; [alterar] `public/js/platform/teacher.js` ("Maratonas anteriores").
- **Pronto quando:** a animação flui num computador fraco (sem queda perceptível de quadros), respeita o movimento reduzido e reabre a partir do banco.

### Fase 8: Testes finais e testes com a turma
- Ver a seção 12. Depois, um teste numa aula real com poucas rodadas.

**Dependências:** 1 → 2 → 3 → 4 → 5 → 6 → 7. A Fase 4 pode começar em paralelo com a 3, porque ambas dependem só da 2.

---

## 12. Plano de testes

| Área | Casos |
|---|---|
| Pontos globais | melhorar as estrelas soma a diferença; repetir sem melhorar soma 0; o reenvio com o mesmo attempt_id não duplica; juntar contas recalcula; o script de recálculo bate com o incremental |
| Dificuldade | toda fase tem tier; o nível 1 só traz tier 1; o nível 4 traz todas as elegíveis; jogo sem fase elegível aparece desabilitado |
| Balanceamento | os exemplos da seção 4; quem não tem histórico recebe a mediana; os tamanhos s ou s + 1; resultado determinístico com a mesma entrada; diferença de médias ≤ ao da serpentina |
| Pareamento | todos contra todos sem repetir; suíço sem revanche enquanto houver opção; descanso rotativo; o mesmo número de partidas por lado |
| Rotação | o saco não repete antes de esvaziar; nunca o mesmo jogo duas vezes seguidas; votação com empate, sem votos e com troca de voto |
| Pontuação | vitória, empate, derrota, W.O. e descanso; notas com a margem de 4; desempate pelo tempo; ausente = 0; desempate na classificação em todos os níveis |
| Segurança | resultado com outra semente ou outra fase é recusado; resultado de quem não é da entrada é recusado; envio depois do prazo mais a tolerância é recusado; confronto resolvido não muda; ação de dono sem masterToken é recusada; o telão não recebe tokens |
| Concorrência | dois resultados simultâneos da mesma entrada; dois "próxima rodada"; o professor resolve enquanto chega um resultado |
| Falhas | queda e volta do educando; reload no meio da fase; reinício do servidor no meio da disputa e entre rodadas; o professor reconecta |
| Compatibilidade | para os 18 jogos: abrir uma fase com uma semente no modo competitivo e validar no servidor; o modo livre continua igual (os 16 conjuntos de testes atuais) |
| Interface | 375 px, tablet e telão 16:9; movimento reduzido; navegação pelo teclado nas telas do professor |
| Carga | 40 educandos e 20 confrontos simultâneos (como o `test/load.test.js` atual) |

---

## 13. Riscos técnicos e decisões pendentes

### 13.1 Decisões tomadas (15/10/2026)

| # | Decisão | Escolha |
|---|---|---|
| D1 | Quem vê o ranking global | **Qualquer um pode olhar.** O ranking completo (geral, por turma e por jogo) fica aberto a quem está logado: educandos e professor |
| D2 | Matemática por assunto | **O professor escolhe os assuntos** (os mundos) da Matemática na configuração da maratona. Isso vale também para outros jogos grandes, se fizer sentido |
| D3 | Xadrez completo e Dama | **Sim**: entram com prazo e decisão por material (8.5), só no nível 4. O Fim de partida entra a partir do nível 2 |
| D4 | Jogos com validação fraca | Como recomendado: entram; o Quebra-cabeça fica desligado por padrão |
| D5 | Integrante ausente | **Como recomendado**: conta 0, e o professor pode "dispensar" (sai da média) quem faltou por motivo justo |
| D6 | Jogos de teclado em tablets | Como recomendado: aviso na configuração |
| D7 | A maratona conta no progresso normal | Como recomendado: sim, com `source = 'maratona'` |
| D8 | Conta de professor | Como recomendado: o PIN continua, e o dono da sala é quem tem o masterToken |
| D9 | Passar de rodada | **Como recomendado**: manual por padrão, com opção de automático em 20 s |
| D10 | Limites | Como recomendado: até 40 educandos e até 20 rodadas |

### Andamento

- **Fase 1, pontos globais e ranking: ✅ feita.** Inclui:
  - pontos derivados das estrelas;
  - proteção contra rodada duplicada (`attempt_id` mais uma impressão digital para navegadores antigos);
  - `student_points`;
  - endpoints `/api/ranking`, `/api/me/points`, `/api/me/history` e de professor;
  - tela 🏅 Ranking;
  - selo de pontos no painel.

  A dificuldade das fases (`tier`) usa a regra padrão (posição da fase no jogo). A Fase 2 ajusta Matemática, Memória e Xadrez e aumenta `POINTS_VERSION`, e os pontos são refeitos sozinhos.
- **Fase 2, dificuldade e catálogo: ✅ feita.** Inclui:
  - **dificuldade própria** em Matemática (pelo conteúdo: figurinhas e até 20 = 1; dezena, tabuadas e divisão da tabuada = 2; centena, milhar, conta armada e números maiores = 3; negativos, potências, raízes e expressões = 4), Números Cadentes (por mundo), Memória (tipo de par e número de cartas) e tabuleiros (força do robô; Fim de partida: mate em 1 = 2, mate em 2 = 3, finais = 4). Os outros jogos seguem a regra padrão. `POINTS_VERSION = 2`;
  - **um adaptador `marathon` em cada um dos 18 jogos**, com o tempo estimado, o que fica de fora, a qualidade e a força da validação; nos tabuleiros, também os duelos;
  - **`src/marathon/catalog.js`**: o catálogo montado a partir do registro, as fases que podem cair (nível, assuntos e tempo da rodada), a situação de cada jogo (com o motivo quando não tem fase) e a nota de desempenho (`perf`);
  - **API do professor**: `/api/teacher/maratona/catalogo` e `/api/teacher/maratona/catalogo/:jogo`;
  - **teste**: `test/maratona-catalogo.test.js`.

  **Fases que podem cair, com rodada de 5 min:**

  | Nível | Fases |
  |---|---|
  | 1 | Ligue 4, Dama e Xadrez ficam desabilitados ("não tem fases no nível 1") |
  | 2 | Velha 3 × 3 e 4 × 4, Ligue 4 e o Xadrez mate em 1 entram |
  | 3 | Velha só 4 × 4, Ligue 4 e Ligue 5, Xadrez mate em 1 e em 2 |
  | 4 | tudo; Dama e a partida completa de xadrez só aqui |
- **Fase 3, modo competitivo dentro dos jogos: ✅ feita.** Inclui:
  - **`js/shared/competition.js`**: com `ctx.competition` (`levelId`, `seed`, `submit`, `matchId`, `onDone`), o jogo abre direto na fase da rodada, sem mapa, com a semente do servidor. O resultado vai para `submit` e os botões que saem da disputa (sair, mapa, jogar de novo, próxima fase) somem;
  - **jogos adaptados**:
    - as telas comuns PuzzleShell (9 jogos) e BoardGame;
    - Letras, Números, Matemática (sem as contas de revisão), Click (sempre com cronômetro) e Teclado Mágico (`Content.generate(level, seed)`: o mesmo texto para os dois lados; para no erro e sem maiúsculas forçadas);
    - as peças especiais (sorteadas sem semente) ficam desligadas na disputa;
  - **duelos**: `match.js` ganhou `createDuel` (partida entre dois educandos escolhidos, que entram com `bg:rejoin`), `timeUp` (prazo: Velha e Ligue 4 empatam; Dama e Xadrez pelo material, com `adjudicate` no adaptador) e `onEnd`. O progresso é gravado com `source = 'maratona'`;
  - **`src/marathon/competitive.js`**: confere a corrida com a fase e a semente **impostas pelo servidor**, pelo mesmo `validateResult` do modo livre, e devolve a nota;
  - **teste**: `test/maratona-competicao.test.js` cobre os 15 jogos de corrida (cada um aceito com a semente da rodada e sem nota cheia com outra), o texto do Teclado e os duelos com prazo.
- **Fase 4, núcleo da maratona no servidor: ✅ feita.** Inclui:
  - **`src/marathon/balance.js`**: força pelo percentil dos pontos (quem jogou menos de 5 fases fica na mediana), serpentina mais trocas, sorteio, e para quem chega depois a equipe com menos gente;
  - **`pairing.js`**: todos contra todos até 8 lados, suíço acima disso (sem revanche enquanto der, com limite de tentativas), descanso rotativo, e A × B nas Duas Equipes;
  - **`rotation.js`**: ordem, sequencial, aleatório (saco), votação (3 opções, maioria, empate e sem votos = sorteio) e escolha do professor; a fase sai de um saco das que podem cair;
  - **`scoring.js`**: decisão da corrida (margem de 4 na nota, 10% no tempo), dos duelos por equipe, pontos (3/1/0, descanso 1, W.O. 3, bônus opcional) e classificação com todos os desempates;
  - **`store.js`**: 6 tabelas `mt_*` (os votos ficam no JSON da rodada) e o histórico de eventos;
  - **`manager.js`**: a máquina de estados (criar, entrar, equipes, começar, rodadas, votação, resultado validado, duelos via `match.js`, prazo, ausente ou tempo esgotado, ações do professor, pausa, encerrar e anular, final com pódio e destaques salvos), os relógios (`checkTimers`) e a retomada do banco (`restore`, com 1 min de tolerância);
  - **teste**: `test/maratona-nucleo.test.js`.

  **Adiado:** o índice de maratona (Elo) do balanceamento, que fica para quando houver histórico de maratonas.

  **Ligação com o progresso:** a corrida da maratona vai para o progresso normal com `attempt_id = mt:<entrada>`; essa é a ligação entre `game_results` e `mt_entries`.
- **Fase 5, tempo real: ✅ feita.** Inclui:
  - **`src/marathon/socketHandlers.js`**: os eventos `mt:*` do professor (criar com o token do PIN, voltar com a chave de dono e todas as ações), dos educandos (entrar com o código, votar, mandar resultado, sair) e do telão (só leitura);
  - **`mt:state`**: vai para cada um com a visão certa. A fase e a semente vão só para quem joga, e nada de tokens nem da força de cada um no telão. Várias mudanças seguidas viram um envio só. O estado leva `serverNow` para a contagem;
  - **presença**: conectado ou caiu, ao vivo; a criança que abre a maratona durante a rodada fica marcada como "apareceu", o que separa ausente de tempo esgotado;
  - **ao subir o servidor**: as partidas pela rede e a maratona usam o mesmo gerenciador de duelos; `restore()` e o relógio começam sozinhos;
  - **HTTP**: `GET /api/maratona/:codigo` (o resultado continua disponível depois do fim) e `GET /api/teacher/maratona/historico`. Quem entra numa maratona encerrada só vê o resultado;
  - **teste**: `test/maratona-tempo-real.test.js`, com servidor de verdade e sockets, incluindo reiniciar o servidor no mesmo banco no meio da maratona. O ajudante de testes ganhou `dbFile` e `stop({ keepDb })`;
  - **correção de teste**: o teste do teto de velocidade do Desafio era sensível à lentidão da máquina e agora manda as duas mensagens em seguida.
- **Fase 6, telas: ✅ feita.** Inclui:
  - **`public/games/maratona/`** (`view.html`, `maratona.css`, `common.js`, `player.js`, `master.js`, `screen.js`, `session.js`) e a entrada `maratona` no registro, com `teacherTool`;
  - **criança** (`/jogos/maratona?sala=`): entrar com o código, sala de espera com a equipe, votação, contagem antes da rodada, o jogo da rodada aberto dentro da maratona (com a faixa de rodada, confronto, "x de y terminaram" e relógio), o resultado da rodada com as próprias estrelas e a classificação, e o fim. Volta sozinha se a página recarrega ou a conexão cai;
  - **professor** (`/professor/maratona`):
    - criar a maratona com o catálogo da Fase 2: fases por nível, os assuntos que têm fase naquele nível, avisos de teclado e de conferência fraca, ordem das rodadas e opções;
    - sala de espera com QR Code no endereço da rede;
    - equipes: equilibrar, sortear e trocar alguém de equipe;
    - comando ao vivo: votação com barras, rodada com o status de cada criança, resolver um confronto com motivo, dispensar e readmitir, próxima rodada, pausar e encerrar;
    - histórico das rodadas e "Nova maratona". A chave de dono fica no navegador;
  - **telão** (`/telao/maratona?sala=`): sala de espera com o QR Code, votação, contagem e rodada ao vivo, resultado entre rodadas e o fim;
  - **conferido no navegador** com 1 criança de verdade, 3 crianças simuladas, o professor e o telão. Foram 2 rodadas: votação, Carrinhos jogado com arrastar e Hanói jogado pelo teclado. No meio, o **servidor foi reiniciado** e todo mundo voltou sozinho. As telas de criar, do painel e do resultado cabem em 375 px.
- **Fase 7, ranking final animado: ✅ feita.** Inclui:
  - **`finale.js` e `finale.css`**: o título cai, quem ficou fora do pódio aparece de trás para frente (com os pontos contando), vem o rufar e o pódio sobe (3º, 2º e, depois de uma pausa, o 1º no meio, com coroa, luz girando, fanfarra e duas levas de confete);
  - **depois da festa**: os destaques (⭐ mais estrelas, ⚡ mais rápido, 🎯 mais preciso), a linha do tempo das rodadas e o botão "🔁 Ver a festa de novo";
  - **onde aparece**: na criança (com a equipe dela marcada), no telão (tudo maior) e no painel do professor. Uma atualização do servidor não recomeça a festa;
  - **desempenho e acessibilidade**: só `transform` e `opacity`; com "movimento reduzido" mostra tudo de uma vez. Cabe em 375 px;
  - **área do professor**: "📜 Maratonas anteriores" na tela de criar, que reabre a festa de qualquer maratona encerrada a partir do banco.

  **Não feito:** o destaque "📈 quem mais pontuou acima da própria força", que fica para quando houver o índice de maratona (Elo).
- **Fase 8, testes: ✅ feita** (a parte automática). Inclui:
  - **`test/maratona-regras.test.js`**: os formatos que faltavam (Duas Equipes com 7, Trio e Quarteto com 9) até o pódio; rotação por ordem e escolha do professor; a tolerância do prazo; e, com servidor de verdade, a concorrência (o mesmo resultado duas vezes ao mesmo tempo grava uma vez; dois "próxima rodada" abrem uma rodada só; o professor resolvendo junto com um resultado chegando) e as permissões (votar e mandar resultado só na maratona em que entrou, o telão não comanda, configuração travada);
  - **`test/maratona-carga.test.js`** (`npm run test:carga:maratona`), com 40 crianças no Solo e 20 confrontos na mesma rodada, todas mandando juntas: 40/40 aceitos, mediana de cerca de 40 ms, p95 de cerca de 50 ms por resposta, e o estado novo em todos em cerca de 80 ms;
  - **README** atualizado (Maratona, pontos e ranking, rotas, API e testes);
  - no total são 22 conjuntos no `npm test`.

## 14. Teste com uma turma de verdade (roteiro)

1. **Antes da aula:**
   - configurar o `PROFESSOR_PIN`;
   - abrir `/professor/maratona` no computador do projetor;
   - criar uma maratona curta: 2 ou 3 jogos que a turma já conhece, nível 1 ou 2, Duplas, 3 rodadas, rotação por votação.
2. **Entrada:** as crianças entram pelo QR Code. Confira se o endereço do QR funciona nos aparelhos da escola (é o da rede, não "localhost").
3. **Telão:** abra pelo botão 📺 e deixe no projetor.
4. **O que observar:**
   - se as crianças entendem a contagem e a faixa de cima (tempo, quem terminou);
   - se o tempo da rodada é bom (aumente ou diminua em "Tempo máximo");
   - se a votação empolga ou atrasa;
   - quem fica para trás nas equipes;
   - se a festa do fim funciona no projetor e no som da sala.
5. **Se algo der errado:** o painel do professor tem "resolver o confronto" (com motivo), "dispensar" quem saiu e "encerrar". Se o servidor cair, ele volta de onde parou.
6. **Depois:** a maratona fica em "📜 Maratonas anteriores", e as estrelas das crianças entram no progresso e no ranking.

### 13.2 Riscos

| Risco | Mitigação |
|---|---|
| A classificação de dificuldade parecer injusta para algum jogo | Tiers em dados (fáceis de ajustar), prévia das fases na configuração e ajuste pelo tempo médio real |
| A rede da escola atrasar a largada | Largada combinada por `startsAt` com correção do relógio, e tempo medido pelo servidor com margem de 10% |
| Reload no meio de uma fase longa | Prazo curto por padrão (5 min) e fases longas fora da elegibilidade |
| Telas próprias (Matemática, Click, Teclado) mais difíceis de adaptar que as comuns | Fazer primeiro a PuzzleShell (9 jogos) e os Cadentes. A maratona funciona com os jogos já adaptados, e os outros entram depois |
| Crescimento do banco (eventos e resultados) | Índices e, no futuro, arquivar maratonas antigas |
| Pressão competitiva em crianças | Notas só no fim da rodada, destaques que premiam esforço (📈) e ranking global restrito (D1) |
