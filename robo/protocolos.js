/* Robô de protocolos do Incorporando.
 *
 * Lê só os protocolos em que alguém clicou em "Consultar" no app
 * (robo.pedidoEm mais novo que robo.lidoEm). Para cada um:
 *   1. abre o link de consulta (o mesmo que o app abre, já com o número);
 *   2. se o número não aparece na página, tenta preencher o primeiro campo
 *      de texto com o número e enviar (sites com formulário simples);
 *   3. compara o texto da página com a leitura anterior
 *      (fluxoapp_meta/protobase_<id>) e grava no protocolo se houve ou não
 *      movimentação, com as linhas novas.
 * Sites com captcha ou login ficam como "Robô não leu a página" — a pessoa
 * registra manualmente no app.
 *
 * Uso:
 *   node protocolos.js --verificar   → só conta os pedidos (para o GitHub
 *                                       Actions decidir se instala o navegador)
 *   node protocolos.js               → lê os pedidos
 * Chave: variável FIREBASE_SA com o JSON da conta de serviço (aceita texto
 * extra em volta). A conta precisa do papel "Cloud Datastore User".
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const admin = require('firebase-admin');

function lerChave(raw) {
  raw = String(raw || '');
  for (const txt of [raw, raw.replace(/\r|\n/g, '')]) {
    for (let k = txt.indexOf('{'); k >= 0; k = txt.indexOf('{', k + 1)) {
      for (let e = txt.lastIndexOf('}'); e > k; e = txt.lastIndexOf('}', e - 1)) {
        try {
          const o = JSON.parse(txt.slice(k, e + 1));
          if (o && o.type === 'service_account') return o;
        } catch (_) { /* tenta o próximo trecho */ }
      }
    }
  }
  throw new Error('Não achei a chave da conta de serviço em FIREBASE_SA.');
}

admin.initializeApp({ credential: admin.credential.cert(lerChave(process.env.FIREBASE_SA)) });
const db = admin.firestore();
const COL = db.collection('fluxoapp_meta');
const FV = admin.firestore.FieldValue;

