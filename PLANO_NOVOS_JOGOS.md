# 🖱️ 🔤 🔢 Plano — Click, Letras Cadentes e Números Cadentes

> **Situação:** etapas **A** (motor de queda, Letras Cadentes e o painel por
> assunto), **B** (Números Cadentes) e **C** (Click) concluídas. Falta a D
> (ajuste de ritmo jogando de verdade, no tablet e no celular).
> No Click, em vez de 7 mundos × 12 fases, ficaram 6 mundos e 30 fases, todas
> diferentes, que aceleram durante a rodada (o mesmo princípio dos Cadentes,
> sem fase repetida). O "Montar figuras" virou a fase "Até a sombra".
> Ajustes pedidos depois: sem teclado de ajuda na tela; o céu ocupa a tela
> toda; opção "apenas maiúsculas"; os mundos de letras (meio, cima, baixo) e
> de números viraram um só ("Letras e números", sem separar por fileira nem
> por grupos de números): 6 mundos e 72 fases.
> **Decisões tomadas:** nas "Cadentes" não há game over (a rodada vai até o
> fim e as estrelas dependem de quantas peças a criança pegou); o painel de
> jogos passa a ser separado por assunto; a ordem é Letras Cadentes →
> Números Cadentes → Click.

Três jogos novos, inspirados em atividades do GCompris:

| Jogo | Inspiração no GCompris | O que treina |
|------|------------------------|--------------|
| 🖱️ **Click** | *Erase* (passar o mouse), *Click or tap*, *Double click*, *Click on me* (peixes que nadam), atividades de arrastar | Mover o mouse, clicar, clicar duas vezes, segurar e arrastar |
| 🔤 **Letras Cadentes** | *Simple letters* (gletters) e *Falling words* (wordsgame) | Achar as teclas e digitar letras, sílabas e palavras |
| 🔢 **Números Cadentes** | *Addition/Subtraction/Multiplication/Division of numbers* (algebra_*), *Numbers with dice* e *with dominoes* | Contas de cabeça, com rapidez |

Os três são jogos **solo**, com mapa de fases, estrelas e progresso, e
seguem o mesmo contrato dos jogos que já existem. O núcleo da plataforma não
muda.

---

## 1. O que já existe e será reaproveitado

| Peça | De onde vem | Usada em |
|------|-------------|----------|
| Mapa de fases (feita, tentada, pendente, próxima, etapas e filtro) | `js/shared/levelmap.js` | os três |
| Contas, progresso, estrelas e resumo para o professor | plataforma (`/api/progress`, `teacherSummary`) | os três |
| Captura de teclas com acento (textarea escondido + evento `input`, comparação em NFC) | Teclado Mágico | Letras Cadentes |
| Banco de palavras, sílabas e acentos | `digitacao/content.js` | Letras Cadentes |
| Teclado ABNT2 na tela (com a tecla e o dedo certos) | `digitacao/keyboard.js` e `hint.js` | Letras Cadentes (ajuda opcional) |
| Gerador de contas com semente e limite de números | `matematica/problems.js` | Números Cadentes |
| Teclado numérico na tela | Conta Comigo | Números Cadentes |
| Som, confete, mascote, avisos | `js/shared/` | os três |

**Peça nova compartilhada:** um "motor de queda" (`js/shared/falling.js`)
usado pelas duas versões "Cadentes". Ele cuida de:
- **Céu e chão:** as peças nascem em lugares diferentes no topo e descem até o chão.
- **Ritmo:** de quanto em quanto tempo nasce uma peça, quanto tempo ela leva para cair e quantas podem estar na tela ao mesmo tempo.
- **Pausa automática** quando a criança troca de aba ou a janela perde o foco, e o botão ⏸.
- **Placar:** pegou, deixou cair, erros e tempo.

Tudo em HTML, CSS e JS puro, animado com `requestAnimationFrame`, sem
biblioteca nova.

---

## 2. 🖱️ Click (mouse)

