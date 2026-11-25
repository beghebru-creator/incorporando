/* Barrinha que aparece só na aba aberta pelo botão Consultar do Incorporando.
 *  • Se o site já foi "ensinado", preenche os campos (número, senha, texto fixo…)
 *    e clica no botão de pesquisar — só uma vez por consulta, e sem clicar
 *    sozinho quando a página tem captcha.
 *  • Espera o número do protocolo aparecer e a página parar de mudar, aí lê e
 *    envia ao app. O botão "Ler esta página" envia na hora.
 *  • "Ensinar preenchimento": a pessoa clica nos campos do site e diz o que vai
 *    em cada um; o molde fica guardado no app (vale para toda a equipe). */
(async function () {
  if (window.__incorporandoBarra) return;
  window.__incorporandoBarra = true;
  const cons = await chrome.runtime.sendMessage({ tipo: 'minha-consulta' });
  if (!cons) return;
  cons.moldes = Array.isArray(cons.moldes) ? cons.moldes : [];

  /* ───────── interface ───────── */
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;';
  const raiz = host.attachShadow({ mode: 'closed' });
  raiz.innerHTML = `
    <style>
      .w{font:13px/1.4 system-ui,Segoe UI,Arial,sans-serif;background:#1f3a2e;color:#fff;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.3);max-width:min(780px,94vw);}
      .b{display:flex;align-items:center;gap:8px;padding:10px 14px;flex-wrap:wrap}
      .i{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:8px 14px 0;font-size:12.5px;color:#e6ece9;}
      .i b{color:#f6a04d;font-weight:600}
      .i .o{flex-basis:100%;white-space:pre-line;color:#cfd8d3}
      .m{display:none;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 14px 0;font-size:12.5px}
      .m.on{display:flex}
      .m .q{flex-basis:100%;font-weight:600;color:#f6a04d}
      .t{font-weight:700;color:#f6a04d;white-space:nowrap}
      .s{flex:1;min-width:220px}
      button{font:600 12px system-ui,Arial,sans-serif;border:0;border-radius:7px;padding:6px 10px;cursor:pointer;background:#e8650c;color:#fff;white-space:nowrap}
      button.sec{background:rgba(255,255,255,.14)}
      button.x{background:transparent;color:#cfd8d3;font-size:16px;padding:2px 6px}
      button.c{background:rgba(255,255,255,.12);padding:3px 8px;font-size:11.5px;margin-left:4px}
      input{font:13px system-ui,Arial,sans-serif;border:0;border-radius:6px;padding:5px 8px;min-width:200px}
      .hide{display:none}
    </style>
    <div class="w">
      <div class="i"></div>
      <div class="m"></div>
      <div class="b">
        <span class="t">Incorporando</span><span class="s"></span>
        <button class="preencher sec hide">Preencher</button>
        <button class="ensinar sec">Ensinar preenchimento</button>
        <button class="ler">Ler esta página</button>
        <button class="x" title="Esconder">×</button>
      </div>
    </div>`;
  (document.body || document.documentElement).appendChild(host);
  const $ = (s) => raiz.querySelector(s);
  const status = (txt) => { $('.s').textContent = txt; };
  $('.x').onclick = () => host.remove();

  /* Número, senha e observações com botão de copiar. */
  const info = $('.i');
  const item = (rotulo, valor, mostrar) => {
    const s = document.createElement('span');
    const b = document.createElement('b'); b.textContent = rotulo + ' '; s.appendChild(b);
    s.appendChild(document.createTextNode(mostrar));
    const bt = document.createElement('button'); bt.className = 'c'; bt.textContent = 'Copiar';
    bt.onclick = async () => { try { await navigator.clipboard.writeText(valor); bt.textContent = 'Copiado'; setTimeout(() => { bt.textContent = 'Copiar'; }, 1500); } catch (e) { bt.textContent = 'Não copiou'; } };
    s.appendChild(bt); info.appendChild(s);
  };
  item('Nº', cons.numero, cons.numero);
  if (cons.doc) item('CPF/CNPJ', cons.doc, cons.doc);
  if (cons.senha) item('Senha', cons.senha, '••••••');
  if (cons.obs) { const o = document.createElement('span'); o.className = 'o'; const b = document.createElement('b'); b.textContent = 'Obs. '; o.appendChild(b); o.appendChild(document.createTextNode(cons.obs)); info.appendChild(o); }

  /* ───────── valores e campos ───────── */
  const partes = () => {
    const n = String(cons.numero || '').trim(); const m = n.match(/^(.*?)[\/\-](\d{4})$/);
    return { numero: n, seq: m ? m[1] : n, ano: m ? m[2] : '' };
  };
  const ROTULOS = { numero: 'Número completo', seq: 'Número sem o ano', ano: 'Só o ano', doc: 'CPF/CNPJ do requerente', senha: 'Senha', obs: 'Observações', fixo: 'Texto fixo' };
  const valorDe = (c) => {
    const p = partes();
    if (c.valor === 'numero') return p.numero;
    if (c.valor === 'seq') return p.seq;
    if (c.valor === 'ano') return p.ano;
    if (c.valor === 'doc') return cons.doc || '';
    if (c.valor === 'senha') return cons.senha || '';
    if (c.valor === 'obs') return cons.obs || '';
    return c.fixo || '';
  };
  /* Seletor estável do elemento: id → name → caminho na página. */
  function seletor(el) {
    try {
      if (el.id && !/\d{5,}|:/.test(el.id) && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
      const nm = el.getAttribute('name');
      if (nm) { const s = el.tagName.toLowerCase() + '[name="' + CSS.escape(nm) + '"]'; if (document.querySelectorAll(s).length === 1) return s; }
    } catch (e) { /* segue para o caminho */ }
    const caminho = []; let e = el;
    while (e && e.nodeType === 1 && e !== document.body && e !== document.documentElement) {
      let i = 1, irmao = e; while ((irmao = irmao.previousElementSibling)) if (irmao.tagName === e.tagName) i++;
      caminho.unshift(e.tagName.toLowerCase() + ':nth-of-type(' + i + ')'); e = e.parentElement;
    }
    return 'body > ' + caminho.join(' > ');
  }
  const achar = (sel) => { try { return document.querySelector(sel); } catch (e) { return null; } };
  /* Preenche como se fosse digitado (funciona em sites feitos com React/Angular). */
  function preencherCampo(el, v) {
    v = String(v == null ? '' : v);
    try { el.focus(); } catch (e) {}
    if (el.tagName === 'SELECT') {
      const alvo = v.trim().toLowerCase();
      const op = Array.from(el.options).find(o => o.value === v || o.text.trim().toLowerCase() === alvo) || Array.from(el.options).find(o => alvo && o.text.trim().toLowerCase().includes(alvo));
      if (op) el.value = op.value;
    } else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    try { el.blur(); } catch (e) {}
  }
  /* Só conta captcha que aparece na tela (o reCAPTCHA invisível/v3 e campos
     escondidos não impedem o clique automático). */
  const temCaptcha = () => Array.from(document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha, [class*="captcha" i], [id*="captcha" i], img[src*="captcha" i]'))
    .some(el => { if (el.closest('.grecaptcha-badge')) return false; if (/size=invisible/.test(el.getAttribute('src') || '')) return false;
      const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
      return r.width > 40 && r.height > 20 && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0'; });
  function moldeDaPagina() {
    const ms = cons.moldes.filter(m => m.host === location.host && Array.isArray(m.campos) && m.campos.length);
    const completo = (m) => m.campos.every(c => achar(c.sel));
    return ms.find(m => m.path === location.pathname && completo(m)) || ms.find(completo) || null;
  }
  async function aplicar(m, clicar) {
    m.campos.forEach(c => { const el = achar(c.sel); if (el) preencherCampo(el, valorDe(c)); });
    await chrome.runtime.sendMessage({ tipo: 'marcar-preenchido' });
    cons.preenchido = true;
    if (clicar && m.botao && !temCaptcha()) {
      const b = achar(m.botao);
      if (b) { status('Campos preenchidos. Pesquisando…'); setTimeout(() => b.click(), 500); return 'clicou'; }
    }
    status(temCaptcha()
      ? 'Campos preenchidos. Resolva o captcha e clique em pesquisar: o app lê o resultado quando o número aparecer.'
      : 'Campos preenchidos. Clique em pesquisar no site: o app lê o resultado quando o número aparecer.');
    return 'preencheu';
  }

  /* ───────── leitura e envio ao app ───────── */
  let enviado = !!cons.enviado, ultimaAssinatura = '', estavel = 0, voltas = 0, timer = null, ensinando = null;
  /* Esta página carregou depois do preenchimento automático (é o resultado)? */
  const resultadoDoPreenchimento = !!cons.preenchido;
  const siteEnsinado = cons.moldes.some(m => m.host === location.host);
  let assinaturaInicial = null;
  const enviar = async (manual) => {
    status('Lendo a página…');
    await chrome.runtime.sendMessage({ tipo: 'enviar', manual });
    enviado = true; clearInterval(timer);
    status('Página lida e enviada ao Incorporando. Pode fechar esta aba.');
  };
  $('.ler').onclick = () => enviar(true);

  /* ───────── ensinar preenchimento ───────── */
  const marcados = [];
  const marcar = (el, cor) => { marcados.push([el, el.style.outline]); el.style.outline = '3px solid ' + cor; el.style.outlineOffset = '2px'; };
  const desmarcar = () => { marcados.forEach(([el, o]) => { el.style.outline = o; }); marcados.length = 0; };
  const menu = $('.m');
  const fecharMenu = () => { menu.classList.remove('on'); menu.innerHTML = ''; };
  function renderEnsino() {
    if (!ensinando) return;
    const n = ensinando.campos.length;
    status(ensinando.etapa === 'botao'
      ? 'Agora clique no botão de pesquisar/consultar do site (ele não será enviado agora).'
      : (n === 0
        ? 'Passo 1: clique no primeiro campo do site (ex.: número do protocolo) e escolha o que vai nele.'
        : 'Marcados: ' + ensinando.campos.map((c, i) => (i + 1) + ') ' + (c.valor === 'fixo' ? 'texto fixo "' + c.fixo + '"' : ROTULOS[c.valor])).join(' · ') +
          (ensinando.botao ? ' · botão de pesquisar ✓' : '') + '. Clique no próximo campo, ou em "Marcar botão de pesquisar" e depois em Salvar.'));
    $('.ensinar').classList.add('hide'); $('.ler').classList.add('hide'); $('.preencher').classList.add('hide');
    let ctl = raiz.querySelector('.ctl');
    if (!ctl) {
      ctl = document.createElement('span'); ctl.className = 'ctl'; ctl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
      ctl.innerHTML = '<button class="bt sec">Marcar botão de pesquisar</button><button class="sv">Salvar</button><button class="cc sec">Cancelar</button>';
      $('.x').before(ctl);
      ctl.querySelector('.bt').onclick = () => { ensinando.etapa = 'botao'; fecharMenu(); renderEnsino(); };
      ctl.querySelector('.sv').onclick = salvarEnsino;
      ctl.querySelector('.cc').onclick = () => sairEnsino('Ensino cancelado.');
    }
  }
  function sairEnsino(msg) {
    ensinando = null; document.removeEventListener('click', capturar, true);
    desmarcar(); fecharMenu();
    const ctl = raiz.querySelector('.ctl'); if (ctl) ctl.remove();
    $('.ensinar').classList.remove('hide'); $('.ler').classList.remove('hide');
    $('.ensinar').textContent = moldeDaPagina() ? 'Ensinar de novo' : 'Ensinar preenchimento';
    if (moldeDaPagina()) $('.preencher').classList.remove('hide');
    if (msg) status(msg);
  }
  function perguntar(el) {
    menu.innerHTML = '<span class="q">O que vai neste campo?</span>';
    const escolher = (valor, fixo) => {
      const c = { sel: seletor(el), valor };
      if (valor === 'fixo') c.fixo = fixo;
      ensinando.campos = ensinando.campos.filter(x => x.sel !== c.sel).concat([c]);
      preencherCampo(el, valorDe(c)); marcar(el, '#2f9e6e'); fecharMenu(); renderEnsino();
    };
    ['numero', 'seq', 'ano', 'doc', 'senha', 'obs'].forEach(v => {
      const b = document.createElement('button'); b.className = 'sec'; b.textContent = ROTULOS[v];
      if ((v === 'doc' && !cons.doc) || (v === 'senha' && !cons.senha) || (v === 'obs' && !cons.obs)) b.title = 'Este protocolo ainda não tem esse dado no app — cadastre na janela do protocolo; o molde já fica pronto.';
      b.onclick = () => escolher(v); menu.appendChild(b);
    });
    const bf = document.createElement('button'); bf.className = 'sec'; bf.textContent = 'Texto fixo…';
    bf.onclick = () => {
      menu.innerHTML = '<span class="q">Texto que sempre vai neste campo (ex.: tipo de processo, CPF/CNPJ):</span>';
      const inp = document.createElement('input'); inp.value = el.tagName === 'SELECT' ? (el.selectedOptions[0] ? el.selectedOptions[0].text : '') : (el.value || '');
      const ok = document.createElement('button'); ok.textContent = 'OK'; ok.onclick = () => escolher('fixo', inp.value);
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); escolher('fixo', inp.value); } };
      menu.appendChild(inp); menu.appendChild(ok); setTimeout(() => inp.focus(), 0);
    };
    menu.appendChild(bf);
    const bi = document.createElement('button'); bi.className = 'sec'; bi.textContent = 'Não preencher'; bi.onclick = fecharMenu; menu.appendChild(bi);
    menu.classList.add('on');
  }
  function capturar(e) {
    if (!ensinando) return;
    if (e.composedPath().includes(host)) return;
    if (ensinando.etapa === 'botao') {
      const b = e.target.closest('button, input[type=submit], input[type=button], input[type=image], a, [role=button], [onclick]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      ensinando.botao = seletor(b); marcar(b, '#e8650c'); ensinando.etapa = 'campos'; renderEnsino();
      return;
    }
    const el = e.target.closest('input, select, textarea');
    if (!el || /^(button|submit|checkbox|radio|image|hidden|file|reset)$/i.test(el.type || '')) return;
    perguntar(el);
  }
  async function salvarEnsino() {
    if (!ensinando.campos.length) { status('Clique em pelo menos um campo do site antes de salvar.'); return; }
    const molde = { host: location.host, path: location.pathname, campos: ensinando.campos, botao: ensinando.botao || '', em: Date.now() };
    await chrome.runtime.sendMessage({ tipo: 'molde-salvar', molde });
    cons.moldes = cons.moldes.filter(m => !(m.host === molde.host && m.path === molde.path)).concat([molde]);
    sairEnsino('Preenchimento salvo para este site. Nas próximas consultas, os campos serão preenchidos sozinhos.');
    if (molde.botao && !temCaptcha()) { const b = achar(molde.botao); if (b) { status('Preenchimento salvo. Pesquisando…'); await chrome.runtime.sendMessage({ tipo: 'marcar-preenchido' }); setTimeout(() => b.click(), 500); } }
    else if (temCaptcha()) status('Preenchimento salvo. Resolva o captcha e clique em pesquisar.');
  }
  $('.ensinar').onclick = () => {
    if (ensinando) return;
    ensinando = { campos: [], botao: '', etapa: 'campos' };
    document.addEventListener('click', capturar, true);
    renderEnsino();
  };
  $('.preencher').onclick = () => { const m = moldeDaPagina(); if (m) aplicar(m, true); };

  /* ───────── início ───────── */
  if (enviado) {
    status('Protocolo ' + cons.numero + ': esta consulta já foi enviada. Clique em "Ler esta página" para enviar esta página também.');
    if (moldeDaPagina()) { $('.preencher').classList.remove('hide'); $('.ensinar').textContent = 'Ensinar de novo'; }
    return;
  }
  status('Protocolo ' + cons.numero + ': aguardando o número aparecer na página. Se o site pedir, preencha a consulta.');

  /* Foto da página antes de preencher (para saber depois se o resultado apareceu). */
  try { const r0 = await chrome.runtime.sendMessage({ tipo: 'ler' }); assinaturaInicial = r0 ? r0.assinatura : ''; } catch (e) { assinaturaInicial = ''; }

  /* Preenchimento automático (só uma vez por consulta). Espera até 10 s o
     formulário aparecer em sites que montam a página aos poucos. */
  if (cons.moldes.some(m => m.host === location.host)) {
    $('.ensinar').textContent = 'Ensinar de novo';
    let t = 0;
    const tentar = async () => {
      if (ensinando || enviado) return;
      const m = moldeDaPagina();
      if (m) {
        $('.preencher').classList.remove('hide');
        if (!cons.preenchido) await aplicar(m, true);
        return;
      }
      if (++t < 20) setTimeout(tentar, 500);
      else if (!cons.preenchido) status('Não encontrei os campos ensinados nesta página (o site pode ter mudado). Preencha à mão ou clique em "Ensinar de novo".');
    };
    setTimeout(tentar, 600);
  }

  timer = setInterval(async () => {
    if (enviado) return clearInterval(timer);
    if (ensinando) return;
    if (++voltas > 300) { clearInterval(timer); status('Não encontrei o número ' + cons.numero + ' na página. Se o resultado já está na tela, clique em "Ler esta página".'); return; }
    const r = await chrome.runtime.sendMessage({ tipo: 'ler' });
    if (!r || !r.achou) { estavel = 0; ultimaAssinatura = ''; return; }
    /* Número só dentro dos campos: em site ensinado, pode ser só o que a
       extensão acabou de preencher — espera o resultado (página nova ou
       conteúdo que mudou). */
    if (!r.noTexto && siteEnsinado && !resultadoDoPreenchimento && r.assinatura === assinaturaInicial) return;
    if (r.assinatura === ultimaAssinatura) estavel++; else { estavel = 0; ultimaAssinatura = r.assinatura; }
    status('Protocolo ' + cons.numero + ' encontrado. Lendo…');
    if (estavel >= 1) enviar(false);
  }, 1500);
})();
