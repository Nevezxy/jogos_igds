# 🧩 ♟️ Plano: jogos de raciocínio, matemática do dia a dia e tabuleiro

> **Situação:** etapas **A** (seções novas no painel, base de tabuleiro,
> robô, partida pela rede, ❌ Jogo da Velha e 🔴 Ligue 4) e **B** (🃏 Memória,
> 🗼 Hanói, 🌀 Labirinto, com telas compartilhadas), **C** (💰 Dinheiro e
> Troco, ⚖️ Balança) e **D** (🚗 Carrinhos, 🎨 Pixel Art, 🔍 Diferenças,
> 🧩 Quebra-cabeça) concluídas. Próxima: E (Dama e Xadrez).
> Na etapa D: Pixel Art com 30 desenhos (não 36), Diferenças com 20 fases e
> Quebra-cabeça com 18 (uma foto por fase).
> Na etapa A, as estrelas ficaram por partida: ⭐⭐⭐ é vencer sem desfazer.
> A "melhor de 3" saiu, para não alongar as fases.
> **Decisões tomadas:**
> - **Contra um amigo:** pela rede, entre dois aparelhos: com **código de sala** ou com **pareamento automático** (quem está procurando partida no mesmo jogo é juntado). Não há o modo dos dois no mesmo aparelho.
> - **Dama:** só a **oficial brasileira**.
> - **Ordem:** A → E, como na seção 5.
> - **Painel:** duas seções novas, 🧩 Raciocínio e ♟️ Tabuleiro.

São 13 jogos novos, quase todos inspirados em atividades do GCompris:

| Jogo | Inspiração no GCompris | O que treina |
|------|------------------------|--------------|
| 🃏 Jogo da Memória | *Memory* (figuras, números, contas, letras; contra o Tux) | Memória, atenção, associação |
| 🗼 Torre de Hanói | *Tower of Hanoi* | Planejamento, sequências |
| 🚗 Carrinhos (peças deslizantes) | *Traffic* (tirar o carro vermelho do estacionamento) | Raciocínio espacial, planejar vários passos |
| 🌀 Labirinto | *Maze*, *Invisible maze*, *Relative maze* | Orientação espacial, esquerda e direita |
| 🎨 Pintar Pixel Art | (sem equivalente direto: pintura por número) | Números, cores, coordenação, atenção |
| 🔍 Encontre a Diferença | *Photo hunter* | Atenção a detalhes, observação |
| 💰 Dinheiro e Troco | *Money*, *Give Tux his change* | Sistema monetário, somar e tirar com centavos |
| ⚖️ Equilibre a Balança | *Balance the scales properly* | Igualdade, massa (g e kg), equação sem letra |
| 🧩 Montar Quebra-cabeça | *Paintings / puzzle* | Percepção visual, formas |
| ❌⭕ Jogo da Velha | *Tic tac toe* (contra o Tux ou dois jogadores) | Estratégia, antecipar o adversário |
| 🔴🟡 Ligue 4 (ou 5) | *Connect 4* (contra o Tux ou dois jogadores) | Estratégia, padrões |
| ⚫⚪ Dama | *Checkers* (contra o Tux ou dois jogadores) | Estratégia, cálculo de jogadas |
| ♟️ Xadrez | *Chess* e *End of chess game* (contra o Tux ou dois jogadores) | Estratégia, concentração |

Todos seguem o mesmo contrato dos jogos atuais: mapa de fases (feitas e
pendentes), estrelas e progresso no servidor, resumo para o professor,
funciona com mouse e com o dedo, e o modo offline (o app guardado no
navegador) já cobre todos sem trabalho extra.

---

## 1. O painel ganha duas seções

