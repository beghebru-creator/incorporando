/* Incorporando — Leitor de protocolos.
 * Só faz algo quando a pessoa clica em "Consultar" no app:
 *   1. abre o site do órgão numa aba nova (a aba fica marcada com o protocolo);
 *   2. mostra uma barrinha na página e espera o número do protocolo aparecer
 *      (a pessoa resolve captcha/formulário se o site pedir);
 *   3. lê o texto daquela página e devolve ao app, que compara e grava.
 * Não lê nenhuma outra aba e não consulta nada sozinho. */
const APPS = [
  'https://teste-incorp.web.app',
  'https://teste-incorp.firebaseapp.com',
  'https://teste-incorp--teste-rymcc64a.web.app',
  'https://incorporando.com.br',
  'https://www.incorporando.com.br',
  'https://app.incorporando.com.br'
];
const ehApp = (url) => { try { return APPS.includes(new URL(url).origin); } catch (e) { return false; } };

async function consultas() { return (await chrome.storage.session.get('consultas')).consultas || {}; }
async function salvarConsultas(c) { await chrome.storage.session.set({ consultas: c }); }

async function entregar(appTabId, payload) {
  try { await chrome.tabs.sendMessage(appTabId, payload); return true; }
  catch (e) {
    /* A aba do app foi fechada/recarregada: guarda e entrega quando o app abrir de novo. */
    const { pendentes = [] } = await chrome.storage.local.get('pendentes');
    pendentes.push(payload);
    await chrome.storage.local.set({ pendentes: pendentes.slice(-50) });
    return false;
  }
}

async function lerAba(tabId) {
  const res = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    /* Texto da página + o que está escrito nos campos (muitos sites deixam o
       número só dentro da caixa de busca, sem repetir no resultado). */
    func: () => {
      const t = document.body ? document.body.innerText : '';
      const campos = Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=password]),textarea,select'))
        .map(el => el.tagName === 'SELECT' ? (el.selectedOptions[0] ? el.selectedOptions[0].text : '') : el.value)
        .filter(v => v && String(v).trim()).join('\n');
      return t + (campos ? '\n' + campos : '');
    }
  });
  return res.map(r => r.result || '').join('\n');
}

function numeroNaPagina(texto, numero) {
  const grupos = (String(numero || '').match(/\d+/g) || []).sort((a, b) => b.length - a.length);
  const chave = grupos[0]; if (!chave) return true;
  const semZeros = chave.replace(/^0+/, '') || chave;
  const dig = String(texto || '').replace(/[.\-\/\s]/g, '');
  return dig.includes(chave) || dig.includes(semZeros);
}

chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  (async () => {
    const tab = sender.tab;
    if (!msg || !tab) return responder(null);

    if (msg.tipo === 'consultar') {
      if (!ehApp(sender.url)) return responder({ ok: false });
      let url; try { url = new URL(msg.url); } catch (e) { return responder({ ok: false }); }
      if (!/^https?:$/.test(url.protocol)) return responder({ ok: false });
      const nova = await chrome.tabs.create({ url: url.href, openerTabId: tab.id });
      const c = await consultas();
      c[nova.id] = { protoId: msg.protoId, numero: msg.numero, appTabId: tab.id, enviado: false, em: Date.now() };
      await salvarConsultas(c);
      return responder({ ok: true });
    }

    if (msg.tipo === 'app-pronto') {
      if (!ehApp(sender.url)) return responder(null);
      const { pendentes = [] } = await chrome.storage.local.get('pendentes');
      if (pendentes.length) {
        await chrome.storage.local.set({ pendentes: [] });
        for (const p of pendentes) await entregar(tab.id, p);
      }
      return responder(null);
    }

    /* Daqui para baixo: mensagens da barrinha, só na aba aberta pela consulta. */
    const c = await consultas();
    const cons = c[tab.id];
    if (!cons) return responder(null);

    if (msg.tipo === 'minha-consulta') return responder({ numero: cons.numero, enviado: cons.enviado });

    if (msg.tipo === 'ler') {
      const texto = await lerAba(tab.id);
      return responder({ achou: numeroNaPagina(texto, cons.numero), tamanho: texto.length, assinatura: texto.length + ':' + texto.slice(-200) });
    }

    if (msg.tipo === 'enviar') {
      const texto = await lerAba(tab.id);
      await entregar(cons.appTabId, { tipo: 'resultado', protoId: cons.protoId, numero: cons.numero, texto, url: tab.url, em: Date.now(), manual: !!msg.manual });
      for (const k of Object.keys(c)) if (c[k].protoId === cons.protoId && c[k].appTabId === cons.appTabId) c[k].enviado = true;
      await salvarConsultas(c);
      return responder({ ok: true });
    }
    responder(null);
  })();
  return true;
});

/* Página da consulta carregou (ou a pessoa navegou dentro dela): mostra a barrinha. */
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const c = await consultas();
  if (!c[tabId]) return;
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ['barra.js'] }); } catch (e) { /* página que não aceita (ex.: PDF) */ }
});

/* O site abriu o resultado numa aba/janela nova: ela também fica marcada. */
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.openerTabId) return;
  const c = await consultas();
  const mae = c[tab.openerTabId];
  if (!mae) return;
  c[tab.id] = Object.assign({}, mae, { em: Date.now() });
  await salvarConsultas(c);
});

/* Fechou a aba sem ler: avisa o app para parar de esperar. */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const c = await consultas();
  const cons = c[tabId];
  if (!cons) return;
  delete c[tabId]; await salvarConsultas(c);
  const outra = Object.values(c).some(x => x.protoId === cons.protoId && x.appTabId === cons.appTabId);
  if (!cons.enviado && !outra) { try { await chrome.tabs.sendMessage(cons.appTabId, { tipo: 'cancelada', protoId: cons.protoId }); } catch (e) {} }
});
