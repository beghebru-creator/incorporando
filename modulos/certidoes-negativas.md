# Módulo guardado: Certidões negativas (Portal DI)

Retirado do app em 22/11/2026 a pedido da Brunna ("por enquanto"), para implementar depois.
Os DADOS não foram apagados: continuam em `fluxoapp_meta/registros`, campo `certidoesNeg`
(`{imoveis:{[emp]:{situacao,ultimaConsulta,vencimento}}, empresas:{...}, socios:[{id,nome,situacao,ultimaConsulta,vencimento}]}`).

## O que era
- Aba "Certidões negativas" do Portal DI (grupo Unidades), com 3 seções: Imóveis, Empresas e Sócios.
- Cada certidão: situação (Negativa / Positiva c/ efeito de negativa / Positiva (débitos)), última consulta e vencimento (alerta "vence em Xd", "vencida há Xd").
- Imóveis e Empresas puxam os empreendimentos de Dados; Sócios são cadastrados à mão.

## Como recolocar no index.html
1. Colar o bloco JS abaixo antes de `/* ═══ ... CONTROLE FINANCEIRO` ou perto de `RegistrosUnidades`.
2. Colar o CSS no `<style>` (perto de `.venc-card.superado`).
3. Catálogo `PORTAL_ABAS`, depois de `iptu`:
   `{key:'certidoes', nome:'Certidões negativas', ic:'ti-certificate', grupo:'unidades', dados:'compartilhado', desc:'CND dos imóveis, das empresas e dos sócios — situação, última consulta e vencimento.'},`
4. `PORTAIS_FIXOS.portaldi.abas`: acrescentar `'certidoes'` depois de `'iptu'`.
5. No `PortalDI`, junto do `salvarCertidoesEmps`:
```js
const salvarCertidoesNeg=(certidoesNeg)=>{
  setRegistros(r=>({...r,certidoesNeg}));
  if(!DEMO_MODE) REGISTROS_DOC.set({certidoesNeg},{merge:true}).catch(err=>console.error('Erro ao salvar certidões negativas:',err));
};
```
   e no `onSnapshot` do REGISTROS_DOC manter `certidoesNeg:d.certidoesNeg||{}` em `setRegistros`.
6. Card na tela inicial do Portal DI (depois do IPTU):
```jsx
<div className="pdi-tool" onClick={()=>setView('certidoes')}>
  <i className="ti ti-certificate"/>
  <div className="tt">Certidões negativas</div>
  <div className="dd">CND dos imóveis, das empresas e dos sócios — situação, última consulta e vencimento de cada certidão.</div>
</div>
```
7. Rota:
```jsx
if(view==='certidoes'){
  return <CertidoesView projects={projects} certidoesNeg={registros&&registros.certidoesNeg} setCertidoesNeg={salvarCertidoesNeg} onBack={()=>setView('home')}/>;
}
```
8. Slugs: `PORTAL_VIEW_TO_SLUG.certidoes='certidoes'` e `SLUG_TO_PORTAL_VIEW.certidoes='certidoes'`.

## CSS
```css
  /* Certidões: colunas alinhadas iguais nas 3 abas + caixa mais alta */
  .cert-wrap{min-height:calc(125vh - 215px);max-height:calc(125vh - 215px);}
  .venc-table.cert-fixed{table-layout:fixed;}
  .venc-table.cert-fixed .venc-emp{white-space:normal;}
  .venc-table.cert-fixed td,.venc-table.cert-fixed th{overflow:hidden;text-overflow:ellipsis;}
```

