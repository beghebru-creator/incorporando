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
      .w{font:13px/1.4 system-ui,Segoe UI,Arial,sans-serif;background:#1f3a2e;color:#fff;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.3);max-width:min(760px,94vw);}
      .b{display:flex;align-items:center;gap:10px;padding:10px 14px;}
      .i{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:8px 14px 0;font-size:12.5px;color:#e6ece9;}
      .i b{color:#f6a04d;font-weight:600}
      .i .o{flex-basis:100%;white-space:pre-line;color:#cfd8d3}
      .c{background:rgba(255,255,255,.12);padding:3px 8px;font-size:11.5px;margin-left:4px}
      .t{font-weight:700;color:#f6a04d;white-space:nowrap}
      .s{flex:1}
      button{font:600 12px system-ui,Arial,sans-serif;border:0;border-radius:7px;padding:6px 10px;cursor:pointer;background:#e8650c;color:#fff;white-space:nowrap}
      button.x{background:transparent;color:#cfd8d3;font-size:16px;padding:2px 6px}
    </style>
    <div class="w"><div class="i"></div><div class="b"><span class="t">Incorporando</span><span class="s"></span><button class="ler">Ler esta página</button><button class="x" title="Esconder">×</button></div></div>`;
  (document.body || document.documentElement).appendChild(host);
  const status = (txt) => { raiz.querySelector('.s').textContent = txt; };
  /* Dados para preencher a consulta: número, senha e observações, com copiar. */
  const info = raiz.querySelector('.i');
  const item = (rotulo, valor, mostrar) => {
    const s = document.createElement('span');
    const b = document.createElement('b'); b.textContent = rotulo + ' '; s.appendChild(b);
    s.appendChild(document.createTextNode(mostrar));
    const bt = document.createElement('button'); bt.className = 'c'; bt.textContent = 'Copiar';
    bt.onclick = async () => { try { await navigator.clipboard.writeText(valor); bt.textContent = 'Copiado'; setTimeout(() => { bt.textContent = 'Copiar'; }, 1500); } catch (e) { bt.textContent = 'Não copiou'; } };
    s.appendChild(bt); info.appendChild(s);
  };
  item('Nº', cons.numero, cons.numero);
  if (cons.senha) item('Senha', cons.senha, '••••••');
  if (cons.obs) { const o = document.createElement('span'); o.className = 'o'; const b = document.createElement('b'); b.textContent = 'Obs. '; o.appendChild(b); o.appendChild(document.createTextNode(cons.obs)); info.appendChild(o); }
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
