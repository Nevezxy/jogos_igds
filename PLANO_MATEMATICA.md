# 🔢 Plano — Novo jogo de matemática

> **Situação:** implementado. Etapas **A** a **E** concluídas; a conta
> armada (F) e a Corrida da Tabuada com a turma (G) ficaram para depois.
> **Decisões tomadas** (marcadas com **[DECIDIDO]**): o jogo se chama
> **Conta Comigo**; a criança responde pelo teclado numérico (na tela ou o
> físico), com 3 opções para escolher nas primeiras fases com figurinhas;
> todas as fases ficam abertas; a conta armada fica para depois.
>
> **Pedidos depois do plano (feitos):** números negativos, potências e
> raízes nas dificuldades mais altas (mundos 🌡️ Negativos, 🚀 Potências,
> 🌱 Raízes e 🧠 Expressões); muitas fases por nível (142 fases, de 12 a 21
> por mundo; o Teclado Mágico também passou de 58 para 127); e um mapa que
> diferencia as fases feitas, tentadas e pendentes, usado pelos dois jogos.
> A lista definitiva das fases é `public/games/matematica/levels.js`; as
> tabelas da seção 3 são a proposta original.

Pedido: um jogo de matemática com níveis de dificuldade nas quatro operações
(soma, subtração, multiplicação e divisão), começando pela unidade e subindo
para dezena, centena e milhar. Também uma opção que troca os números por
emojis ("3 🍎 + 1 🍎").

Nome: **Conta Comigo** 🔢 **[DECIDIDO]**

---

## 1. Análise do pedido

### 1.1 O que funciona bem como foi pedido
- **Quatro operações em níveis crescentes.** Isso segue a ordem da escola
  (BNCC: adição e subtração no 1º e 2º ano, multiplicação e divisão a partir
  do 2º e 3º).
- **Unidade → dezena → centena → milhar.** É o eixo certo de dificuldade,
  porque acompanha o valor posicional, que é o que a criança está aprendendo.
- **Emojis no lugar dos números.** Para quem ainda está aprendendo a contar,
  ver "3 🍎 + 1 🍎" vale mais do que "3 + 1". É a passagem do concreto para o
  abstrato.
- **A plataforma já tem quase tudo pronto:** contas, progresso, mapa de
  fases, estrelas, área do professor e carregamento sob demanda. O jogo novo
  segue o mesmo contrato do Teclado Mágico (`levels.js` compartilhado entre
  navegador e servidor, `validateResult`, `teacherSummary`).

### 1.2 Problemas e lacunas que encontrei