| Seção | Jogos |
|-------|-------|
| ⌨️ Digitação | (como está) |
| 🔢 Matemática | + 💰 Dinheiro e Troco, ⚖️ Equilibre a Balança |
| 🖱️ Mouse | (como está) |
| 🧩 Raciocínio (nova) | 🃏 Memória, 🗼 Torre de Hanói, 🚗 Carrinhos, 🌀 Labirinto, 🎨 Pixel Art, 🔍 Diferenças, 🧩 Quebra-cabeça |
| ♟️ Tabuleiro (nova) | ❌⭕ Jogo da Velha, 🔴🟡 Ligue 4, ⚫⚪ Dama, ♟️ Xadrez |
| 👥 Com a turma | (como está) |

Com 20 jogos no painel, cada seção fica recolhível (lembra no navegador).

---

## 2. Peças compartilhadas (feitas uma vez, usadas por vários)

- **Tabuleiro e partida** (`js/shared/board.js`), para Velha, Ligue 4, Dama e Xadrez:
  - grade que se adapta à tela, casas tocáveis;
  - destaque das jogadas possíveis e da última jogada;
  - escolha do modo: 🤖 **contra o computador** (níveis) ou 👫 **contra um amigo pela rede**;
  - **desfazer** só nos níveis fáceis;
  - placar, relógio opcional e fim de partida (vitória, derrota ou empate) com festa.
- **Robô em segundo plano** (Web Worker), para o computador "pensar" sem travar a tela:
  - minimax com poda alfa-beta, limitado por profundidade e por tempo;
  - nos níveis baixos, erra de propósito (escolhe entre as boas jogadas com um pouco de sorte).
  - Cada jogo traz as próprias regras e a própria avaliação; o motor de busca é o mesmo.
- **Partida pela rede** (`src/platform/match.js` + Socket.IO, que já é usado pelo Bingo e pelo Desafio):
  - **🔑 Código de sala:** um aluno cria a partida e recebe um código de 4 letras (com QR Code); o outro digita o código.
  - **🎲 Pareamento automático:** "Procurar adversário" coloca o aluno numa fila daquele jogo. Os dois primeiros da fila são juntados (de preferência da mesma turma), e dá para cancelar a espera.
  - **O servidor é o juiz:** cada lance é conferido no servidor com o mesmo arquivo de regras do navegador (UMD, como os geradores). Lance inválido é recusado, e ninguém consegue roubar mexendo no navegador.
  - **Queda de conexão:** quem cair tem 60 s para voltar e a partida continua de onde estava; senão, o outro vence por abandono. Também há os botões "Desistir" e "Pedir empate" (o outro aceita ou não).
  - Mostra o nome e o bichinho do adversário. Partidas contra amigos contam no placar, mas não dão estrela.
  - Precisa de conexão: sem internet, só o modo contra o computador.
- **Arrastar e soltar** (o do Click, generalizado), para Hanói, Dinheiro, Balança e Quebra-cabeça.
- **Geração com semente**, como nos Cadentes: o servidor refaz a fase pela semente e confere o resultado.
- **Sem baixar nada novo:** nenhuma biblioteca de fora; motores de regras escritos aqui (inclusive o do xadrez). As figuras são desenhadas em SVG e emoji; as únicas fotos são as 19 CC0 que já estão no Click.

---

## 3. Os jogos

Seguem o princípio que já usamos: cada fase traz algo novo, nada de fase
repetida só para encher.

### 🃏 Jogo da Memória
- Vira duas cartas; se formam par, ficam abertas.
- **Pares de tipos diferentes** (não só figuras iguais):
  - figura = figura;
  - número = quantidade (3 ↔ 🍎🍎🍎);
  - conta = resultado (4 + 3 ↔ 7);
  - maiúscula = minúscula (A ↔ a);
  - palavra = figura (GATO ↔ 🐱);
  - sílaba inicial = figura (BO ↔ 🐂... ou 🎈 BA).
- **Tamanho:** de 6 cartas (3 pares) a 36 cartas (18 pares).
- Modo **contra o computador** (que também esquece cartas, conforme o nível) e contra um amigo.
- **Estrelas:** pelo número de tentativas comparado ao mínimo possível.
- **Recorde:** menos tentativas.
- **Cerca de 7 mundos / 28 fases.**

