// public/games/bingo/packs.js
// Pacotes prontos de itens para os modos Palavras, Emojis e Personalizado.
// O professor marca um ou mais pacotes e os itens vão para a lista do modo
// (que continua editável). Cada modo soma mais de 200 itens.
// Palavras e itens personalizados são separados por vírgula; emojis, por espaço.

(function () {
  const words = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);
  const emojis = (text) => text.split(/\s+/).filter(Boolean);

  const PACKS = {
    words: [
      {
        id: 'w-animais', icon: '🐾', label: 'Animais',
        items: words(`Cachorro, Gato, Leão, Tigre, Elefante, Girafa, Zebra, Macaco, Coelho, Tartaruga,
          Jacaré, Cobra, Sapo, Peixe, Baleia, Golfinho, Tubarão, Polvo, Pinguim, Coruja,
          Papagaio, Galinha, Pato, Vaca, Cavalo, Porco, Ovelha, Cabra, Urso, Lobo,
          Raposa, Esquilo, Rato, Morcego, Abelha, Borboleta, Formiga, Joaninha, Aranha, Minhoca,
          Caracol, Camelo, Canguru, Hipopótamo, Rinoceronte, Panda, Onça, Tucano, Arara, Capivara`),
      },
      {
        id: 'w-comidas', icon: '🍎', label: 'Frutas e comidas',
        items: words(`Maçã, Banana, Laranja, Uva, Morango, Abacaxi, Melancia, Manga, Pera, Limão,
          Mamão, Goiaba, Caju, Coco, Kiwi, Cereja, Arroz, Feijão, Macarrão, Pão,
          Queijo, Leite, Ovo, Bolo, Biscoito, Sorvete, Pipoca, Pizza, Sopa, Salada,
          Cenoura, Tomate, Batata, Alface, Milho, Abóbora, Brócolis, Pepino, Chocolate, Mel,
          Suco, Iogurte, Tapioca, Cuscuz, Pamonha`),
      },
      {
        id: 'w-escola', icon: '✏️', label: 'Escola',
        items: words(`Lápis, Caneta, Borracha, Caderno, Livro, Mochila, Régua, Tesoura, Cola, Estojo,
          Apontador, Giz, Lousa, Mesa, Cadeira, Professor, Aluno, Recreio, Lanche, Merenda,
          Prova, Lição, Leitura, Escrita, Desenho, Pintura, Música, Matemática, Ciências, História,
          Geografia, Português, Inglês, Biblioteca, Quadra, Uniforme, Agenda, Mapa, Globo, Calculadora`),
      },
      {
        id: 'w-corpo', icon: '🖐️', label: 'Corpo humano',
        items: words(`Cabeça, Cabelo, Olho, Nariz, Boca, Dente, Língua, Orelha, Pescoço, Ombro,
          Braço, Cotovelo, Mão, Dedo, Unha, Barriga, Costas, Perna, Joelho, Pé,
          Calcanhar, Coração, Pulmão, Cérebro, Osso, Pele, Sobrancelha, Bochecha, Queixo, Testa`),
      },
      {
        id: 'w-cores', icon: '🎨', label: 'Cores e formas',
        items: words(`Vermelho, Azul, Amarelo, Verde, Laranja, Roxo, Rosa, Marrom, Preto, Branco,
          Cinza, Dourado, Prateado, Círculo, Quadrado, Triângulo, Retângulo, Estrela, Coração, Losango,
          Oval, Cubo, Esfera, Cilindro, Pirâmide`),
      },
      {
        id: 'w-natureza', icon: '🌳', label: 'Natureza',
        items: words(`Sol, Lua, Nuvem, Chuva, Vento, Arco-íris, Trovão, Raio, Neve, Mar,
          Rio, Lago, Cachoeira, Montanha, Vulcão, Floresta, Árvore, Flor, Folha, Grama,
          Pedra, Areia, Praia, Ilha, Deserto, Céu, Planeta, Terra, Fogo, Água,
          Semente, Raiz, Girassol, Cacto, Cogumelo, Concha, Onda, Caverna, Galho, Orvalho`),
      },
      {
        id: 'w-profissoes', icon: '👩‍🚒', label: 'Profissões',
        items: words(`Médico, Enfermeiro, Bombeiro, Policial, Professor, Cozinheiro, Padeiro, Pintor, Pedreiro, Motorista,
          Piloto, Astronauta, Cientista, Dentista, Veterinário, Agricultor, Carteiro, Jornalista, Fotógrafo, Cantor,
          Ator, Dançarino, Atleta, Juiz, Advogado, Engenheiro, Arquiteto, Programador, Mecânico, Eletricista,
          Costureira, Cabeleireiro, Jardineiro, Pescador, Marinheiro`),
      },
      {
        id: 'w-tecnologia', icon: '💻', label: 'Tecnologia',
        items: words(`Computador, Internet, Teclado, Mouse, Tela, Celular, Tablet, Robô, Programa, Código,
          Jogo, Aplicativo, Senha, Arquivo, Pasta, Site, E-mail, Câmera, Fone, Impressora,
          Wi-Fi, Bateria, Carregador, Vídeo, Foto, Download, Upload, Nuvem, Algoritmo, Pixel,
          Botão, Ícone, Janela, Navegador, Bluetooth, Drone, Sensor, Chip, Bit, Programação`),
      },
    ],

    emojis: [
      {
        id: 'e-animais', icon: '🐶', label: 'Bichos',
        items: emojis(`🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆
          🦅 🦉 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🐢 🐍 🦎 🦖 🐙 🦑 🦀
          🐡 🐠 🐟 🐬 🐳 🦈 🐊 🦓 🦒 🐘`),
      },
      {
        id: 'e-comidas', icon: '🍕', label: 'Comidas',
        items: emojis(`🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🥜 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕
          🌽 🥔 🍞 🧀 🥚 🥞 🧇 🍗 🍔 🍟 🍕 🌭 🥪 🌮 🍝 🍜 🍣 🍦 🍩 🍪
          🎂 🍰 🧁 🍫 🍿`),
      },
      {
        id: 'e-natureza', icon: '🌈', label: 'Natureza e clima',
        items: emojis(`☀️ 🌙 ⭐ 🌟 ☁️ 🌧️ ⛈️ ❄️ 🌈 🌊 🔥 💧 🌍 🌋 ⛰️ 🏝️ 🌵 🌲 🌳 🌴
          🌱 🍀 🍁 🍂 🌻 🌹 🌷 🌸 🍄 🐚`),
      },
      {
        id: 'e-brincadeiras', icon: '⚽', label: 'Esportes e brincadeiras',
        items: emojis(`⚽ 🏀 🏈 ⚾ 🎾 🏐 🏓 🏸 🥊 🛹 ⛸️ 🎿 🏊 🚴 🤸 🏆 🥇 🎯 🎳 🎮
          🎲 🧩 🪁 🎨 🎭 🎤 🎸 🥁 🎹 🎈`),
      },
      {
        id: 'e-objetos', icon: '✏️', label: 'Escola e casa',
        items: emojis(`✏️ 🖍️ 🖊️ 📏 📐 ✂️ 📚 📖 📒 📎 📌 🎒 🧮 🔬 🔭 💡 ⏰ 📱 💻 🖥️
          ⌨️ 🖱️ 📷 📺 🪑 🛏️ 🚪 🔑 🧸 🎁`),
      },
      {
        id: 'e-transportes', icon: '🚀', label: 'Transportes',
        items: emojis(`🚗 🚕 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚜 🏍️ 🛵 🚲 🛴 🚂 🚆 🚇 ✈️
          🚁 🚀 🛸 ⛵ 🚤`),
      },
      {
        id: 'e-rostinhos', icon: '😀', label: 'Rostinhos',
        items: emojis(`😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤓
          😎 🥳 😏 😴 🤔 🤗 🤭 😮 😱 🤠`),
      },
    ],

    custom: [
      {
        id: 'c-bichos', icon: '🦁', label: 'Bichos com nome',
        items: words(`🐶 Cachorro, 🐱 Gato, 🐭 Rato, 🐰 Coelho, 🦊 Raposa, 🐻 Urso, 🐼 Panda, 🐯 Tigre, 🦁 Leão, 🐮 Vaca,
          🐷 Porco, 🐸 Sapo, 🐵 Macaco, 🐔 Galinha, 🐧 Pinguim, 🦆 Pato, 🦉 Coruja, 🐺 Lobo, 🐴 Cavalo, 🦄 Unicórnio,
          🐝 Abelha, 🦋 Borboleta, 🐌 Caracol, 🐞 Joaninha, 🐢 Tartaruga, 🐍 Cobra, 🦖 Dinossauro, 🐙 Polvo, 🦀 Caranguejo, 🐠 Peixe,
          🐬 Golfinho, 🐳 Baleia, 🦈 Tubarão, 🐊 Jacaré, 🦓 Zebra, 🦒 Girafa, 🐘 Elefante, 🦘 Canguru, 🦜 Papagaio, 🦔 Ouriço`),
      },
      {
        id: 'c-comidas', icon: '🍓', label: 'Comidas com nome',
        items: words(`🍎 Maçã, 🍐 Pera, 🍊 Laranja, 🍋 Limão, 🍌 Banana, 🍉 Melancia, 🍇 Uva, 🍓 Morango, 🍒 Cereja, 🍑 Pêssego,
          🥭 Manga, 🍍 Abacaxi, 🥥 Coco, 🥝 Kiwi, 🍅 Tomate, 🥑 Abacate, 🥦 Brócolis, 🥕 Cenoura, 🌽 Milho, 🥔 Batata,
          🍞 Pão, 🧀 Queijo, 🥚 Ovo, 🍕 Pizza, 🍿 Pipoca`),
      },
      {
        id: 'c-silabas', icon: '🔤', label: 'Sílabas',
        items: words(`BA, BE, BI, BO, BU, CA, CO, CU, DA, DE, DI, DO, DU, FA, FE, FI, FO, FU,
          GA, GO, GU, JA, JE, JI, JO, JU, LA, LE, LI, LO, LU, MA, ME, MI, MO, MU,
          NA, NE, NI, NO, NU, PA, PE, PI, PO, PU, RA, RE, RI, RO, RU, SA, SE, SI, SO, SU,
          TA, TE, TI, TO, TU, VA, VE, VI, VO, VU`),
      },
      {
        id: 'c-alfabeto', icon: '🅰️', label: 'Alfabeto',
        items: words('A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z'),
      },
      {
        id: 'c-extenso', icon: '🔢', label: 'Números por extenso',
        items: words(`Um, Dois, Três, Quatro, Cinco, Seis, Sete, Oito, Nove, Dez,
          Onze, Doze, Treze, Catorze, Quinze, Dezesseis, Dezessete, Dezoito, Dezenove, Vinte,
          Vinte e um, Vinte e dois, Vinte e três, Vinte e quatro, Vinte e cinco,
          Vinte e seis, Vinte e sete, Vinte e oito, Vinte e nove, Trinta`),
      },
      {
        id: 'c-estados', icon: '🗺️', label: 'Estados do Brasil',
        items: words(`Acre, Alagoas, Amapá, Amazonas, Bahia, Ceará, Distrito Federal, Espírito Santo, Goiás, Maranhão,
          Mato Grosso, Mato Grosso do Sul, Minas Gerais, Pará, Paraíba, Paraná, Pernambuco, Piauí, Rio de Janeiro,
          Rio Grande do Norte, Rio Grande do Sul, Rondônia, Roraima, Santa Catarina, São Paulo, Sergipe, Tocantins`),
      },
    ],
  };

  window.BingoPacks = PACKS;
})();