| # | Problema | Por que importa | Proposta |
|---|----------|-----------------|----------|
| M1 | **Faltam degraus entre "unidade" e "dezena".** "23 + 41" (sem vai-um) e "27 + 45" (com vai-um) são contas de nível bem diferente. | O vai-um (reserva) e o empréstimo (reagrupamento) são a maior dificuldade do 2º ao 4º ano. Sem esse degrau, a criança trava de repente. | Cada ordem de grandeza ganha duas fases: **sem reserva** e **com reserva** (ou com empréstimo, na subtração). |
| M2 | **"Multiplicação de unidade, depois de dezena..." não segue a ordem real.** A tabuada vem em partes, das mais fáceis para as mais difíceis. | ×2, ×5 e ×10 são fáceis; ×7, ×8 e ×9 são difíceis. Juntar tudo numa fase desanima. | Trilha da multiplicação por tabuadas: dobro e ×10 → ×5 → ×3 e ×4 → ×6 → ×7 → ×8 e ×9 → tabuada misturada. Depois, dezena × unidade e centena × unidade. |
| M3 | **Divisão com resto e resultado negativo.** "7 − 9" ou "7 ÷ 2" aparecem se o gerador sortear sem regras. | A criança dos primeiros anos não conhece números negativos nem frações. | Subtração: o resultado é sempre ≥ 0. Divisão: sempre exata (feita como o inverso da tabuada). A divisão com resto vira uma fase própria, no fim da trilha, com dois campos: quociente e resto. |
| M4 | **Emojis só funcionam com números pequenos.** "47 🍎 + 38 🍎" são 85 maçãs na tela, impossível de contar. | Com muitos emojis, a criança conta errado e o modo atrapalha mais do que ajuda. | Até 20: emojis um a um, em grupos de 5 (como num quadro de dez). Na dezena e na centena: **material dourado em emoji** (🟧 = 1 unidade, barra = 1 dezena, placa = 1 centena). Assim o emoji continua ensinando o valor posicional. |
| M5 | **Emojis numa conta escrita com "+" e "−" não mostram o sentido da operação.** "5 🍎 − 2 🍎" é só uma conta com figurinhas. | O valor do emoji é mostrar o que a operação faz. | Cada operação tem um desenho próprio: **soma** junta dois grupos; **subtração** mostra o grupo e risca os que saem (5 maçãs, 2 riscadas); **multiplicação** mostra grupos iguais (3 cestas 🧺 com 4 🍎); **divisão** reparte (12 🍎 entre 3 crianças 🧒). |
| M6 | **Como a criança responde?** O Teclado Mágico pede teclado físico, mas matemática precisa funcionar em tablets e celulares da escola. | Sem teclado na tela, o jogo não roda nos tablets. | **Teclado numérico grande na tela** (0–9, apagar, OK) e também o teclado físico. `requiresKeyboard: false`. Nas primeiras fases com emoji (a1–a4, s1–s3, x1–x2, d1), a resposta também pode ser de **múltipla escolha** (3 opções, com distratores tirados dos erros comuns, como o vizinho e o "esqueceu o vai-um"). **[DECIDIDO]** |
| M7 | **Tempo como pressão.** Cronômetro visível gera ansiedade em matemática, que é a matéria mais associada a medo na escola. | Uma criança ansiosa erra mais, e o jogo vira castigo. | Sem cronômetro na tela. As estrelas dependem dos acertos; só a 3ª estrela pede um tempo médio razoável por conta, e esse tempo nunca aparece como contagem regressiva. No modo emoji, o tempo não conta (contar figurinhas leva tempo). |
| M8 | **"Errado!" sozinho não ensina nada.** | O erro é o melhor momento de aprender. | Errou: a resposta treme, aparece uma dica (por exemplo "Junte as unidades primeiro: 7 + 5 = 12, vai 1") e a criança tenta de novo. No 2º erro, o jogo mostra a resposta e o caminho, e essa conta volta no fim da rodada. |
| M9 | **Contas difíceis voltam ao acaso.** Uma criança que erra 7 × 8 pode não ver essa conta de novo por semanas. | Repetir o que errou é o que fixa a tabuada. | Guardar os **"fatos que mais erra"** (como as "teclas com mais erro" do Teclado Mágico). As próximas rodadas trazem esses fatos com mais frequência, e o professor vê a lista. |
| M10 | **A conta só deitada (23 + 45 = ?) não é como a escola ensina a partir da dezena.** | No caderno, a criança faz a **conta armada** (em pé), da direita para a esquerda, com o vai-um em cima. | Fases de dezena e centena com a opção de **conta armada**: a criança digita algarismo por algarismo, da unidade para a centena, com uma casinha para o vai-um. É a maior tarefa do plano: fica para depois desta versão (etapa F). **[DECIDIDO]** |
| M11 | **Validação no servidor.** No Teclado Mágico, o servidor confere a velocidade. Aqui dá para conferir mais. | Sem isso, uma criança esperta (ou um script) manda "10 de 10 em 1 segundo". | O cliente manda as contas e as respostas. O servidor **refaz cada conta**, confere se ela pertence à fase (mesmo `levels.js` e mesmo gerador, compartilhados) e recalcula os acertos. Também recusa tempos impossíveis (menos de 0,8 s por conta). |
| M12 | **Criança que ainda não lê bem.** | No 1º ano, muitas crianças não leem o enunciado nem a dica. | Botão 🔊 que lê a conta e a dica em voz alta (`speechSynthesis` em pt-BR, que funciona sem internet no Windows). |