### 🗼 Torre de Hanói
- Levar a torre de um pino para outro, só o disco de cima e nunca um maior sobre um menor.
- **Fases:**
  - 3 → 7 discos;
  - depois "torre bagunçada": começa de uma posição misturada;
  - "copie o modelo": montar a mesma torre de uma figura.
- O mínimo de movimentos (2ⁿ − 1) aparece no fim.
- **Estrelas:** movimentos perto do mínimo.
- O servidor refaz os movimentos e confere que são válidos.
- **Cerca de 12 fases.**

### 🚗 Carrinhos (peças deslizantes)
- Estacionamento 6 × 6. Os carros (2 casas) e caminhões (3 casas) só andam para a frente e para trás. Tirar o carro vermelho pela saída.
- **Fases:** um banco de quebra-cabeças gerado e **resolvido por um programa** (busca em largura). Isso garante que todos têm solução e ordena pelo número mínimo de jogadas (de 2 a mais de 30).
- **Estrelas:** jogadas perto do mínimo. Botão "dica" mostra a próxima jogada certa, com custo de estrela.
- **Cerca de 40 fases em 5 mundos.**

### 🌀 Labirinto
- Levar o personagem até a saída, com setas, toque ou deslizando o dedo.
- **Mundos:**
  - labirintos pequenos → grandes;
  - **invisível** (as paredes só aparecem quando bate);
  - **relativo** (o personagem vira para a esquerda ou a direita e anda para a frente, para treinar lateralidade);
  - **com chaves e portas**: pegar a chave antes da porta.
- Gerado com semente: infinitas variações por fase.
- **Estrelas:** tempo e batidas na parede.
- **Cerca de 24 fases.**

### 🎨 Pintar Pixel Art
- Um desenho em preto e branco, quadriculado; cada quadradinho tem o número da cor. A criança escolhe a cor na paleta numerada e pinta (tocando ou arrastando).
- **Ajudas:**
  - ao escolher a cor, os quadradinhos dela piscam de leve;
  - o número some quando o quadradinho é pintado certo;
  - pintou errado, fica marcado para corrigir.
- **Fases:** de 8 × 8 com 2 cores até 24 × 24 com 10 cores. São uns 36 desenhos feitos para o jogo: bichos, frutas, objetos, emojis, bandeira do Brasil e outros.
- **Variante "números com conta"** (mundo final): no lugar do número vem uma conta (3 + 2 = cor 5).
- **Estrelas:** pinturas erradas. No fim, o desenho aparece colorido com animação, e a galeria guarda os que a criança já pintou.

### 🔍 Encontre a Diferença
- Duas cenas lado a lado (ou uma em cima da outra, no celular). Tocar onde está a diferença marca nas duas.
- **Cenas desenhadas pelo jogo** (SVG com figuras: casa, árvores, bichos, sol...), geradas por semente.
- **As diferenças:**
  - cor trocada;
  - objeto que sumiu;
  - objeto a mais;
  - tamanho;
  - virado;
  - posição.
- Isso dá infinitas variações sem precisar de fotos. Uma foto não muda sozinha sem montagem manual.
- **Fases:** de 3 a 10 diferenças, cada vez mais sutis.
- **Estrelas:** cliques errados e tempo. Botão "dica" mostra uma diferença.
- **Cerca de 20 fases.**

### 💰 Dinheiro e Troco
- Moedas e cédulas do Real, **desenhadas no estilo das de verdade** (cor e valor certos), sem copiar a arte das cédulas.
- **Mundos:**
  1. **Quanto tem aqui?** Contar o dinheiro da mesa.
  2. **Pague o valor exato:** arrastar o dinheiro para o caixa. Primeiro só cédulas e reais inteiros, depois centavos.
  3. **Pague com menos notas:** o mesmo valor com o menor número de cédulas e moedas.
  4. **Dê o troco:** o cliente paga R$ 20 por algo de R$ 13,50, e a criança devolve o troco. Como o *Give Tux his change*.
  5. **Lojinha:** lista de compras, somar os preços e pagar.