## Código (JS/JSX)
```jsx
/* ═══════════════════════════════════════════════════════════════════════════
   CERTIDÕES NEGATIVAS (Portal DI) — três seções (Imóveis, Empresas, Sócios).
   Cada certidão: situação, última consulta e vencimento. Imóveis e Empresas
   puxam de Dados (empreendimentos); Sócios são manuais. Salvo em
   fluxoapp_meta/portaldi (campo certidoesNeg). Depois um robô pode atualizar.
   ═══════════════════════════════════════════════════════════════════════════ */
function certVenceInfo(venc){
  const d=venc?new Date(venc+'T00:00:00'):null; if(!d||isNaN(d)) return null;
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const dias=Math.round((d-hoje)/86400000);
  if(dias<0) return {txt:'vencida há '+Math.abs(dias)+'d', cls:'nao'};
  if(dias<=30) return {txt:'vence em '+dias+'d', cls:'aten'};
  return {txt:'vence em '+dias+'d', cls:'sim'};
}
function certFmtBR(iso){ const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); if(m) return m[3]+'/'+m[2]+'/'+m[1]; if(iso){ const d=new Date(iso); if(!isNaN(d)) return d.toLocaleDateString('pt-BR'); } return '—'; }
function certSitBadge(s){
  if(!s) return React.createElement('span',{style:{color:'var(--text3)',fontSize:11}},'— aguardando —');
  const cls=(s==='Negativa'||s==='Positiva c/ efeito de negativa'||s==='ok')?'sim':(s==='Positiva (débitos)'||s==='pendencia'||s==='nao')?'nao':'neutro';
  return React.createElement('span',{className:'reg-badge '+cls}, s);
}
function CertidoesView({projects,certidoesNeg,setCertidoesNeg,onBack}){
  const[tab,setTab]=useState('imoveis');
  const cn=certidoesNeg||{};
  const imoveisMap=cn.imoveis||{}, empresasMap=cn.empresas||{};
  const socios=Array.isArray(cn.socios)?cn.socios:[];
  const ativos=(projects||[]).filter(p=>!p.archived&&!p.deleted);
  const imoveisList=[...new Set(ativos.map(p=>p.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt'));
  const empresasList=[...new Set(ativos.map(p=>p.empresaNome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt'));
  const emptyCN={imoveis:{},empresas:{},socios:[]};
  const base=()=>({...emptyCN,...cn});
  const addSocio=()=>{ const b=base(); setCertidoesNeg({...b,socios:[...(b.socios||[]),{id:'soc-'+Date.now(),nome:'',situacao:'',ultimaConsulta:'',vencimento:''}]}); };
  const setSocio=(id,patch)=>{ const b=base(); setCertidoesNeg({...b,socios:(b.socios||[]).map(s=>s.id===id?{...s,...patch}:s)}); };
  const delSocio=(id)=>{ const b=base(); setCertidoesNeg({...b,socios:(b.socios||[]).filter(s=>s.id!==id)}); };

  /* Situação, última consulta e vencimento são SÓ LEITURA aqui — preenchidos
     pelo robô de certidões. Nos Sócios, só o nome é editável (a lista é manual). */
  const vencCell=(v)=>{ const info=certVenceInfo(v); if(!info) return <span style={{color:'var(--text3)',fontSize:11}}>—</span>;
    return <span className={'venc-badge '+(info.cls==='nao'?'vencido':info.cls==='aten'?'avencer':'vigente')}>{info.txt}</span>; };

  /* Larguras fixas compartilhadas pelas 3 abas para alinhar as colunas
     Situação / Última consulta / Vencimento exatamente na mesma posição. */
  const certCols=(
    <colgroup>
      <col style={{width:'30%'}}/>
      <col style={{width:'17%'}}/>
      <col style={{width:'17%'}}/>
      <col style={{width:'17%'}}/>
      <col style={{width:'13%'}}/>
      <col style={{width:'6%'}}/>
    </colgroup>
  );

  const tabelaFixa=(lista,mapa,vazioMsg)=>(
    <div className="venc-table-wrap cert-wrap"><table className="venc-table cert-fixed">
      {certCols}
      <thead><tr><th>Identificação</th><th>Situação</th><th>Última consulta</th><th>Vencimento</th><th>Prazo</th><th></th></tr></thead>
      <tbody>
        {lista.length===0 && <tr><td colSpan={6}><div className="venc-empty">{vazioMsg}</div></td></tr>}
        {lista.map(nome=>{ const d=mapa[nome]||{}; return (
          <tr key={nome}>
            <td className="venc-emp">{nome}</td>
            <td>{certSitBadge(d.texto||d.situacao)}</td>
            <td className="venc-date">{certFmtBR(d.ultimaConsulta||d.atualizadoEm)}</td>
            <td className="venc-date">{certFmtBR(d.vencimento)}</td>
            <td>{vencCell(d.vencimento)}</td>
            <td></td>
          </tr>
        ); })}
      </tbody>
    </table></div>
  );

  return (
    <div className="pdi-wrap">
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,flexWrap:'wrap'}}>
        <button className="pdi-btn ghost" onClick={onBack}><i className="ti ti-arrow-left"/> Voltar</button>
        <div className="fin-tabs">
          <button className={'fin-tab'+(tab==='imoveis'?' active':'')} onClick={()=>setTab('imoveis')}><i className="ti ti-home"/> Imóveis</button>
          <button className={'fin-tab'+(tab==='empresas'?' active':'')} onClick={()=>setTab('empresas')}><i className="ti ti-building-skyscraper"/> Empresas</button>
          <button className={'fin-tab'+(tab==='socios'?' active':'')} onClick={()=>setTab('socios')}><i className="ti ti-users"/> Sócios</button>
        </div>
      </div>
      <div className="venc-note" style={{maxWidth:'none',marginBottom:10}}>Certidões negativas de débitos (CND). A situação, a última consulta e o vencimento são preenchidos automaticamente pelo robô de certidões. Imóveis e Empresas vêm dos empreendimentos cadastrados em Dados; Sócios são adicionados aqui.</div>
      {tab==='imoveis' && tabelaFixa(imoveisList,imoveisMap,'Nenhum empreendimento cadastrado em Dados ainda.')}
      {tab==='empresas' && tabelaFixa(empresasList,empresasMap,'Nenhuma empresa cadastrada em Dados ainda (campo "Empresa" dos empreendimentos).')}
      {tab==='socios' && (<>
        <div className="venc-table-wrap cert-wrap"><table className="venc-table cert-fixed">
          {certCols}
          <thead><tr><th>Sócio</th><th>Situação</th><th>Última consulta</th><th>Vencimento</th><th>Prazo</th><th></th></tr></thead>
          <tbody>
            {socios.length===0 && <tr><td colSpan={6}><div className="venc-empty">Nenhum sócio cadastrado. Clique em "Adicionar sócio".</div></td></tr>}
            {socios.map(s=>(
              <tr key={s.id}>
                <td><input className="pdi-input" style={{width:'100%',minWidth:0}} value={s.nome||''} onChange={e=>setSocio(s.id,{nome:e.target.value})} placeholder="Nome do sócio"/></td>
                <td>{certSitBadge(s.texto||s.situacao)}</td>
                <td className="venc-date">{certFmtBR(s.ultimaConsulta||s.atualizadoEm)}</td>
                <td className="venc-date">{certFmtBR(s.vencimento)}</td>
                <td>{vencCell(s.vencimento)}</td>
                <td style={{width:40,textAlign:'center'}}><button className="venc-act-btn del" title="Remover sócio" onClick={()=>delSocio(s.id)}><i className="ti ti-trash"/></button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div style={{marginTop:10}}><button className="pdi-btn ghost" onClick={addSocio}><i className="ti ti-plus"/> Adicionar sócio</button></div>
      </>)}
    </div>
  );
}
```