### 1.3 Ideias que vão além do pedido (opcionais)
- **Número que falta:** "3 + ? = 7". É o começo do pensamento algébrico (BNCC, 1º ano em diante). Entra como fase em cada trilha.
- **Qual é o sinal?:** "6 ? 3 = 18". Treina reconhecer as operações.
- **Situações-problema curtas com emoji:** "Ana tinha 5 🍬 e ganhou 3. Quantas tem agora?" Ficam para depois, porque pedem um banco de textos.
- **Corrida da Tabuada com a turma toda:** o mesmo esquema do Desafio de Digitação (sala, QR code, telão, pódio), mas com contas. Quase todo o servidor do Desafio se reaproveita. É um plano à parte, depois deste.

---

## 2. A tela do jogo

```
┌────────────────────────────────────────────────────────────┐
│ ← Mapa      ➕ Adição · Dezena com vai-um     ●●●●●○○○○○  🔊 │
│                                                            │
│                  ┌───────────────────────┐                 │
│                  │      27  +  45  =  ?  │                 │
│                  └───────────────────────┘                 │
│   (modo emoji: 🟧🟧 ▮▮ + 🟧🟧🟧🟧 ▮▮▮▮ ... material dourado)  │
│                                                            │
│                       [   7 2   ]                          │
│                                                            │
│            ┌───┬───┬───┐                                   │
│            │ 7 │ 8 │ 9 │      🙂 Bingolino: "Junte as      │
│            │ 4 │ 5 │ 6 │       unidades primeiro!"         │
│            │ 1 │ 2 │ 3 │                                   │
│            │ ⌫ │ 0 │ OK│                                   │
│            └───┴───┴───┘                                   │
└────────────────────────────────────────────────────────────┘
```

- **Uma rodada = 10 contas**, com a barra de bolinhas mostrando o andamento
  (verde = acertou de primeira, amarela = acertou na 2ª tentativa, vermelha =
  viu a resposta).
- **Fim da rodada:** estrelas, acertos, as contas que errou com a resposta
  certa e os botões "Jogar de novo" e "Próxima fase", como no Teclado
  Mágico.
- **Mapa:** igual ao do Teclado Mágico, com um mundo por operação.
- **Opções no mapa** (guardadas no navegador, como "Apenas maiúsculas"):
  🍎 **Usar emojis** (e o tema: frutas, bichos, doces, bolas, estrelas) e
  🔊 **ler em voz alta**.

---

## 3. Mundos e fases

Cada fase tem regras exatas para o gerador: faixa dos números, se tem vai-um
ou empréstimo, e quais tabuadas entram. Assim o servidor consegue conferir se
uma conta pertence à fase. São cerca de 50 fases.

### ➕ Mundo 1 — Adição
| Fase | Conteúdo | Exemplo | Emoji |
|------|----------|---------|-------|
| a1 | Somas até 5 | 2 + 1 | um a um |
| a2 | Somas até 10 | 4 + 5 | um a um |
| a3 | Amigos do 10 (pares que dão 10) | 7 + ? = 10 | quadro de dez |
| a4 | Somas até 20 (passando do 10) | 8 + 5 | quadro de dez |
| a5 | Dezena + unidade, sem vai-um | 23 + 4 | material dourado |
| a6 | Dezena + dezena, sem vai-um | 23 + 41 | material dourado |
| a7 | Dezena + dezena, com vai-um | 27 + 45 | material dourado |
| a8 | Centena, sem vai-um | 312 + 245 | material dourado |
| a9 | Centena, com vai-um | 358 + 267 | material dourado |
| a10 | Milhar | 1.450 + 2.375 | — |
| a11 | Número que falta | 34 + ? = 50 | — |
| a12 | Revisão da adição | mistura | — |

### ➖ Mundo 2 — Subtração
Os mesmos degraus: até 5, até 10, até 20, dezena sem empréstimo (48 − 23),
**com empréstimo** (52 − 27), centena sem e com empréstimo, milhar, número
que falta e revisão. O resultado nunca é negativo. No emoji, os que saem
aparecem riscados.

