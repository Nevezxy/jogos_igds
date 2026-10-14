# 🎮 Jogos IGDS — Plataforma de Jogos Educativos

Plataforma de jogos para a sala de aula, com cara de portal de jogos
infantil (inspirada no Poki). Cada educando tem a sua conta — o login é só
o **nome e sobrenome** — e escolhe o jogo num painel. O progresso fica
salvo no servidor, então a criança continua de onde parou em qualquer
computador da escola.

Jogos de hoje:

| Jogo | Modo | O que é |
|------|------|---------|
| ⌨️ **Teclado Mágico** | sozinho(a) | Digitação com os 10 dedos: teclado ABNT2 na tela com uma cor por dedo, mãos que mostram o dedo certo e 99 fases (letras, palavras, acentos, frases, pontuação, números e textos). |
| 🔤 **Letras Cadentes** | sozinho(a) | Letras, números, sílabas e palavras caem do céu e a criança digita cada uma antes que chegue ao chão. 31 fases que aceleram durante a rodada, combo, peças especiais (⭐ 🧊 💥), recorde, opção "apenas maiúsculas" e o céu ocupando a tela toda. |
| 🔢 **Conta Comigo** | sozinho(a) | Matemática: mundo das figurinhas, adição e subtração da unidade ao milhar, multiplicação e divisão até a dezena, depois números negativos, potências, raízes e expressões. 143 fases, sequência 🔥 e teclado numérico na tela (funciona no tablet). |
| ☄️ **Números Cadentes** | sozinho(a) | Contas, dados e dominós caem do céu e a criança digita o resultado antes que cheguem ao chão (sem Enter). 42 fases que aceleram, combo, peças especiais, recorde e teclado numérico na tela. |
| 💰 **Dinheiro e Troco** | sozinho(a) | Moedas e cédulas do Real: contar, pagar o valor exato, pagar com menos notas, dar o troco e a lojinha. 16 fases, de reais inteiros a centavos. |
| ⚖️ **Equilibre a Balança** | sozinho(a) | Pôr pesos até a balança ficar reta: somar pesos, pesos nos dois pratos (subtração), gramas e quilos e "quanto pesa?". 10 fases. |
| 🖱️ **Click** | sozinho(a) | Treino do mouse (e do dedo no tablet): passar por cima, clicar, clicar duas vezes, segurar e arrastar. 30 fases que aceleram, figura escondida revelada a cada acerto, combo, peças especiais e recorde. |
| 🃏 **Jogo da Memória** | sozinho(a) ou contra o robô | Pares de figura igual, número e quantidade, maiúscula e minúscula, palavra e figura, conta e resultado. 19 fases, de 6 a 24 cartas, e 3 robôs que também esquecem cartas. |
| 🗼 **Torre de Hanói** | sozinho(a) | De 3 a 7 discos, torre bagunçada, "copie o modelo" e 4 pinos. 13 fases, estrelas pelo mínimo de movimentos e dica. |
| 🌀 **Labirinto** | sozinho(a) | Labirintos sorteados a cada rodada: do pequeno ao grande, com chaves e portas, invisível, no escuro e "virar e andar". 17 fases. |
| 🚗 **Carrinhos** | sozinho(a) | Tirar o carro vermelho do estacionamento arrastando os outros carros e caminhões. 40 estacionamentos, de 2 a 34 jogadas no mínimo, com dica. |
| 🎨 **Pixel Art** | sozinho(a) | Pintura por número: cada quadradinho tem o número da cor. 30 desenhos, de 8 × 8 com 2 cores a 24 × 24 com 10 cores, balde, "pinte com contas" e galeria. |
| 🔍 **Encontre a Diferença** | sozinho(a) | Duas cenas desenhadas pelo jogo (parque, fundo do mar, espaço), uma nova a cada rodada. 20 fases, de 3 diferenças fáceis a 10 sutis. |
| 🧩 **Quebra-cabeça** | sozinho(a) | Fotos de bichos com peças de encaixe de verdade: de 4 a 48 peças, com a foto clarinha no fundo, sem ela e com peças viradas. 18 fases e galeria. |
| ❌ **Jogo da Velha** | sozinho(a) ou com um amigo pela rede | 3 × 3 e 4 × 4 contra 7 robôs, um mais esperto que o outro (o último nunca perde), ou contra um amigo em outro aparelho (código de sala ou pareamento automático). |
| 🔴 **Ligue 4** | sozinho(a) ou com um amigo pela rede | Ligue 4 (7 × 6) e Ligue 5 (9 × 7) contra 10 robôs, ou contra um amigo pela rede. Ajuda opcional que mostra as ameaças. |
| ⚫ **Dama** | sozinho(a) ou com um amigo pela rede | Dama brasileira oficial (captura obrigatória com lei da maioria, dama voadora) contra 5 robôs, ou contra um amigo pela rede. A captura de várias peças é feita passo a passo. |
| ♟️ **Xadrez** | sozinho(a) ou com um amigo pela rede | "Fim de partida" (mate em 1, mate em 2, rei e dama ou torre contra rei) e partidas inteiras contra 6 robôs, ou contra um amigo pela rede. Regras completas. |
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