- **Estrelas:** erros. **Cerca de 25 fases.**

### ⚖️ Equilibre a Balança
- Uma balança de dois pratos que pende para o lado mais pesado. A criança coloca pesos até equilibrar.
- **Mundos:**
  1. Pesos pequenos (1 a 10).
  2. Somar vários pesos.
  3. Pesos nos dois pratos (tirar).
  4. **Gramas e quilos** (500 g + 500 g = 1 kg).
  5. **"Quanto pesa o objeto?"**: descobrir o valor desconhecido, uma equação sem letra.
- **Estrelas:** tentativas. **Cerca de 20 fases.**

### 🧩 Montar Quebra-cabeça
- Peças com encaixes de verdade (desenhadas em SVG), feitas a partir das 19 fotos CC0 do Click. Arrastar até o lugar; perto do lugar certo, a peça gruda.
- **Fases:** 4 → 6 → 9 → 12 → 20 → 30 → 48 peças.
  - Começa com a "sombra" da foto no fundo.
  - Depois, sem sombra.
  - Depois, com peças viradas (toque para girar).
- **Estrelas:** tempo. A foto montada entra na galeria.
- **Cerca de 18 fases.**

### ❌⭕ Jogo da Velha
- Fases = níveis do robô:
  - 1 (joga ao acaso);
  - 2 (completa a linha se puder);
  - 3 (também bloqueia);
  - 4 (perfeito: no máximo empata).
- **Extras:** o "Velha 4 × 4" (4 em linha) e contra um amigo.
- **Estrelas:** vencer, ou empatar contra o perfeito, numa melhor de 3.

### 🔴🟡 Ligue 4 (e Ligue 5)
- Ligue 4 no tabuleiro 7 × 6. **Ligue 5** é uma opção no tabuleiro 9 × 7.
- **Robô:** 6 níveis, do que joga quase ao acaso ao que pensa 8 jogadas à frente.
- **Ajuda opcional:** mostra onde o adversário ameaça ganhar.
- **Estrelas:** vencer o nível (melhor de 3). Contra um amigo também.

### ⚫⚪ Dama
- **Dama brasileira oficial:**
  - tabuleiro 8 × 8, 12 peças cada, as brancas começam;
  - o peão anda 1 casa na diagonal para a frente e **captura para a frente e para trás**;
  - a **dama anda várias casas** na diagonal ("dama voadora") e captura de longe;
  - **captura obrigatória**, com **lei da maioria**: é preciso fazer a sequência que captura mais peças;
  - a peça capturada sai só no fim da sequência e não pode ser pulada duas vezes;
  - o peão que só passa pela última fileira no meio de uma captura não vira dama;
  - empate quando os dois só movem damas por 20 lances sem captura, ou por acordo.
- **Robô:** 5 níveis.
- **Ajudas:**
  - as peças que podem (ou precisam) jogar ficam destacadas;
  - a captura em várias etapas é mostrada passo a passo;
  - desfazer nos níveis 1 e 2.

### ♟️ Xadrez
- **Regras completas:**
  - roque, *en passant* e promoção, com escolha da peça;
  - xeque, xeque-mate e afogamento;
  - empate por material insuficiente, 3 repetições e 50 lances.
- **Robô:** 6 níveis.
  - 1: prefere capturar, sem pensar no resto.
  - 6: pensa 4 lances à frente com busca de capturas.
  - Fica no Web Worker e, no nível mais alto, responde em menos de 2 s.
- **Ajudas:**
  - casas possíveis ao tocar na peça;
  - aviso de peça atacada (opcional);
  - desfazer nos níveis fáceis.
- **Mundo "Fim de partida"** (como o *End of chess game*): posições prontas para dar mate.
  - Mate em 1, mate em 2.
  - Rei e dama contra rei, rei e torre contra rei.
  - Ensina antes de jogar partidas inteiras.

---

## 4. Progresso, estrelas e professor

