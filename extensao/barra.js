/* Barrinha que aparece só na aba aberta pelo botão Consultar do Incorporando.
 * Espera o número do protocolo aparecer na página e a página parar de mudar,
 * aí lê e envia ao app. O botão "Ler esta página" envia na hora. */
(async function () {
  if (window.__incorporandoBarra) return;
  window.__incorporandoBarra = true;
  const cons = await chrome.runtime.sendMessage({ tipo: 'minha-consulta' });
  if (!cons) return;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;';
  const raiz = host.attachShadow({ mode: 'closed' });
  raiz.innerHTML = `
    <style>
      .b{font:13px/1.4 system-ui,Segoe UI,Arial,sans-serif;display:flex;align-items:center;gap:10px;background:#1f3a2e;color:#fff;
         padding:10px 14px;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.3);max-width:min(720px,92vw);}
      .t{font-weight:700;color:#f6a04d;white-space:nowrap}
      .s{flex:1}
      button{font:600 12px system-ui,Arial,sans-serif;border:0;border-radius:7px;padding:6px 10px;cursor:pointer;background:#e8650c;color:#fff;white-space:nowrap}
      button.x{background:transparent;color:#cfd8d3;font-size:16px;padding:2px 6px}
    </style>
    <div class="b"><span class="t">Incorporando</span><span class="s"></span><button class="ler">Ler esta página</button><button class="x" title="Esconder">×</button></div>`;
  (document.body || document.documentElement).appendChild(host);
  const status = (txt) => { raiz.querySelector('.s').textContent = txt; };
  raiz.querySelector('.x').onclick = () => host.remove();

  let enviado = !!cons.enviado, ultimaAssinatura = '', estavel = 0, voltas = 0, timer = null;
  const enviar = async (manual) => {
    status('Lendo a página…');
    await chrome.runtime.sendMessage({ tipo: 'enviar', manual });
    enviado = true; clearInterval(timer);
    status('Página lida e enviada ao Incorporando. Pode fechar esta aba.');
  };
  raiz.querySelector('.ler').onclick = () => enviar(true);

  if (enviado) { status('Protocolo ' + cons.numero + ': esta consulta já foi enviada. Clique em "Ler esta página" para enviar esta página também.'); return; }
  status('Protocolo ' + cons.numero + ': aguardando o número aparecer na página. Se o site pedir, preencha a consulta.');

  timer = setInterval(async () => {
    if (enviado) return clearInterval(timer);
    if (++voltas > 300) { clearInterval(timer); status('Não encontrei o número ' + cons.numero + ' na página. Se o resultado já está na tela, clique em "Ler esta página".'); return; }
    const r = await chrome.runtime.sendMessage({ tipo: 'ler' });
    if (!r) return;
    if (!r.achou) { estavel = 0; ultimaAssinatura = ''; return; }
    /* Número apareceu: espera a página parar de mudar (2 leituras iguais). */
    if (r.assinatura === ultimaAssinatura) estavel++; else { estavel = 0; ultimaAssinatura = r.assinatura; }
    status('Protocolo ' + cons.numero + ' encontrado. Lendo…');
    if (estavel >= 1) enviar(false);
  }, 1500);
})();