### Internet fraca (modo offline)
- **O app fica guardado no navegador** por um service worker (`/sw.js`,
  montado por `src/platform/offline.js` a partir de
  `src/platform/sw-template.js`): telas, scripts, estilos e todos os jogos.
  Abre rápido e continua funcionando se a internet cair no meio da aula.
  Uma versão nova no servidor muda a versão do `/sw.js`, e o navegador
  atualiza o que tem guardado sozinho (na próxima vez que a página abre).
- **Quem já entrou continua entrando:** sem internet, a criança que já
  estava no aparelho segue logada, e o painel e o progresso vêm da última
  resposta guardada **daquela mesma conta** (a chave do cache leva o token).
- **Resultado guardado:** se a rodada termina sem internet, o resultado
  fica numa caixa de saída no navegador e é enviado sozinho quando a
  conexão volta (o servidor confere como sempre). Um selo no rodapé mostra
  "📶 Sem internet" ou "⏳ N resultados esperando".
- **Precisa de HTTPS** (ou `localhost`): é regra dos navegadores para o
  service worker. Hospedado (Render, Railway...) já vem com HTTPS. Pela rede
  da escola em `http://192.168...` o app funciona normalmente, mas sem
  guardar os arquivos; a caixa de saída dos resultados funciona mesmo
  assim.
- O Bingo e o Desafio de Digitação são ao vivo com a turma: precisam da
  conexão.

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
- **10 mundos, 99 fases:** fileira do meio → de cima → de baixo →
  maiúsculas → palavras → acentuação → frases → pontuação → números e
  símbolos → textos. As fases de letras só usam as teclas já aprendidas.
  Nenhuma fase repete outra (saíram os treinos que repetiam letras já
  treinadas e as revisões duplicadas).