### 2.1 As cinco ações
| Ação | O que a criança faz | Como o jogo reconhece |
|------|--------------------|-----------------------|
| **Mover** | Passa o mouse por cima dos blocos para apagá-los e revelar uma figura | o ponteiro passa por cima (sem clicar) |
| **Clique** | Clica no alvo antes que ele suma | um clique dentro do alvo |
| **Duplo clique** | Clica duas vezes seguidas no alvo | dois cliques no mesmo alvo dentro de um tempo-limite que começa folgado (0,8 s) e aperta (0,4 s) nas fases difíceis |
| **Segurar** | Aperta e segura até o anel do alvo encher | botão apertado por 0,6 a 1,5 s, sem sair do alvo |
| **Arrastar** | Leva o objeto até o lugar certo (a 🍎 até a cesta, a peça até a sombra) | apertar no objeto, mover e soltar dentro do destino |

Tudo usa *pointer events*, então funciona igual com **mouse, dedo no tablet
e caneta**. O duplo clique e o segurar são medidos pelo próprio jogo, não
dependem da configuração do Windows.

### 2.2 Dificuldade
A dificuldade sobe por quatro botões, e cada fase mexe em um ou dois:
- **Tempo na tela** do alvo: 6 s → 1,5 s, e ele vai encolhendo enquanto o tempo passa, para a criança ver quanto falta.
- **Tamanho** do alvo: 120 px → 45 px.
- **Movimento:** parado → andando devagar → andando rápido → quicando nas bordas e mudando de direção (como os peixes do *Click on me*).
- **Quantidade:** um alvo por vez → vários ao mesmo tempo.

### 2.3 Mundos e fases (7 mundos, 12 fases cada = 84 fases)
1. **🧽 Mover o mouse:** blocos grandes, depois pequenos, depois em labirinto (o caminho tem que seguir uma trilha sem sair dela, como o *Control the hose-pipe*).
2. **👆 Clique:** alvos parados e grandes → pequenos → somem rápido → andando → quicando.
3. **✌️ Duplo clique:** a mesma subida, com o tempo entre os cliques apertando.
4. **✊ Segurar:** segurar mais tempo, alvos menores e, nas últimas fases, alvos que andam (é preciso acompanhar segurando).
5. **🤏 Arrastar e soltar:** arrastar para uma cesta grande → cestas menores → mais de uma cesta (cada fruta na sua cor) → cestas que andam.
6. **🧩 Montar figuras:** arrastar peças para a sombra certa, como o *Complete the puzzle* (3 → 8 peças).
7. **🎲 Tudo misturado:** cada alvo mostra o seu ícone (👆 ✌️ ✊ 🤏) e a criança tem que fazer a ação certa.

**Recompensa:** cada acerto revela um pedaço de uma figura grande no fundo
(como o *Erase*). No fim da fase, a figura inteira aparece.

### 2.4 Estrelas e erros
- Uma fase tem de 10 a 20 alvos. Contam os acertos, os alvos que sumiram sem acerto e as ações erradas (por exemplo, um clique simples num alvo de duplo clique).
- **Estrelas:** ⭐ com 60% de acerto, ⭐⭐ com 80%, ⭐⭐⭐ com 95%.
- **Na área do professor:** fase atual, estrelas e a % de acerto em cada ação. É aí que se vê quem ainda tem dificuldade com o duplo clique ou com o arrastar.

---

## 3. 🔤 Letras Cadentes (teclado)

### 3.1 Como se joga
- Letras, sílabas e palavras caem do céu, e a criança digita cada uma antes que chegue ao chão.
- **Alvo travado:** ao apertar a primeira letra, o jogo escolhe a peça mais perto do chão que começa com ela. Ela fica destacada e as letras já digitadas mudam de cor. As letras seguintes completam aquela peça.
  - **Letra errada:** a peça treme e conta um erro, mas ela não é perdida.
  - **Esc** solta o alvo.
- **Acentos funcionam** como no Teclado Mágico (´ ~ ^ e Ç). Maiúsculas valem só nas fases de maiúsculas.
- **Ajuda opcional:** o teclado na tela mostra a próxima tecla e o dedo certo. Vem ligada nos primeiros mundos.
- Precisa de teclado físico. No tablet aparece o mesmo aviso do Teclado Mágico.

### 3.2 Como as fases ficam mais difíceis
Cada mundo tem **4 conteúdos × 3 velocidades = 12 fases** (🐢 devagar, 🐇
médio, 🚀 rápido). A velocidade muda:
- **Tempo de queda:** 14 s → 9 s → 6 s, mais curto nos mundos de palavras longas.
- **Intervalo** entre uma peça e outra.
- **Quantas peças na tela** ao mesmo tempo: 1 → 2 → 3.