### ✖️ Mundo 3 — Multiplicação
| Fase | Conteúdo | Emoji |
|------|----------|-------|
| x1 | Dobro (×2) | 2 grupos iguais |
| x2 | ×10 e ×1 | grupos |
| x3 | ×5 | grupos |
| x4 | ×3 e ×4 | grupos (cestas 🧺) |
| x5 | ×6 | — |
| x6 | ×7 | — |
| x7 | ×8 e ×9 | — |
| x8 | Tabuada misturada (o que a criança mais erra volta mais) | — |
| x9 | ×10, ×100 e ×1000 | — |
| x10 | Dezena × unidade, sem vai-um (21 × 3) | — |
| x11 | Dezena × unidade, com vai-um (27 × 4) | — |
| x12 | Centena × unidade (124 × 3) | — |
| x13 | Revisão | — |

### ➗ Mundo 4 — Divisão
| Fase | Conteúdo | Emoji |
|------|----------|-------|
| d1 | Metade (÷2) | repartir entre 2 🧒 |
| d2 | ÷5 e ÷10 | repartir |
| d3 | Tabuada ao contrário (÷3 a ÷9, sempre exata) | repartir (até 30) |
| d4 | Dezena ÷ unidade, exata (48 ÷ 4) | — |
| d5 | Centena ÷ unidade, exata (369 ÷ 3) | — |
| d6 | **Com resto** (17 ÷ 5 = 3, resta 2): dois campos | repartir e sobra |
| d7 | Revisão | — |

### 🎲 Mundo 5 — Desafios misturados
Todas as operações por ordem de grandeza (unidade, dezena, centena), mais
"qual é o sinal?" e contas em sequência (expressões curtas sem parênteses,
só soma e subtração).

**Liberação das fases [DECIDIDO]:** tudo aberto, como no Teclado Mágico,
com a "próxima fase recomendada" em destaque.

---

## 4. Modo emoji em detalhe

- **Um tema por rodada:** a mesma figura em toda a conta. O plural fica
  certo na leitura em voz alta ("três maçãs mais uma maçã").
- **Temas:** 🍎 frutas, 🐶 bichos, 🍬 doces, ⚽ bolas, ⭐ estrelas. Só emojis
  que aparecem bem no Windows 10 e 11 (nada de bandeiras nem emojis novos
  demais).
- **Contagem fácil:** até 20, os emojis ficam em fileiras de 5, como no
  quadro de dez da escola. Ninguém precisa contar 17 figuras soltas.
- **Material dourado:** 🟧 cubinho (1), barra de 10 cubinhos (10) e placa
  10 × 10 (100), feitos em CSS (não são emojis soltos, para ficarem nítidos
  e alinhados).
- **Limites:** o modo emoji vale até a centena. Em fases sem desenho
  possível (tabuada do 7 com números grandes, milhar), o botão fica apagado
  com a explicação "nesta fase os números ficam grandes demais para
  figurinhas".
- **Resposta:** a criança sempre responde com números. O emoji ajuda a
  pensar, mas a meta é chegar ao número.

---

## 5. Pontuação, estrelas e progresso

- **Estrelas por rodada:** ⭐ 6 ou mais acertos de primeira, ⭐⭐ 8 ou mais,
  ⭐⭐⭐ 9 ou mais e tempo médio dentro do alvo da fase (o alvo não vale no
  modo emoji). Acerto na 2ª tentativa conta meio ponto.
- **Progresso guardado** (`game_progress`, mesmo formato do Teclado
  Mágico): estrelas e melhor resultado por fase, número de rodadas, tempo
  total e `factErrors` (por exemplo `{"7x8": 4, "52-27": 2}`) para os fatos
  que mais erra.
- **Cartão no painel:** "➗ Divisão · Fase 3 · ⭐ 24".
- **Área do professor:** nova coluna com o mundo e a fase atual, estrelas,
  % de acerto e os 5 fatos que mais erra (como as teclas do Teclado Mágico).
  Funciona com o novo filtro por turma.

