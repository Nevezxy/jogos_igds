// public/js/platform/auth.js
// Login do educando, só com o nome e o sobrenome:
//   1) a criança digita o nome
//   2a) a conta existe → "É você?" com o bichinho dela → Sou eu!
//   2b) não existe → "É a sua primeira vez?" → escolhe o bichinho → cria a conta
// A confirmação existe para um erro de digitação não virar uma conta nova.
// O token da sessão fica no localStorage; ao abrir a página, a criança
// já logada vai direto para o painel. Qual tela mostrar depois do login ou
// da saída é decisão do roteador (router.js), que escuta onLogin/onLogout.

(function () {
  const api = window.PlataformaApi;
  const { showScreen, toast, createAvatarPicker } = window.BingoUI;
  const { play } = window.BingoSound;

  const STORAGE_KEY = 'igds_student_v1';

  let student = null;
  const loginListeners = [];
  const logoutListeners = [];
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  const card = document.querySelector('.login-card');
  const speech = document.getElementById('login-speech');
  const mascot = document.getElementById('login-mascot');
  const nameInput = document.getElementById('input-login-name');
  let step = 'name';
  let typedName = '';
  let busy = false;

  const SPEECH = {
    name: 'Oi! Qual é o seu nome e sobrenome? 😊',
    confirm: 'É você? 👀',
    new: 'Não achei ninguém com esse nome 🤔 É a sua primeira vez aqui?',
    avatar: 'Oba! Agora escolha o seu bichinho 🐾',
  };

  // Mensagens do servidor em linguagem de criança.
  const FRIENDLY_ERRORS = {
    NOME_SEM_SOBRENOME: 'Escreva o nome e o sobrenome, assim: Maria Silva ✏️',
    NOME_INVALIDO: 'Use só letras no nome, sem números ✏️',
    NOME_IMPROPRIO: 'Esse nome não pode 🙅 Escreva o seu nome de verdade!',
    CONTA_DESATIVADA: 'Essa conta está desligada. Fale com o(a) professor(a) 🙋',
    SEM_CONEXAO: 'Não consegui falar com o servidor 😵 Tente de novo!',
  };

  function readStoredToken() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function storeToken(token) {
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  // ---------------- passos ----------------

  function goToStep(name, message) {
    step = name;
    card.querySelectorAll('.login-step').forEach((el) => { el.hidden = el.dataset.step !== name; });
    speech.textContent = message || SPEECH[name];
    window.BingoMascot.setMood('idle', mascot);
    const focusTarget = {
      name: nameInput,
      confirm: document.getElementById('login-its-me'),
      new: document.getElementById('login-first-time'),
    }[name];
    setTimeout(() => {
      if (name === 'avatar') avatarPicker.focus();
      else if (focusTarget) focusTarget.focus();
    }, 60);
  }

  function showError(message) {
    speech.textContent = message;
    window.BingoMascot.setMood('wow', mascot);
    play('bonk');
    window.BingoFx.shake(card.querySelector(`.login-step[data-step="${step}"]`));
  }

  function friendly(e) {
    return FRIENDLY_ERRORS[e.code] || e.message || 'Algo deu errado. Tente de novo!';
  }

  async function withBusy(fn) {
    if (busy) return;
    busy = true;
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try { await fn(); } finally {
      busy = false;
      card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  }

  // ---------------- passo 1: nome ----------------

  document.getElementById('form-login').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameInput.value.replace(/\s+/g, ' ').trim();
    if (name.split(' ').filter((w) => w.length >= 2).length < 2) {
      showError(FRIENDLY_ERRORS.NOME_SEM_SOBRENOME);
      return;
    }
    withBusy(async () => {
      try {
        const res = await api.post('/auth/lookup', { name });
        typedName = name;
        play('pop');
        if (res.exists) {
          document.getElementById('login-who-avatar').textContent = res.avatar;
          document.getElementById('login-who-name').textContent = res.name;
          goToStep('confirm');
        } else {
          document.getElementById('login-new-name').textContent = res.name;
          goToStep('new');
        }
      } catch (e) {
        showError(friendly(e));
      }
    });
  });

  // ---------------- passo 2a: é você? ----------------

  document.getElementById('login-its-me').addEventListener('click', () => withBusy(async () => {
    try {
      finishLogin(await api.post('/auth/login', { name: typedName }));
    } catch (e) {
      showError(friendly(e));
    }
  }));

  document.getElementById('login-not-me').addEventListener('click', () => {
    goToStep('name', 'Hmm! Confere se escreveu certinho ✏️ Se outra pessoa tiver o mesmo nome, peça ajuda ao(à) professor(a) 🙋');
    nameInput.select();
  });

  // ---------------- passo 2b: primeira vez? ----------------

  document.getElementById('login-first-time').addEventListener('click', () => {
    if (!avatarPicker.value()) avatarPicker.selectRandom();
    goToStep('avatar');
  });

  document.getElementById('login-typo').addEventListener('click', () => {
    goToStep('name', 'Tudo bem! Escreva de novo, com calma ✏️');
    nameInput.select();
  });

  // ---------------- passo 3: bichinho e criar conta ----------------

  const avatarPicker = createAvatarPicker(document.getElementById('login-avatar-grid'));

  document.getElementById('login-avatar-back').addEventListener('click', () => goToStep('new'));

  document.getElementById('login-create').addEventListener('click', () => withBusy(async () => {
    try {
      const res = await api.post('/auth/register', { name: typedName, avatar: avatarPicker.value() });
      finishLogin(res, true);
    } catch (e) {
      if (e.code === 'CONTA_JA_EXISTE') {
        // alguém criou a mesma conta enquanto a criança escolhia o bichinho
        goToStep('name', 'Opa! Essa conta já existe. Escreva o nome de novo e toque em Entrar 😊');
      } else {
        showError(friendly(e));
      }
    }
  }));

  // ---------------- sessão ----------------

  function setStudent(value) {
    student = value;
  }

  async function setAvatar(avatar) {
    const res = await api.post('/auth/avatar', { avatar });
    setStudent(res.student);
    return student;
  }

  function finishLogin(res, isNew = false) {
    storeToken(res.token);
    api.setToken(res.token);
    setStudent(res.student);
    play('start');
    toast(isNew ? `Conta criada! Bem-vindo(a), ${student.firstName}! 🎉` : `Oi, ${student.firstName}! 👋`, 'success', 3000);
    if (isNew) window.BingoFx.confetti();
    loginListeners.forEach((fn) => fn(student));
  }

  function openLogin() {
    nameInput.value = '';
    typedName = '';
    goToStep('name');
    showScreen('screen-login');
  }

  async function logout() {
    const hadToken = readStoredToken();
    storeToken(null);
    setStudent(null);
    if (hadToken) api.post('/auth/logout').catch(() => { /* a sessão some do aparelho mesmo assim */ });
    api.setToken(null);
    logoutListeners.forEach((fn) => fn());
  }

  // Tela "inicial" de quem está neste aparelho: painel se logado, senão login.
  function goHome() {
    window.PlataformaRouter.go(student ? '/jogos' : '/');
  }

  document.getElementById('create-back').addEventListener('click', goHome);

  async function init() {
    // o telão do bingo não tem login: ele só assiste a sala
    if (window.BingoScreen && window.BingoScreen.isScreenMode()) { resolveReady(); return; }
    const token = readStoredToken();
    if (token) {
      api.setToken(token);
      try {
        const res = await api.get('/auth/me');
        setStudent(res.student);
      } catch (e) {
        api.setToken(null);
        if (e.code === 'SEM_CONEXAO') toast(FRIENDLY_ERRORS.SEM_CONEXAO, 'error', 4000);
        else storeToken(null); // sessão expirada ou conta desativada
      }
    }
    resolveReady();
  }

  // roda depois de todos os scripts da página (o bingo registra BingoScreen)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);

  window.PlataformaAuth = {
    ready,
    student: () => student,
    isLoggedIn: () => Boolean(student),
    onLogin: (fn) => loginListeners.push(fn),
    onLogout: (fn) => logoutListeners.push(fn),
    goHome,
    logout,
    openLogin,
    setAvatar,
  };
})();