### 3.3 Mundos (9 mundos × 12 = 108 fases)
| Mundo | Conteúdos (4) |
|-------|---------------|
| 1. 🏠 Letras do meio | A S D F · J K L Ç · G H · fileira do meio inteira |
| 2. ⬆️ Letras de cima | mão esquerda · mão direita · vogais · fileira de cima inteira |
| 3. ⬇️ Letras de baixo | mão esquerda · mão direita · alfabeto inteiro · alfabeto + vírgula e ponto |
| 4. 🔢 Letras e números | 1 a 5 · 6 a 0 · todos os números · letras e números misturados |
| 5. 🔠 Maiúsculas | letras maiúsculas · nomes · siglas · palavras em MAIÚSCULA |
| 6. 🔡 Sílabas | sílabas simples (ba, me) · com R e L (bra, pla) · CH, LH e NH · sílabas misturadas |
| 7. 📝 Palavras simples | 2 e 3 letras · 4 e 5 letras · 6 letras ou mais · palavras com letras difíceis |
| 8. ✨ Palavras com acento | agudo · til (ão, õe) · circunflexo · todos os acentos e Ç |
| 9. 🏆 Desafio | palavras com maiúscula e acento · duas palavras ("bola azul") · palavras longas · tudo misturado |

As palavras vêm do banco do Teclado Mágico (filtrado por tamanho, letras e
acentos). As fases de letras só usam as teclas daquele mundo.

### 3.4 Estrelas
- Uma fase tem de 15 a 30 peças. Contam as peças pegas, as que caíram e os erros de digitação.
- **Estrelas:** ⭐ pegando 60% das peças, ⭐⭐ pegando 80%, ⭐⭐⭐ pegando 95% com até 10% de erros.
- **Na área do professor:** fase atual, estrelas e as letras que mais caíram.

---

## 4. 🔢 Números Cadentes (matemática)

### 4.1 Como se joga
- Contas caem do céu, e a criança digita o resultado antes que cheguem ao chão.
- **Não precisa apertar Enter.** Quando o número digitado é a resposta de alguma conta que está caindo, ela estoura (se houver duas com a mesma resposta, estoura a mais perto do chão).
- **Número que não leva a nenhuma resposta:** por exemplo, a criança digitou 7 e não há resposta que comece com 7. O número pisca vermelho, apaga e conta um erro.
- **Teclado numérico na tela** (funciona no tablet) e o teclado do computador. A tecla − aparece nos mundos de negativos.
- As contas vêm do gerador do Conta Comigo, com as mesmas regras: sem negativos onde não pode, divisão exata e nada acima de 100 fora da adição e subtração. Só entram contas de uma resposta, sem divisão com resto e sem "qual é o sinal?".

### 4.2 Mundos (8 mundos × 12 = 96 fases)
Cada mundo também tem **4 conteúdos × 3 velocidades**:

| Mundo | Conteúdos (4) |
|-------|---------------|
| 1. 🎲 Dados e dominós | um dado (1 a 6) · dois dados · dominós · dados e dominós misturados. A criança conta os pontinhos, como no *Numbers with dice* |
| 2. ➕ Adição e subtração: unidades | + até 10 · − até 10 · + até 20 · ± até 20 |
| 3. ➕ Adição e subtração: dezenas e centenas | dezenas inteiras · dezena ± unidade · dezena ± dezena · centenas inteiras |
| 4. ✖️ Tabuadas | ×2 ×5 ×10 · ×3 ×4 · ×6 ×7 · ×8 ×9 |
| 5. ➗ Divisão | ÷2 ÷5 ÷10 · ÷3 ÷4 · ÷6 ÷7 · ÷8 ÷9 |
| 6. 🎲 Misturadas | + e − · × e ÷ · as quatro operações · dobro e metade |
| 7. 🌡️ Negativos | subindo do negativo · descendo abaixo do zero · + e − com negativos · × e ÷ com sinais |
| 8. 🚀 Potências e raízes | quadrados · raízes quadradas · cubos e raízes cúbicas · tudo junto |