---

## 6. Arquivos

```
public/games/matematica/
  levels.js     # mundos e fases (UMD: navegador + servidor)
  problems.js   # gerador e verificador de contas por fase (UMD), com sorteio que aceita semente
  emoji.js      # temas e desenhos por operação (grupos, riscados, material dourado)
  keypad.js     # teclado numérico na tela + teclado físico
  speech.js     # leitura em voz alta (speechSynthesis pt-BR)
  game.js       # mapa, rodada, dicas, resultado
  view.html, game.css
src/games/matematica/server.js   # validateResult (refaz as contas), mergeProgress,
                                 # summary, teacherSummary, mergeAccounts, setUnlockedAll
test/matematica.test.js
```

Mais uma entrada em `src/games/registry.js` (`mode: 'solo'`,
`requiresKeyboard: false`, `color: 'green'`) e `GAME_CELLS.matematica` em
`public/js/platform/teacher.js`. O núcleo da plataforma não muda.

---

## 7. Etapas de implementação

| Etapa | O que entra | Resultado visível |
|-------|-------------|-------------------|
| **A** | `levels.js` + `problems.js` (gerador e verificador de todas as fases) + testes | Nada na tela ainda. Os testes garantem as regras: sem negativos, divisão exata, vai-um só onde deve. |
| **B** | Jogo completo sem emoji: mapa, rodada de 10 contas, teclado numérico, dicas, 2ª tentativa, resultado, estrelas e progresso salvo | O jogo aparece no painel e já dá para jogar. |
| **C** | Servidor: validação refazendo as contas, resumo no painel e coluna na área do professor | O professor acompanha a turma. |
| **D** | Modo emoji: temas, grupos, riscados, repartir, quadro de dez, material dourado | O botão 🍎 no mapa. |
| **E** | Fatos que mais erra voltando nas rodadas, leitura em voz alta, número que falta, "qual é o sinal?" | Melhorias pedagógicas. |
| **F** | Conta armada (em pé, com vai-um) nas fases de dezena e centena | Depois desta versão. |
| **G** | (Plano à parte) Corrida da Tabuada com a turma toda | Modo turma. |

Cada etapa termina com os testes passando, conferência no navegador e um
commit. Para jogar, bastam as etapas A, B e C; D é o modo emoji que você
pediu.

### Testes
- **Gerador:** para cada fase, milhares de contas sorteadas respeitam as
  regras (faixa, vai-um, resultado ≥ 0, divisão exata, tabuadas certas).
- **Servidor:** recusa conta que não é da fase, resposta "certa" que está
  errada, tempo impossível e fase inexistente. Recalcula as estrelas.
- **Progresso:** junta contas repetidas (merge), "fatos que mais erra" e
  resumo do professor.

---

## 8. Riscos e cuidados
- **Emojis no Windows antigo:** o Windows 7 não tem emojis coloridos. O
  material dourado é feito em CSS, então não depende disso.
- **Voz:** nem todo computador tem voz em português instalada. Sem voz, o
  botão 🔊 some.
- **Tablets:** o teclado do sistema não pode abrir por cima do jogo. A
  resposta usa um campo próprio (sem `<input>` focado no celular), e só o
  teclado da tela aparece.
- **Sorteio repetido:** numa rodada de 10, a mesma conta não se repete
  (exceto os fatos que mais erra, de propósito).

---

## 9. Fora deste plano (depois)
- Situações-problema com texto.
- Frações, números decimais e dinheiro (troco com moedas e notas em emoji).
- Relógio e medidas.
- Corrida da Tabuada com a turma (etapa G, num plano próprio).

---

## 10. Decisões

1. Nome: **Conta Comigo**.
2. Resposta: teclado numérico (na tela e o físico) em todas as fases, mais
   3 opções para escolher nas primeiras fases com emoji.
3. Fases: todas abertas, com a recomendada em destaque.
4. Conta armada: depois desta versão.