/* Mesma regra do app (protoMontarLink no index.html). */
function montarLink(link, numero) {
  let u = String(link || '').trim(); if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const n = String(numero || '').trim(); const m = n.match(/^(.*?)[\/\-](\d{4})$/);
  const seq = m ? m[1] : n, ano = m ? m[2] : '';
  const leve = v => String(v).replace(/[ &?#]/g, c => encodeURIComponent(c));
  return u.replace(/\{numero_url\}/gi, encodeURIComponent(n)).replace(/\{numero\}|\{num\}/gi, leve(n))
    .replace(/\{ano\}/gi, leve(ano)).replace(/\{seq\}/gi, leve(seq));
}

/* O número "está na página"? Compara o maior grupo de dígitos do protocolo
   (ex.: 123456 em 01-123456/2026), sem pontos, traços ou barras. */
function numeroNaPagina(texto, numero) {
  const grupos = String(numero || '').match(/\d+/g) || [];
  const chave = grupos.sort((a, b) => b.length - a.length)[0];
  if (!chave) return true;
  const semZeros = chave.replace(/^0+/, '') || chave;
  const digitos = String(texto || '').replace(/[.\-\/\s]/g, '');
  return digitos.includes(chave) || digitos.includes(semZeros);
}

/* Texto comparável: sem linhas vazias, espaços repetidos e carimbos da hora
   da consulta (que mudam toda vez sem ser movimentação). */
const CARIMBO = /(consultad[oa]\s+em|data\s+da\s+consulta|gerad[oa]\s+em|emitid[oa]\s+em|impress[oa]\s+em|data\/hora|hor[áa]rio\s+atual|última\s+atualização\s+da\s+página)/i;
function normalizar(texto) {
  return String(texto || '').split(/\n+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l && !CARIMBO.test(l) && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(l))
    .filter((l, i, a) => a.indexOf(l) === i || l.length > 3); /* tira repetições curtas (menus) */
}

async function lerPagina(browser, url, numero) {
  const ctx = await browser.newContext({ locale: 'pt-BR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const textoTudo = async () => {
    const partes = [];
    for (const f of page.frames()) { try { partes.push(await f.evaluate(() => document.body ? document.body.innerText : '')); } catch (_) {} }
    return partes.join('\n');
  };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    let texto = await textoTudo();
    let preencheu = false;
    if (!numeroNaPagina(texto, numero)) {
      /* Formulário simples: primeiro campo de texto visível → número → Enter. */
      const campo = page.locator('input[type="text"]:visible, input[type="search"]:visible, input[type="number"]:visible, input:not([type]):visible').first();
      if (await campo.count()) {
        await campo.fill(String(numero));
        await campo.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        texto = await textoTudo(); preencheu = true;
      }
    }
    return { texto, achou: numeroNaPagina(texto, numero), preencheu };
  } finally { await ctx.close(); }
}

async function main() {
  const verificar = process.argv.includes('--verificar');
  const snap = await COL.where('tipo', '==', 'protocolo').get();
  const pedidos = snap.docs.map(d => ({ ref: d.ref, ...d.data() }))
    .filter(p => !p.removido && p.robo && Number(p.robo.pedidoEm) > (Number(p.robo.lidoEm) || 0));
  console.log(`${pedidos.length} protocolo(s) aguardando leitura.`);
  if (verificar) {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `pendentes=${pedidos.length}\n`);
    return;
  }
  if (!pedidos.length) return;

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const p of pedidos) {
      const agora = Date.now();
      const url = montarLink(p.link, p.numero);
      let resultado, msg = '', textoHist = '';
      const extra = {};
      try {
        if (!url) throw new Error('Protocolo sem link de consulta.');
        const lido = await lerPagina(browser, url, p.numero);
        if (!lido.achou) {
          resultado = 'nao_leu';
          msg = 'O número não apareceu na página (o site pode pedir captcha, login ou mais campos). Confira e registre manualmente.';
        } else {
          const linhas = normalizar(lido.texto);
          const hash = crypto.createHash('sha256').update(linhas.join('\n')).digest('hex');
          const baseRef = COL.doc('protobase_' + p.id);
          const base = await baseRef.get();
          if (!base.exists || !base.data().hash) {
            resultado = 'base';
            msg = 'Leitura guardada; as próximas consultas serão comparadas com esta.';
          } else if (base.data().hash === hash) {
            resultado = 'sem';
          } else {
            resultado = 'mov';
            const antes = new Set(String(base.data().texto || '').split('\n'));
            const novas = linhas.filter(l => !antes.has(l));
            textoHist = (novas.length ? novas.slice(0, 15).join('\n') : 'A página mudou (conteúdo reorganizado).').slice(0, 1500);
            Object.assign(extra, { novaMov: true, ultimaMovEm: agora, ultimaMovTexto: textoHist, ultimaMovOrigem: 'robo' });
          }
          await baseRef.set({ tipo: 'protoBase', protoId: p.id, hash, texto: linhas.join('\n').slice(0, 300000), lidoEm: agora, url });
        }
      } catch (e) {
        resultado = 'erro'; msg = String(e && e.message || e).slice(0, 300);
      }
      const h = { id: 'r' + agora.toString(36), em: agora, por: 'robô', origem: 'robo', resultado, texto: textoHist || msg };
      await p.ref.set({ ...extra, historico: FV.arrayUnion(h), robo: { ...(p.robo || {}), lidoEm: agora, status: resultado, msg } }, { merge: true });
      console.log(`${p.numero}: ${resultado}${msg ? ' — ' + msg : ''}`);
    }
  } finally { await browser.close(); }
}

main().catch(e => { console.error(e); process.exit(1); });
