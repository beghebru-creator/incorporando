/* Roda dentro do Incorporando: liga a página do app à extensão. */
(function () {
  function anunciar() {
    window.postMessage({ origem: 'incorporando-ext', tipo: 'pronta', versao: chrome.runtime.getManifest().version }, location.origin);
  }
  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.origem !== 'incorporando-app') return;
    if (d.tipo === 'ping') anunciar();
    if (d.tipo === 'consultar') {
      chrome.runtime.sendMessage({ tipo: 'consultar', protoId: String(d.protoId || ''), numero: String(d.numero || ''), senha: String(d.senha || ''), obs: String(d.obs || ''), url: String(d.url || '') });
    }
  });
  chrome.runtime.onMessage.addListener(function (m) {
    if (m && (m.tipo === 'resultado' || m.tipo === 'cancelada')) {
      window.postMessage(Object.assign({}, m, { origem: 'incorporando-ext' }), location.origin);
    }
  });
  anunciar();
  chrome.runtime.sendMessage({ tipo: 'app-pronto' });
})();