- **Recorde de velocidade** por fase: aparece antes de começar ("Consegue
  bater?") e no resultado ("🏆 Novo recorde!"), só com a fase bem feita.
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
  um erro, mas não perde a peça. Esc ou Backspace soltam o alvo. Cada
  acerto solta um estourinho de confetes no lugar da peça.
- **6 mundos, 31 fases, todas diferentes, em ordem de dificuldade (uma
  novidade por vez):** letras e números → sílabas → palavras (das curtas às
  compridas) → maiúsculas (com Shift, ainda sem acento) → palavras com
  acento (a cedilha primeiro) → grande final. **A rodada
  acelera:** começa devagar e vai ficando mais rápida (tempo de queda,
  intervalo e quantas peças na tela) até a última peça. Cada mundo termina
  com um 🏆 Desafio, que mistura tudo do mundo e já começa mais rápido.
- **Pontos e combo:** acertos seguidos multiplicam os pontos (×2 a cada 5,
  até ×5); errar ou deixar cair zera o combo. O "+20" sobe do lugar do
  acerto. **Peças especiais** de vez em quando: ⭐ dourada (bônus), 🧊 gelo
  (o céu congela 3 s) e 💥 bomba (estoura todas as peças da tela).
  **Placar grande dentro do céu** (atrás das peças): pontos que contam até
  o valor novo, 🔥 ×N com a barra até o próximo multiplicador, acertos
  seguidos e o recorde; combo novo, recorde batido e 10/20/30 seguidos viram
  um letreiro grande no meio do céu, e a borda do céu esquenta com o combo.
  **Recorde de pontos** por fase (antes de começar e no resultado). Isso é
  o mesmo nos dois jogos Cadentes (`js/shared/cadentes.js`).
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
- **10 mundos, 160 fases** (12 a 33 por mundo, com etapas no mapa; toda fase
  tem pelo menos 10 contas diferentes, para não repetir conta na rodada, e
  nada de fase trivial ou picada demais: as divisões vêm em pares, como
  "Dividir por 3 e por 4"):
  🍎 contando com figurinhas, ➕ adição e subtração juntas (unidade até 10,
  unidade até 20, dezena, centena e milhar, sem e com vai-um/empréstimo,
  número que falta), ✖️ multiplicação (tabuadas das mais fáceis às mais
  difíceis, dezena × unidade), ✍️ conta armada, ➗ divisão (tabuada ao
  contrário, dezena ÷ unidade, por 11 e 12, por 15, 20, 25 e 50, com resto),
  🎲 misturadas ("qual é o sinal?", triplo e terça parte, completar 100,
  contas em sequência), 🌡️ números negativos, 🚀 potências, 🌱 raízes (quadrada e
  cúbica) e 🧠 expressões (ordem das operações, parênteses, colchetes, a
  diferença entre −3² e (−3)²).
- **✍️ Conta armada** (13 fases: somar, tirar e multiplicar armando, da
  dezena ao milhar): a conta aparece em pé, casa embaixo de casa, como no
  caderno, e o resultado é digitado **da direita para a esquerda** (cada
  algarismo novo entra à esquerda; a casa da vez pisca). Em cima de cada
  casa há uma caixinha do vai-um (ou do empréstimo) que a criança marca
  tocando: é só ajuda, não conta ponto.
- **Centena e milhar só na adição e subtração** (e na soma e subtração da
  conta armada): nos outros mundos nenhum
  número da conta, nem o resultado, passa de 100 (`maxAbs` do mundo em
  `levels.js`; o gerador descarta o que passar).
- **Rodada de 10 contas.** Errou: dica que ensina o caminho (vai-um,
  empréstimo, tabuada, regra dos sinais...) e uma 2ª tentativa. Errou de
  novo: o jogo mostra a resposta e a conta volta nas próximas rodadas
  daquela fase (revisão).
- **🔥 Sequência:** contas certas de primeira, seguidas (com festa no 5 e
  no 10); a melhor sequência de cada fase vira recorde.
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

### ☄️ Números Cadentes (matemática)
- Contas caem do céu e a criança digita o resultado antes que cheguem ao
  chão. **Sem Enter:** quando o número digitado é a resposta de uma conta
  que está caindo, ela estoura (a mais perto do chão, se duas tiverem a
  mesma resposta). Se outra resposta na tela começa com o mesmo número (1 e
  12), o jogo espera 0,8 s pelo próximo algarismo. Número que não leva a
  nenhuma resposta pisca vermelho, apaga e conta um erro.
- **8 mundos, 42 fases** que aceleram durante a rodada, cada mundo com um 🏆
  Desafio no fim, com os mesmos pontos, combo, peças especiais e recorde
  do Letras Cadentes: dados e dominós (contar
  os pontinhos: um dado, dois dados e dominós, três dados), somar e tirar com unidades, somar e tirar com dezenas e
  centenas, tabuadas, divisão, misturadas, números negativos (tecla −) e
  potências e raízes. As contas vêm do gerador do Conta Comigo, com as
  mesmas regras (nada acima de 100 fora de somar e tirar).
- Teclado numérico na tela, ao lado do céu (no celular, embaixo), e o do
  computador. O céu ocupa todo o espaço que sobra na tela.
- Sem game over; estrelas como no Letras Cadentes (60%, 80% e 95% das
  contas, com até 15% de números errados para a 3ª). Pausa com Esc, pelo
  botão ou ao trocar de aba.
- O servidor refaz as contas pela semente; na área do professor aparecem a
  fase, quanto a criança resolve e as contas que mais caíram.

### 🖱️ Click (mouse)
- Alvos aparecem na área de jogo. Acertou, ele estoura e revela um pedaço
  da **foto escondida** no fundo (19 fotos de bichos e paisagens, CC0, em
  `public/games/click/img/`, com os créditos em `CREDITOS.md`); no fim, a
  foto inteira aparece ("Você revelou a raposa!").
- **⏱️ Cronômetro nas bolinhas** (botão no mapa e antes da fase; vem
  desligado e fica guardado no navegador). Ligado, cada alvo tem um anel que
  mostra quanto tempo falta (verde → laranja → vermelho) e some se a criança
  demorar. Desligado, os alvos esperam e as estrelas vêm das ações certas
  (90%, 75% e 50%).
- **Arrastar sem confusão:** a fruta balança e tem a etiqueta "✋ arraste";
  uma trilha tracejada vai dela até a cesta "solte aqui", que pulsa
  enquanto a fruta é arrastada; nas primeiras frutas da rodada, uma
  mãozinha mostra o movimento.
- **Cinco ações:** 🫧 passar por cima, 👆 clique, ✌️ duplo clique (o tempo
  entre os cliques aperta de 0,9 s até 0,45 s), ✊ segurar até o anel encher
  (0,6 a 1,3 s, sem sair de cima) e 🤏 arrastar e soltar no lugar certo
  (cesta, caixa da mesma cor, sombra igual, cesta que anda). Medidas pelo
  próprio jogo (`actions.js`), sem depender da configuração do Windows.
- **6 mundos, 30 fases:** mover → clique → duplo clique → segurar →
  arrastar → tudo misturado (cada alvo mostra o seu ícone). Dentro do
  mundo: alvos grandes → pequenos → que andam → que pulam e mudam de
  direção. A rodada acelera (alvos menores, mais rápidos e mais numerosos)
  e cada mundo termina com um 🏆 Desafio.
- O mesmo placar, combo, peças especiais (⭐ 🧊 💥) e recorde dos Cadentes.
  Ação errada (clique no vazio, um clique só no alvo de duplo, soltar
  cedo, soltar fora) conta erro e zera o combo, com um aviso do que fazer.
- Pointer events: funciona igual com mouse, dedo e caneta (`touch-action:
  none` evita o zoom do toque duplo). Pausa com Esc, pelo botão ou ao
  trocar de aba.
- Estrelas: 60%, 80% e 95% dos alvos (com até 25% de ações erradas para a
  3ª). O servidor refaz a rodada pela semente e confere o tempo mínimo de
  cada ação; na área do professor aparece a **% de acerto de cada ação**
  (por exemplo ✌️ 45%) e qual ação treinar.

### 💰 Dinheiro e Troco (matemática)
- **Moedas e cédulas desenhadas no estilo do Real** (cor certa e o bicho
  de cada nota: tartaruga no de 2, garça no de 5, arara no de 10, mico-leão
  no de 20, onça no de 50, garoupa no de 100), sem copiar a arte oficial.
  Tudo em centavos por dentro (`money.js`), para não ter erro de vírgula.
- **5 mundos, 16 fases:** quanto tem aqui? (contar, 4 alternativas) →
  pague o valor exato (até R$ 10, até R$ 50, com centavos, sem ver o
  total) → com menos notas e moedas → dê o troco (em reais, com centavos,
  troco grande) → lojinha (somar 2 ou 3 preços, compra e troco).
- Toque numa nota ou moeda para pôr no balcão; toque no balcão para tirar.
  Errou: dica ("passou", "ainda falta", "dá para usar menos notas") e mais
  uma tentativa; no 2º erro, mostra um jeito certo. De primeira vale 1, na
  segunda ½.
- O servidor refaz as tarefas pela semente e confere cada resposta (todo
  valor é pagável com o dinheiro da fase; qualquer jeito certo de pagar
  vale).

### ⚖️ Equilibre a Balança (matemática)
- Balança de dois pratos que **inclina para o lado mais pesado** (os
  pratos ficam retos). O objeto fica à esquerda; a criança põe pesos até
  ficar reta.
- **4 mundos, 10 fases:** equilibrar com pesos (até 10, 20, 50) → pesos
  nos dois pratos (só dá pondo peso do lado do objeto: é uma subtração) →
  gramas e quilos (1 kg = 1.000 g, 1,5 kg) → "quanto pesa?" (o peso do
  objeto é "?": equilibre e escolha quanto ele pesa).
- O gerador (`scale.js`) garante que sempre dá para equilibrar e calcula o
  menor número de pesos; as estrelas são pelas trocas de peso a mais (e
  respostas erradas no "quanto pesa?"). O servidor confere que cada balança
  ficou reta.

### 🧩 Jogos de raciocínio (Memória, Torre de Hanói, Labirinto)
- **As mesmas telas para todos** (`js/shared/puzzleshell.js`): mapa de
  fases, antes da fase (com "como jogar" e o recorde), jogando (com
  "Recomeçar") e resultado (estrelas, recorde, números). Cada jogo só monta
  a área de jogo. O servidor de todos é o mesmo (`src/games/puzzle.js`):
  estrelas e recorde por fase, resumo do painel e do professor, juntar
  contas; cada jogo traz o seu `check`, que refaz a fase pela semente
  (`js/shared/rng.js`) e confere tudo.
- **🃏 Jogo da Memória** (19 fases):
  - os pares vêm em 5 mundos: figura igual, **número e quantidade** (3 ↔
    🍎🍎🍎, em fileiras de 5 para contar fácil), **maiúscula e minúscula**,
    **palavra e figura** e **conta e resultado** (somas, somar e tirar,
    tabuada; cada resultado aparece uma vez só). As fases crescem de 6 a 24
    cartas;
  - **🤖 contra o robô** (mundo 6): cada um vira duas cartas; quem acha o
    par joga de novo. O robô lembra de cada carta que vê com a chance do
    nível (25%, 55%, 85%), inclusive as que a criança vira;
  - estrelas sozinho: tentativas perto do número de pares (até 1,6× = 3,
    até 2,4× = 2); contra o robô: vencer 3, empatar 2. O servidor refaz a
    partida pelas cartas viradas.
- **🗼 Torre de Hanói** (13 fases):
  - torre clássica de 3 a 7 discos, **torre bagunçada** (começa misturada,
    sempre pedindo um bom número de movimentos), **copie o modelo** (chegar
    na arrumação desenhada) e **4 pinos** (5 a 7 discos);
  - tocar num pino pega o disco de cima e tocar em outro solta; também dá
    para arrastar ou usar as teclas 1 a 4;
  - o mínimo de movimentos vem de uma busca em largura (`hanoi.js`), que
    também dá a **💡 dica** do próximo movimento (com dica, no máximo 2
    estrelas). 3 estrelas no mínimo, 2 até 1,5×.
- **🌀 Labirinto** (17 fases, um labirinto novo a cada rodada):
  - do 5 × 5 ao 13 × 13; **chaves e portas** (cada porta tem a chave da
    sua cor, escondida antes dela; sempre há saída); **invisível** (as
    paredes aparecem quando você bate); **no escuro** (só a lanterna em
    volta); **virar e andar** (↶ ⬆ ↷, para treinar a esquerda e a direita
    de quem está dentro);
  - setas do teclado (ou W A S D), botões da tela (segurar repete) ou
    deslizar o dedo. Rastro de por onde já passou;
  - estrelas pelos passos comparados com o caminho mais curto (calculado
    pegando as chaves que precisar). O servidor refaz o caminho comando a
    comando.

### 🚗 🎨 🔍 🧩 Jogos visuais (Carrinhos, Pixel Art, Diferenças, Quebra-cabeça)
Usam as mesmas telas e o mesmo servidor dos jogos de raciocínio. Os dois
com galeria (Pixel Art e Quebra-cabeça) mostram, no mapa, o que a criança
já fez.
- **🚗 Carrinhos** (40 fases, 5 mundos):
  - estacionamento 6 × 6; carros (2 casas) e caminhões (3 casas) só andam
    para a frente e para trás. Arrastar no trilho, ou tocar e usar as setas;
  - as fases vêm de um banco gerado por `scripts/carrinhos-banco.js`: sorteia
    estacionamentos, vai mexendo neles ficando com os mais difíceis e mede,
    por busca em largura, o **mínimo exato** de jogadas (de 2 a 34). O banco
    fica em `bank.js`;
  - **💡 dica:** a próxima jogada certa (busca na hora, em milissegundos),
    com tracejado no lugar; com dica, no máximo 2 estrelas. 3 estrelas até
    1,25× o mínimo, 2 até 2×. O servidor refaz as jogadas uma a uma.
- **🎨 Pixel Art** (30 desenhos, 5 mundos):
  - os desenhos são gerados por `scripts/pixel-desenhos.js` (os pequenos
    linha a linha, os grandes com formas), que também grava uma folha PNG
    para conferir: coração, maçã, gato, foguete, bandeira do Brasil,
    pinguim, coruja, arco-íris, girassol, robô, peixe-palhaço, casa...;
  - escolher a cor na paleta (os quadradinhos dela piscam), tocar ou
    segurar e arrastar. Arrastando, a cor errada só passa por cima; tocando
    na cor errada, conta um erro e o quadradinho fica marcado para corrigir.
    A paleta mostra quantos faltam de cada cor;
  - **🪣 balde** (do mundo 2 em diante): pinta de uma vez a região grudada do
    mesmo número. **🔍 lupa** nos quadros grandes;
  - **🧮 pinte com contas** (mundo 5): no lugar do número, uma conta (+, −,
    ×, ÷) cujo resultado é a cor;
  - estrelas pelos erros, conforme o tamanho do desenho. O servidor refaz a
    pintura (pincel e balde) e confere que ficou tudo certo.
- **🔍 Encontre a Diferença** (20 fases, 5 mundos):
  - cenas em SVG geradas pela semente (`scene.js`): 26 figuras desenhadas no
    jogo, em 3 cenários. As diferenças: figura que sumiu, figura a mais, cor
    trocada, cor de um detalhe, tamanho, lugar e figura virada; nas fases
    "sutis", cores parecidas, mudanças pequenas e cenas cheias;
  - tocar em qualquer uma das duas cenas marca a diferença nas duas; toque
    errado mostra um ✕. **💡 dica** circula uma diferença;
  - estrelas pelos toques errados e dicas. O servidor refaz a cena e os
    toques.
- **🧩 Quebra-cabeça** (18 fases, 5 mundos):
  - as 18 fotos CC0 do Click recortadas em peças com encaixes de verdade
    (`jigsaw.js`, caminhos SVG); de 2 × 2 a 8 × 6;
  - arrastar até a moldura: perto do lugar certo (e na posição certa) a peça
    gruda. Primeiro com a **sombra** da foto, depois sem (dá para segurar
    👁️ e espiar), depois com **peças viradas** (tocar gira). "🧺 Arrumar
    peças" junta as soltas;
  - estrelas pelo tempo (uns segundos por peça); o recorde é o menor tempo.

### ♟️ Jogos de tabuleiro (Jogo da Velha, Ligue 4, Dama e Xadrez)
- **A mesma base para todos** (`js/shared/boardgame.js`, e depois Dama e
  Xadrez): mapa de robôs, "contra um amigo", partida, resultado. Cada jogo
  só traz as regras (`rules.js`, usadas também pelo servidor), as fases
  (`levels.js`) e o desenho do tabuleiro (`game.js`).
- **🤖 Contra o computador:** cada fase é um robô (`js/shared/bot.js`,
  minimax com poda alfa-beta, com limite de profundidade e de tempo). Ele
  pensa num Web Worker (`bot-worker.js`), sem travar a tela, e erra de
  propósito nos níveis baixos. Quem começa alterna a cada partida.
  Desfazer só nos níveis fáceis.
  - Estrelas: ⭐⭐⭐ venceu sem desfazer, ⭐⭐ venceu desfazendo, ⭐ empatou.
    Contra o robô imbatível da Velha, empatar já vale as 3.
  - O servidor refaz a partida lance a lance (`src/games/boardgame.js`),
    recusa lance inválido, partida que não acabou e tempo impossível.
- **👫 Contra um amigo, pela rede** (`src/platform/match.js`, eventos
  `bg:*` do Socket.IO). Cada um joga no seu aparelho:
  - **🔑 código de sala:** 4 letras e QR Code (`/jogos/velha?sala=ABCD`
    entra direto);
  - **🎲 pareamento automático:** "Procurar adversário" junta quem está na
    fila do mesmo jogo, primeiro da mesma turma e, depois de 8 s, qualquer
    um;
  - o **servidor é o juiz** de cada lance, com o mesmo `rules.js`;
  - propor e aceitar empate, desistir. Quem cair tem 1 minuto para voltar
    (a partida continua até depois de recarregar a página); senão, o outro
    vence por abandono;
  - conta no placar (vitórias, empates e derrotas contra amigos), mas não
    dá estrela.
- **❌ Jogo da Velha:** 3 × 3 (Robô Bobinho, Espertinho, Atento e
  Imbatível) e 4 × 4 com 4 em linha (3 robôs).
- **🔴 Ligue 4:** Ligue 4 (7 × 6, 6 robôs, até 8 jogadas à frente) e Ligue 5
  (9 × 7, 4 robôs). A peça cai na coluna, com uma "fantasma" mostrando onde
  vai parar. "⚠️ Mostrar ameaças" marca as colunas onde o adversário
  ganharia na próxima jogada.
- **⚫ Dama brasileira** (5 robôs, até 8 lances à frente):
  - regras oficiais (`dama/rules.js`): a pedra anda para a frente e captura
    para a frente e para trás; a **dama voadora** anda e captura de longe;
    **captura obrigatória com a lei da maioria**; as peças capturadas só
    saem no fim e não são puladas duas vezes; a pedra que só passa pela
    última fileira no meio da captura não vira dama; empate com 20 lances
    de cada lado só com damas; perde quem fica sem lance;
  - as peças que podem jogar ficam destacadas (piscando quando a captura é
    obrigatória). Numa captura de várias peças, a criança toca em cada casa
    onde a peça pousa, e as peças puladas ficam marcadas com ✕.
- **♟️ Xadrez:**
  - regras completas (`xadrez/rules.js`): roque, en passant, promoção com
    escolha da peça, xeque, mate, afogamento, material insuficiente, 3
    repetições e 50 lances. O gerador de lances confere com os números de
    referência (perft) em 5 posições;
  - **🏁 Fim de partida** (9 fases, como o *End of chess game* do GCompris):
    mate em 1 (4), mate em 2 (3), rei e dama contra rei, rei e torre contra
    rei. A criança joga com as brancas; 3 estrelas dando o mate em até o
    número de lances da fase. Essas posições não aparecem no "jogar com um
    amigo";
  - **partidas** contra 6 robôs: do Comilão (só pensa em capturar) ao Mestre
    (4 lances à frente e, no fim da busca, todas as trocas de peças, em
    menos de 2 s). O robô ganhou uma busca de capturas (`bot.js`), usada
    quando o jogo oferece `Rules.captures`;
  - toque na peça para ver as casas possíveis; "⚠️ Mostrar peças atacadas"
    marca as suas peças em perigo. O tabuleiro vira para quem joga de
    pretas.
- **Fases com posição própria:** no `boardlevels.js`, uma fase pode ter a
  própria posição inicial (`variant`), a cor fixa da criança (`seat`) e um
  número de lances para a 3ª estrela (`par`); o servidor confere tudo.
- **Na área do professor:** o robô mais forte que já venceu, as estrelas e
  o placar contra o robô e contra amigos.
- Painel com as seções 🧩 Raciocínio e ♟️ Tabuleiro. Cada seção recolhe
  com um toque, e o painel lembra no navegador.

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
- **Mostrar jogo:** a tabela mostra todos os jogos ou um só (com 7 jogos
  ela ficava larga demais). A escolha fica guardada no navegador.
- **📈 Evolução:** uma coluna com barrinhas das rodadas de cada uma das
  últimas 6 semanas (a verde é a desta semana), mais as rodadas, as fases
  novas (1ª estrela) e a precisão da semana, com ↑/↓ comparando com a
  semana anterior em que jogou. Clicar abre a janela com a tabela semana a
  semana, no total e em cada jogo. Segue o "Mostrar jogo". Vem do histórico
  de rodadas (`game_results`), calculado no servidor (`teacher.evolution`).
- **📥 Baixar planilha:** a lista de agora (turma, busca e jogo escolhidos)
  em CSV com ";" e acentos certos, que abre direto no Excel em português e
  no Google Planilhas: nome, turma, último acesso, rodadas, minutos, fases
  novas e precisão dos últimos 7 dias e o resumo de cada jogo.
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
│       ├── dinheiro/, balanca/  # 💰 ⚖️ matemática do dia a dia: gerador (também no servidor), levels.js, game.js
│       ├── memoria/, hanoi/, labirinto/  # 🧩 raciocínio: regras/gerador (também no servidor), levels.js, game.js
│       ├── carrinhos/, pixel/, diferencas/, quebracabeca/  # 🚗 🎨 🔍 🧩 visuais: regras/gerador, bancos gerados, levels.js, game.js
│       ├── velha/, ligue4/, dama/, xadrez/  # ❌ 🔴 ⚫ ♟️ tabuleiros: rules.js (também no servidor e no robô), levels.js, game.js
│       ├── click/            # 🖱️ Click
│       │   ├── levels.js     # Mundos, ações, ritmo e estrelas (também no servidor)
│       │   ├── targets.js    # Os alvos de cada rodada, com semente (também no servidor)
│       │   ├── actions.js    # Reconhece clique, duplo clique, segurar e soltar no lugar certo
│       │   └── game.js, view.html, game.css
│       ├── numeros/          # ☄️ Números Cadentes (usa o gerador de contas do Conta Comigo)
│       │   ├── levels.js     # Mundos, conteúdos × velocidades e estrelas (também no servidor)
│       │   ├── items.js      # Contas, dados e dominós de cada fase, com semente (também no servidor)
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
├── scripts/                  # carrinhos-banco.js e pixel-desenhos.js: geram os bancos de fases
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
| `test/cadentes.test.js` | Números Cadentes (contas dentro das regras de cada mundo, dados e dominós certos, servidor) e Letras Cadentes: peças certas em todas as fases (só as teclas da fase, sem acento onde não pode, tudo digitável no ABNT2), mesma semente = mesmas peças, servidor recusando resultado impossível, estrelas, progresso, painel por assunto e área do professor. |
| `test/click.test.js` | Click: reconhecimento das ações com eventos de mentira (duplo clique dentro e fora do tempo, segurar curto demais, sair do alvo, soltar fora ou no lugar errado), alvos de todas as fases (mesma semente = mesma rodada, todas as ações aparecem, nenhuma fase igual a outra, mundos em ordem), servidor e área do professor. |
| `test/matematica.test.js` | Conta Comigo: regras do gerador em todas as fases (vai-um/empréstimo onde deve, divisão exata, negativos só nos mundos certos, "qual é o sinal?" com uma resposta só), mesma semente = mesmas contas, servidor conferindo respostas, estrelas, revisão e área do professor. |
| `test/platform.test.js` | Contas (nome e sobrenome, maiúsculas/acentos/espaços, conta repetida, sessão, bichinho, sair) e progresso pela API (estrelas do servidor, fase bloqueada, velocidade impossível, resumos). |
| `test/teacher.test.js` | Área do professor com PIN: cadastro em lote, autocadastro, renomear, juntar contas, liberar fases, desativar, sala de bingo só pelo professor, turmas e a evolução semana a semana. |
| `test/dama-xadrez.test.js` | Dama brasileira (captura obrigatória, lei da maioria, captura para trás, dama voadora, peça capturada não é pulada de novo, coroação só no fim, empate só com damas) e Xadrez (perft em 5 posições, roque, en passant, promoção, mate, afogamento, material insuficiente, 3 repetições, 50 lances; o Fim de partida é mesmo mate em 1 e em 2); o robô acha mates e capturas; o servidor conferindo e dando as estrelas. |
| `test/tabuleiro.test.js` | Jogo da Velha e Ligue 4: regras (vitória em todas as direções, velha, coluna cheia, Ligue 5); o robô (o imbatível nunca perde, completa a linha, bloqueia, respeita o tempo); o servidor conferindo as partidas contra o robô e as estrelas; a partida pela rede (código, pareamento por turma, vez, lance inválido, empate, desistência, queda e volta, abandono). |
| `test/raciocinio.test.js` | Memória (cartas de todas as fases, faces sem repetir, refazer a partida, contra o robô), Torre de Hanói (mínimos, fases bagunçadas não triviais, a dica sempre leva ao objetivo, 4 pinos) e Labirinto (todo labirinto tem saída, chaves pegáveis, porta trancada, modo relativo); o servidor conferindo e dando as estrelas. |
| `test/visuais.test.js` | Carrinhos (o mínimo de cada fase confere com a busca, em ordem de dificuldade), Pixel Art (desenhos certos, as contas dão a cor, pincel e balde), Diferenças (toda cena tem as diferenças pedidas, separadas, e a mesma semente dá a mesma cena) e Quebra-cabeça (encaixes vizinhos se completam, as fotos existem); o servidor conferindo e dando as estrelas. |
| `test/dia-a-dia.test.js` | Dinheiro e Troco (todo valor é pagável com o dinheiro da fase, troco possível, alternativas, "menos notas", qualquer jeito certo vale) e Balança (sempre equilibra, mínimo certo, nos dois pratos precisa tirar, 1,5 kg); o servidor conferindo e dando as estrelas. |
| `test/offline.test.js` | Modo offline: o `/sw.js` sai com a versão e a lista de arquivos (sem as fotos grandes do Click), é JavaScript válido e vem com os cabeçalhos certos. |
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
- Divisão armada (a "chave") na conta armada.
- Minijogos de digitação (chuva de palavras).
- Novos jogos: tabuada, ortografia, quiz.