### 4.3 Estrelas
- São as mesmas regras do Letras Cadentes (60%, 80% e 95% pegas).
- **Na área do professor:** fase atual, estrelas e as contas que mais deixou cair (como em "contas que mais erra" no Conta Comigo).

---

## 5. Conferência no servidor

Nos jogos de queda, o servidor não consegue ver cada tecla. Ele confere se o
resultado é possível, como faz no Teclado Mágico:
- O navegador manda a **semente** da rodada, quantas peças pegou e deixou cair, os erros, o tempo e as peças que caíram.
- **O servidor refaz a lista de peças pela semente** (mesmo gerador, compartilhado) e confere:
  - pegas + caídas = total da fase;
  - as peças que caíram existem naquela rodada;
  - a rodada não pode ter durado menos que o ritmo da fase permite.
- Depois o servidor calcula as estrelas.
- No **Click**, a conferência é a mesma: total de alvos da fase, tempo mínimo e estrelas calculadas no servidor.

Para isso, o conteúdo das "Cadentes" precisa ser gerado com semente. O
Letras Cadentes ganha um gerador próprio (com semente) sobre o mesmo banco de
palavras. O Números Cadentes já usa o gerador com semente do Conta Comigo.

---

## 6. Arquivos

```
public/js/shared/falling.js          # motor de queda (Letras e Números Cadentes)
public/games/click/                   # levels.js, game.js, actions.js (reconhece clique, duplo, segurar, arrastar), view.html, game.css
public/games/letras/                 # levels.js, content.js (gerador com semente), game.js, view.html, game.css
public/games/numeros/                # levels.js, game.js, view.html, game.css (usa ../matematica/problems.js)
src/games/click/server.js             # validateResult, mergeProgress, summary, teacherSummary, mergeAccounts
src/games/letras/server.js
src/games/numeros/server.js
test/click.test.js, test/cadentes.test.js
```

Mais três entradas no `registry.js`, todas com `mode: 'solo'`:

| Jogo | `requiresKeyboard` |
|------|--------------------|
| Click | false (funciona com o dedo) |
| Letras Cadentes | true |
| Números Cadentes | false |

### Etapas
| Etapa | O que entra |
|-------|-------------|
| A | Motor de queda + **Letras Cadentes** completo (fases, servidor, professor, testes) |
| B | **Números Cadentes** (reaproveita o motor e o gerador de contas) |
| C | **Click** (ações, 7 mundos, figura revelada) |
| D | Ajustes de ritmo (velocidades e tempos) jogando de verdade, README e conferência no tablet e no celular |

Cada etapa termina com os testes passando, conferência no navegador e um
commit.

### Testes novos
- **Geradores:** cada fase das "Cadentes" só tem o conteúdo permitido, por exemplo as letras da fileira certa, palavras sem acento nas fases sem acento e contas dentro do limite. A mesma semente gera as mesmas peças, e toda fase tem conteúdo variado.
- **Servidor:** recusa totais que não fecham, tempo impossível e peça que não existe na rodada; calcula as estrelas certas.
- **Click:** o reconhecimento das ações (clique, duplo clique dentro e fora do tempo, segurar curto demais, arrastar soltando fora) com eventos simulados.

---

## 7. Decisões

1. **Peça que chega ao chão:** sem game over. A rodada vai até o fim e as estrelas dependem de quantas peças a criança pegou.
2. **Painel de jogos:** separado por assunto (⌨️ Digitação, 🔢 Matemática, 🖱️ Mouse, 👥 Com a turma). Isso entra com o primeiro jogo novo: cada jogo do `registry.js` ganha um campo `subject`.
3. **Ordem:** Letras Cadentes (A) → Números Cadentes (B) → Click (C).

## 8. Riscos e cuidados
- **Velocidade:** "rápido" para um 5º ano é impossível para um 1º ano. Por isso, cada mundo começa no 🐢. Os tempos serão ajustados jogando (etapa D).
- **Computadores lentos da escola:** a animação mexe só em `transform` (sem recalcular a página), e o número de peças na tela é limitado.
- **Duplo clique em tablet:** o navegador pode dar zoom ao tocar duas vezes. A área do jogo desliga isso (`touch-action: none`).
- **Área do professor:** com 7 jogos, a tabela da turma fica larga. Proponho um seletor "mostrar jogo: todos / um só" no topo da tabela.
