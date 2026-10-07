// public/js/shared/socket-client.js
// Wrapper fino sobre o socket.io-client: guarda a conexão única da aba
// e transforma emits com callback (ack) em Promises, para um código
// mais legível nos outros arquivos.

const socket = io({ autoConnect: true, reconnection: true, reconnectionDelay: 600 });

function emitAsync(event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (res) => {
      if (res && res.ok) resolve(res);
      else reject(res || { ok: false, message: 'Sem resposta do servidor.' });
    });
  });
}

window.BingoSocket = { socket, emitAsync };