- **Quebra-cabeças** (Memória, Hanói, Carrinhos, Labirinto, Pixel, Diferenças, Dinheiro, Balança, Quebra-cabeça):
  - fases com estrelas, como nos jogos atuais;
  - o servidor refaz pela semente (ou refaz os movimentos) e calcula as estrelas.
- **Tabuleiro:**
  - cada nível do robô é uma fase; ⭐ = vencer o nível e ⭐⭐⭐ = vencer sem desfazer, com a melhor de 3;
  - o servidor refaz a partida e confere se todos os lances são válidos e se o resultado bate;
  - contra um amigo não vale estrela, mas conta partidas.
- **Na área do professor:**
  - fase e estrelas de cada jogo;
  - no tabuleiro, o nível mais alto vencido e o placar (vitórias, empates, derrotas);
  - a evolução semanal e a planilha já pegam os jogos novos sozinhas.

---

## 5. Etapas

Cada etapa termina com testes, conferência no navegador (computador e celular) e commit.

| Etapa | O que entra | Por quê nessa ordem |
|-------|-------------|---------------------|
| A | Seções novas no painel, **tabuleiro + robô + partida pela rede (código e pareamento)**, ❌⭕ Jogo da Velha e 🔴🟡 Ligue 4 | Monta a base de tabuleiro com os dois jogos mais simples |
| B | 🃏 Memória, 🗼 Hanói, 🌀 Labirinto | Raciocínio, regras simples |
| C | 💰 Dinheiro e Troco, ⚖️ Balança | Matemática do dia a dia, usa o arrastar |
| D | 🎨 Pixel Art, 🔍 Diferenças, 🧩 Quebra-cabeça, 🚗 Carrinhos | Precisam de desenhos/geradores próprios |
| E | ⚫⚪ Dama e ♟️ Xadrez (com o "Fim de partida") | Os maiores: regras longas e robôs mais fortes |

### Testes novos
- Regras de cada tabuleiro: velha, ligue 4 (vitória em todas as direções), dama, xadrez.
  - **Xadrez:** contagem de lances (*perft*) em posições conhecidas, que é como os programas de xadrez provam que as regras estão certas.
  - **Dama:** captura obrigatória e captura em sequência.
- Robôs: o nível perfeito da velha nunca perde; o robô sempre escolhe um lance válido e responde dentro do tempo.
- Geradores:
  - todo carrinho tem solução no número de jogadas da fase;
  - todo labirinto tem caminho;
  - a balança tem sempre um jeito de equilibrar;
  - o troco é sempre possível com o dinheiro da mesa;
  - mesma semente = mesma fase.
- Servidor: recusa movimentos impossíveis, partidas inválidas e resultados que não batem.
- Partida pela rede (com dois sockets de mentira):
  - código de sala;
  - pareamento automático, incluindo cancelar a espera;
  - lance fora da vez ou inválido recusado;
  - vitória, empate e desistência;
  - reconexão dentro do prazo e abandono depois dele.

---

## 6. Riscos e cuidados

- **Tamanho do trabalho:** são 13 jogos, mais que tudo o que já foi feito somado. Por isso vão em etapas, com commit a cada uma, e você pode mudar a ordem no caminho.
- **Computadores lentos da escola:** o robô roda em segundo plano (Web Worker) e tem limite de tempo. O nível mais alto pensa menos num computador lento, em vez de travar.
- **Celular:** os tabuleiros 8 × 8 precisam de casas de pelo menos 40 px; no celular o tabuleiro ocupa a largura toda e os controles vão para baixo.
- **Dinheiro:** usar desenhos próprios no estilo do Real, em vez das imagens oficiais das cédulas, evita qualquer problema com a reprodução de cédulas.

---

## 7. Decisões

1. **Contra um amigo:** pela rede, com código de sala ou pareamento automático (sem o modo dos dois no mesmo aparelho).
2. **Dama:** só a oficial brasileira.
3. **Ordem:** A → E.
4. **Painel:** duas seções novas, 🧩 Raciocínio e ♟️ Tabuleiro.
