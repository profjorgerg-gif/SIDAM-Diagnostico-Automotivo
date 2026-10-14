// SIDAM – Sistema Inteligente de Diagnóstico Automotivo de Motores · versão 1.0
import "./plataforma.js";
let DB = await (await fetch("./base/sidam-base-inicial.json", {cache:"no-cache"})).json();
let C = Object.fromEntries(DB.causas.map(c => [c.id, c]));
let P = Object.fromEntries(DB.pecas.map(p => [p.id, p.nome]));
let S = Object.fromEntries(DB.sintomas.map(s => [s.id, s]));
let Q = Object.fromEntries(DB.perguntas.map(q => [q.id, q]));
let CATS = [...new Set(DB.sintomas.map(s => s.categoria))];
const URG = {baixa:"Baixa", media:"Média", alta:"Alta", critica:"Crítica"};
const URGTXT = {baixa:"Pode aguardar a revisão", media:"Levar à oficina em breve", alta:"Levar à oficina o quanto antes", critica:"Não rodar com o veículo"};
const COMB = {flex:"Flex", gasolina:"Gasolina", diesel:"Diesel"};

const st = {step:1, comb:"flex", turbo:false, sel:[], cats:[CATS[0]], ans:{}, more:false, veic:{modelo:"",placa:"",km:"",resp:""}, view:"diag", num:null, criadoEm:null, salvo:false};
const view = document.getElementById("view");
const esc = t => String(t).replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

const compat = c => c.combustiveis.includes(st.comb) && (!c.somenteTurbo || st.turbo);

function perguntasAtivas(){
  const out = [];
  st.sel.forEach(sid => S[sid].perguntas.forEach(qid => {
    const q = Q[qid];
    const alvos = [...(q.efeitos.sim||[]), ...(q.efeitos.nao||[])].map(e => C[e.causaId]);
    if (alvos.some(compat)) out.push(q);
  }));
  return out;
}

function diagnosticar(){
  const score = {}, origem = {};
  st.sel.forEach(sid => S[sid].causas.forEach(({causaId, peso}) => {
    if (!compat(C[causaId])) return;
    score[causaId] = (score[causaId]||0) + peso;
    (origem[causaId] ||= []).push(S[sid].nome);
  }));
  perguntasAtivas().forEach(q => {
    const r = st.ans[q.id];
    if (!r || r === "ns") return;
    (q.efeitos[r]||[]).forEach(({causaId, multiplicador}) => { if (score[causaId] != null) score[causaId] *= multiplicador; });
  });
  const ids = Object.keys(score).sort((a,b) => score[b]-score[a]);
  const tot = ids.reduce((s,i) => s+score[i], 0) || 1;
  const raw = ids.map(i => score[i]/tot*100);
  const pct = raw.map(Math.floor);
  let resto = 100 - pct.reduce((a,b)=>a+b,0);
  raw.map((v,i)=>[v-Math.floor(v),i]).sort((a,b)=>b[0]-a[0]).slice(0,resto).forEach(([,i])=>pct[i]++);
  return ids.map((id,i) => ({c:C[id], pct:pct[i], origem:origem[id]}));
}

function setSteps(){
  [...document.querySelectorAll("#steps li")].forEach((li,i) => {
    li.className = i+1 < st.step ? "done" : i+1 === st.step ? "on" : "";
    li.toggleAttribute("aria-current", i+1 === st.step);
  });
}

function go(n){ if (n < 4 && st.salvo) st.salvo = false; st.step = n; st.view = "diag"; mostrarAba(); render(); window.scrollTo({top:0}); }
function mostrarAba(){ document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === st.view))); document.getElementById("steps").hidden = st.view !== "diag"; }
function novoNumero(){ const a = new Date(), p = n => String(n).padStart(2,"0");
  return {num:`SIDAM-${a.getFullYear()}${p(a.getMonth()+1)}${p(a.getDate())}-${p(a.getHours())}${p(a.getMinutes())}${p(a.getSeconds())}`, iso:a.toISOString()}; }

function render(){
  setSteps();
  ({1:r1, 2:r2, 3:r3, 4:r4})[st.step]();
}

function r1(){
  view.innerHTML = `
  <div class="wrap" style="gap:16px">
    <div><h1>Qual é o motor do veículo?</h1>
    <p class="lead">O tipo de motor define quais causas fazem sentido. Um carro sem turbo, por exemplo, não pode ter defeito na turbina.</p></div>
    <div class="panel">
      <span class="label">Combustível</span>
      <div class="opts" role="radiogroup" aria-label="Combustível">
        ${Object.entries({flex:"Etanol e gasolina", gasolina:"Somente gasolina", diesel:"Picapes, utilitários e caminhões"}).map(([k,d]) => `
        <label class="opt"><input type="radio" name="comb" id="comb-${k}" value="${k}" ${st.comb===k?"checked":""}><strong>${COMB[k]}</strong><small>${d}</small></label>`).join("")}
      </div>
      <span class="label">Sobrealimentação</span>
      <label class="switch"><input type="checkbox" id="turbo" ${st.turbo?"checked":""}><span><b>Motor turbo</b><br><small style="color:var(--muted)">Marque se o motor tem turbocompressor (versões TSI, TGDI, turbo diesel etc.)</small></span></label>
    </div>
    <div class="panel">
      <span class="label">Identificação para o relatório (opcional)</span>
      <div class="fields">
        ${[["modelo","Modelo e ano","Ex.: Onix 1.0 2019"],["placa","Placa","Ex.: ABC1D23"],["km","Quilometragem","Ex.: 85.000"],["resp","Responsável","Nome de quem fez o diagnóstico"]].map(([k,l,ph]) => `
        <label class="fld" for="v-${k}"><span>${l}</span><input id="v-${k}" data-k="${k}" type="text" placeholder="${ph}" value="${esc(st.veic[k])}" autocomplete="off"></label>`).join("")}
      </div>
    </div>
    <div class="nav"><button class="link" id="ex" type="button">Ver um exemplo pronto</button><button class="btn primary" id="next" type="button">Continuar para sintomas</button></div>
  </div>`;
  view.querySelectorAll('input[name=comb]').forEach(i => i.onchange = () => st.comb = i.value);
  view.querySelector("#turbo").onchange = e => st.turbo = e.target.checked;
  view.querySelectorAll(".fld input").forEach(i => i.oninput = () => st.veic[i.dataset.k] = i.value);
  view.querySelector("#next").onclick = () => go(2);
  view.querySelector("#ex").onclick = () => {
    const fumaca = DB.sintomas.find(s => s.nome.startsWith("Fumaça azul"));
    const oleo = DB.sintomas.find(s => s.nome.startsWith("Consumo excessivo de óleo"));
    Object.assign(st, {comb:"flex", turbo:false, sel:[fumaca.id, oleo.id], cats:[fumaca.categoria, oleo.categoria], ans:{}});
    st.ans[fumaca.perguntas[0]] = "sim";
    go(3);
  };
}

function r2(){
  const todas = st.cats.length === CATS.length;
  const grupos = CATS.filter(c => st.cats.includes(c)).map(c => [c, DB.sintomas.filter(s => s.categoria === c)]);
  const card = s => `
        <label class="sym"><input type="checkbox" id="s-${s.id}" value="${s.id}" ${st.sel.includes(s.id)?"checked":""}>
          <div><b>${esc(s.nome)}</b><small>${esc(s.descricao)}</small>${s.critico?`<span class="tag crit">Sintoma crítico</span>`:""}</div></label>`;
  view.innerHTML = `
  <div class="wrap" style="gap:16px">
    <div><h1>O que o motor está apresentando?</h1>
    <p class="lead">Escolha uma ou mais categorias e marque todos os sintomas que você percebeu. Quanto mais informações, mais preciso fica o resultado.</p></div>
    <div class="panel">
      <div class="cats" role="group" aria-label="Categorias (é possível marcar várias)">
        <button type="button" class="cat all" id="cat-all" aria-pressed="${todas}">Todas</button>
        ${CATS.map(c => { const n = st.sel.filter(id => S[id].categoria===c).length;
          return `<button type="button" class="cat" data-c="${esc(c)}" aria-pressed="${st.cats.includes(c)}">${esc(c)}${n?`<span class="n">${n}</span>`:""}</button>`; }).join("")}
      </div>
      <p class="hint">Toque em várias categorias para ver os sintomas delas juntos.</p>
      ${grupos.length ? grupos.map(([c, l]) => `
      <section class="grp">${grupos.length>1?`<h3 class="gh">${esc(c)}</h3>`:""}<div class="slist">${l.map(card).join("")}</div></section>`).join("")
      : `<p class="empty">Nenhuma categoria selecionada. Escolha uma ou mais categorias acima.</p>`}
    </div>
    <div class="panel" style="gap:10px">
      <span class="label">Sintomas marcados (${st.sel.length})</span>
      <div class="tray">${st.sel.length ? st.sel.map(id => `<span class="chip">${esc(S[id].nome)}<button type="button" data-rm="${id}" aria-label="Remover ${esc(S[id].nome)}">×</button></span>`).join("") : `<span class="empty">Nenhum sintoma marcado ainda. Navegue pelas categorias acima.</span>`}</div>
    </div>
    <p class="err" id="err" hidden>Marque pelo menos um sintoma para continuar.</p>
    <div class="nav"><button class="btn" id="back" type="button">Voltar</button><button class="btn primary" id="next" type="button">Continuar</button></div>
  </div>`;
  view.querySelectorAll(".cat[data-c]").forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    st.cats = st.cats.includes(c) ? st.cats.filter(x => x !== c) : [...st.cats, c];
    r2(); view.querySelector(`.cat[data-c="${CSS.escape(c)}"]`)?.focus(); });
  view.querySelector("#cat-all").onclick = () => { st.cats = todas ? [] : [...CATS]; r2(); view.querySelector("#cat-all").focus(); };
  view.querySelectorAll(".sym input").forEach(i => i.onchange = () => {
    st.sel = i.checked ? [...st.sel, i.value] : st.sel.filter(x => x !== i.value); r2();
    document.getElementById("s-"+i.value)?.focus();
  });
  view.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { st.sel = st.sel.filter(x => x !== b.dataset.rm); r2(); });
  view.querySelector("#back").onclick = () => go(1);
  view.querySelector("#next").onclick = () => {
    if (!st.sel.length) { view.querySelector("#err").hidden = false; return; }
    go(perguntasAtivas().length ? 3 : 4);
  };
}

function r3(){
  const qs = perguntasAtivas();
  view.innerHTML = `
  <div class="wrap" style="gap:16px">
    <div><h1>Algumas perguntas para afinar o resultado</h1>
    <p class="lead">Responda o que souber. Se não tiver certeza, deixe em "Não sei": a pergunta simplesmente não altera o resultado.</p></div>
    <div class="panel">
      ${qs.map(q => { const v = st.ans[q.id] || "ns"; return `
      <div class="q"><span class="from">${esc(S[q.sintomaId].nome)}</span><p id="t-${q.id}">${esc(q.texto)}</p>
        <div class="seg" role="radiogroup" aria-labelledby="t-${q.id}">
          ${[["sim","Sim"],["nao","Não"],["ns","Não sei"]].map(([k,l]) => `<label><input type="radio" name="${q.id}" id="${q.id}-${k}" value="${k}" ${v===k?"checked":""}>${l}</label>`).join("")}
        </div></div>`; }).join("")}
    </div>
    <div class="nav"><button class="btn" id="back" type="button">Voltar</button><button class="btn primary" id="next" type="button">Ver diagnóstico</button></div>
  </div>`;
  view.querySelectorAll(".seg input").forEach(i => i.onchange = () => st.ans[i.name] = i.value);
  view.querySelector("#back").onclick = () => go(2);
  view.querySelector("#next").onclick = () => { st.more = false; go(4); };
}

function r4(){
  const res = diagnosticar();
  const crit = st.sel.filter(id => S[id].critico);
  const mostra = st.more ? res : res.slice(0,5);
  const lim = new Set(DB.causas.filter(c => !compat(c)).map(c=>c.id));
  const desc = st.sel.reduce((n,id) => n + S[id].causas.filter(x => lim.has(x.causaId)).length, 0);
  view.innerHTML = `
  <div class="wrap" style="gap:16px">
    ${crit.length ? `<div class="alert" role="alert"><h2>Atenção: pare o veículo</h2>
      <p>Você marcou ${crit.length>1?"sintomas que podem":"um sintoma que pode"} causar dano grave ao motor ou risco à segurança:</p>
      <ul>${crit.map(id => `<li>${esc(S[id].nome)}</li>`).join("")}</ul>
      <p>Desligue o motor em local seguro e procure atendimento mecânico antes de voltar a rodar.</p></div>` : ""}
    <div><h1>Causas prováveis</h1>
    <div class="summary" style="margin-top:8px"><span>${COMB[st.comb]}${st.turbo?" turbo":""}</span>${st.sel.map(id=>`<span>${esc(S[id].nome)}</span>`).join("")}</div>
    ${desc ? `<p class="hint" style="margin-top:8px">${desc} ${desc>1?"causas foram descartadas":"causa foi descartada"} por não se aplicar a este tipo de motor.</p>`:""}</div>
    <div class="rank">
      ${mostra.map((r,i) => `
      <details class="cause" ${i===0?"open":""}>
        <summary>
          <span class="pos">${i+1}</span>
          <span class="cname">${esc(r.c.nome)}</span>
          <span class="pct">${r.pct}%</span>
          <span class="meta"><span class="tag u-${r.c.urgencia}">Urgência ${URG[r.c.urgencia].toLowerCase()}</span><span>${esc(r.c.sistema)}</span></span>
          <span class="bar"><i style="width:${r.pct}%"></i></span>
        </summary>
        <div class="body">
          <section><span class="label">Peças relacionadas</span><ul>${r.c.pecas.map(p=>`<li>${esc(P[p])} <span class="code">${p}</span></li>`).join("")}</ul></section>
          <section><span class="label">Como confirmar</span><ul>${r.c.testes.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></section>
          <section><span class="label">Soluções</span><ul>${r.c.solucoes.map(s=>`<li>${esc(s.descricao)} <span class="code">complexidade ${URG[s.complexidade].toLowerCase()}</span></li>`).join("")}</ul></section>
          <section><span class="label">Recomendação</span><p style="margin:0;font-size:.9rem">${URGTXT[r.c.urgencia]}.</p></section>
          ${r.c.observacao?`<div class="obs">${esc(r.c.observacao)}</div>`:""}
          <p class="why" style="margin:0">Indicada por: ${r.origem.map(esc).join(", ")} <span class="code">${r.c.id}</span></p>
        </div>
      </details>`).join("")}
    </div>
    ${res.length>5 && !st.more ? `<button class="link" id="more" type="button">Mostrar as outras ${res.length-5} causas menos prováveis</button>`:""}
    <div class="panel rep">
      <div><span class="label">Relatório do diagnóstico</span>
      <p class="hint" style="margin-top:4px">Salve o resultado completo para imprimir, arquivar ou entregar ao cliente. O PDF já sai pronto para impressão. O botão Imprimir abre o relatório em uma nova janela, pronto para imprimir ou salvar como PDF pelo navegador.</p></div>
      <div class="nav" style="justify-content:flex-start"><button class="btn primary" id="pdf" type="button">Salvar em PDF</button><button class="btn" id="html" type="button">Salvar em HTML</button><button class="btn" id="imprimir" type="button">Imprimir</button><button class="btn" id="savehist" type="button">${st.salvo ? "Atualizar no histórico" : "Salvar no histórico"}</button></div>
      <p class="hint" id="repmsg" role="status" aria-live="polite"></p>
      <p class="hint" id="histmsg" role="status" aria-live="polite">${st.salvo && st.num ? `Este diagnóstico está salvo no histórico como ${st.num}.` : ""}</p>
    </div>
    <p class="note">Este resultado é uma estimativa de probabilidade baseada nos sintomas informados. Ele orienta a investigação, mas não substitui a inspeção de um mecânico qualificado.</p>
    <div class="nav"><button class="btn" id="back" type="button">Ajustar respostas</button><button class="btn primary" id="new" type="button">Novo diagnóstico</button></div>
  </div>`;
  view.querySelector("#pdf").onclick = () => salvar("pdf");
  view.querySelector("#html").onclick = () => salvar("html");
  view.querySelector("#savehist").onclick = salvarHistorico;
  view.querySelector("#imprimir").onclick = imprimirRelatorio;
  view.querySelector("#more")?.addEventListener("click", () => { st.more = true; r4(); });
  view.querySelector("#back").onclick = () => go(perguntasAtivas().length ? 3 : 2);
  view.querySelector("#new").onclick = () => { Object.assign(st, {comb:"flex", turbo:false, sel:[], cats:[CATS[0]], ans:{}, more:false, veic:{modelo:"",placa:"",km:"",resp:""}, num:null, criadoEm:null, salvo:false}); go(1); };
}

function dadosRelatorio(){
  if (!st.num) { const n = novoNumero(); st.num = n.num; st.criadoEm = n.iso; }
  const num = st.num, agora = new Date(st.criadoEm);
  const data = agora.toLocaleString("pt-BR", {dateStyle:"long", timeStyle:"short"});
  const motor = COMB[st.comb] + (st.turbo ? " turbo" : "");
  const respostas = perguntasAtivas().map(q => ({p:q.texto, r:{sim:"Sim", nao:"Não"}[st.ans[q.id]] || "Não sei"}));
  return {num, data, motor, v:st.veic, sintomas:st.sel.map(id => S[id]), crit:st.sel.filter(id => S[id].critico).map(id => S[id].nome), respostas, res:diagnosticar()};
}
const AVISO = "Este relatório apresenta uma estimativa de probabilidade baseada nos sintomas informados. Ele orienta a investigação, mas não substitui a inspeção de um mecânico qualificado.";

function relatorioHTML(d){
  const e = esc;
  const linhaV = [["Modelo e ano",d.v.modelo],["Placa",d.v.placa],["Quilometragem",d.v.km],["Responsável",d.v.resp],["Motor",d.motor]].filter(x=>x[1]).map(([k,v])=>`<div><dt>${k}</dt><dd>${e(v)}</dd></div>`).join("");
  const causas = d.res.map((r,i)=>`
  <section class="causa${i>=5?" menor":""}">
    <h3><span>${i+1}. ${e(r.c.nome)}</span><b>${r.pct}%</b></h3>
    <p class="m">Urgência ${URG[r.c.urgencia].toLowerCase()} · ${e(r.c.sistema)} · ${URGTXT[r.c.urgencia]}</p>
    ${i<5?`<div class="g">
      <div><h4>Peças relacionadas</h4><ul>${r.c.pecas.map(p=>`<li>${e(P[p])}</li>`).join("")}</ul></div>
      <div><h4>Como confirmar</h4><ul>${r.c.testes.map(t=>`<li>${e(t)}</li>`).join("")}</ul></div>
      <div><h4>Soluções</h4><ul>${r.c.solucoes.map(s=>`<li>${e(s.descricao)} (complexidade ${URG[s.complexidade].toLowerCase()})</li>`).join("")}</ul></div>
    </div>${r.c.observacao?`<p class="obs">${e(r.c.observacao)}</p>`:""}`:""}
    <p class="m">Indicada por: ${r.origem.map(e).join(", ")}</p>
  </section>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório ${d.num}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#1B2226;max-width:820px;margin:0 auto;padding:28px 20px;line-height:1.45;font-size:14px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1B2226;padding-bottom:10px;gap:12px;flex-wrap:wrap}
header h1{margin:0;font-size:28px;letter-spacing:.06em}header p{margin:0;color:#56626A;font-size:12px}
.id{text-align:right;font-size:12px;color:#56626A}.id b{display:block;color:#1B2226;font-size:13px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#0F5E78;border-bottom:1px solid #CDD3D0;padding-bottom:4px;margin:24px 0 10px}
dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 16px;margin:0}dt{font-size:11px;color:#56626A;text-transform:uppercase;letter-spacing:.06em}dd{margin:0;font-weight:bold}
ul{margin:4px 0;padding-left:18px}li{margin:2px 0}
.alerta{border:2px solid #B3261E;background:#FADEDB;padding:10px 14px;border-radius:6px;margin-top:18px}.alerta strong{color:#B3261E;font-size:15px}
table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #E3E7E5;padding:5px 4px;vertical-align:top}td:last-child{text-align:right;font-weight:bold;white-space:nowrap}
.causa{border:1px solid #CDD3D0;border-radius:6px;padding:10px 14px;margin-bottom:10px;break-inside:avoid}
.causa h3{display:flex;justify-content:space-between;gap:12px;margin:0;font-size:15px}.causa h3 b{color:#0F5E78;font-size:18px}
.m{margin:3px 0;color:#56626A;font-size:12px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:8px}
h4{margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#56626A}.obs{background:#FBEFD6;padding:6px 10px;border-radius:4px;margin:8px 0 0}
.menor{padding:6px 14px}.aviso{margin-top:24px;font-size:12px;color:#56626A;border-top:1px solid #CDD3D0;padding-top:10px}
.ass{margin-top:48px;display:flex;gap:40px;flex-wrap:wrap}.ass div{flex:1;min-width:200px;border-top:1px solid #1B2226;padding-top:4px;font-size:12px;color:#56626A}
.bt{margin:0 0 16px;text-align:right}.bt button{font:inherit;font-weight:bold;padding:9px 18px;border-radius:6px;border:0;background:#0F5E78;color:#fff;cursor:pointer}
@media print{.bt{display:none}body{padding:0;max-width:none}@page{size:A4;margin:16mm}}
</style></head><body>
<div class="bt"><button onclick="window.print()">Imprimir</button></div>
<header><div><h1>SIDAM</h1><p>Sistema Inteligente de Diagnóstico Automotivo de Motores</p></div>
<div class="id"><b>Relatório de diagnóstico</b>${d.num}<br>${e(d.data)}</div></header>
${d.crit.length?`<div class="alerta"><strong>Atenção: pare o veículo.</strong> Sintoma${d.crit.length>1?"s":""} crítico${d.crit.length>1?"s":""} informado${d.crit.length>1?"s":""}: ${d.crit.map(e).join(", ")}. Desligue o motor em local seguro e procure atendimento mecânico antes de voltar a rodar.</div>`:""}
<h2>Veículo</h2><dl>${linhaV}</dl>
<h2>Sintomas informados</h2><ul>${d.sintomas.map(s=>`<li>${e(s.nome)} <span class="m">(${e(s.categoria)})</span></li>`).join("")}</ul>
${d.respostas.length?`<h2>Respostas complementares</h2><table>${d.respostas.map(x=>`<tr><td>${e(x.p)}</td><td>${x.r}</td></tr>`).join("")}</table>`:""}
<h2>Causas prováveis</h2>${causas}
<p class="aviso">${AVISO}</p>
<div class="ass"><div>Responsável pelo diagnóstico</div><div>Cliente</div></div>
</body></html>`;
}

function relatorioPDF(d){
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit:"mm", format:"a4"});
  const W = 210, M = 16, CW = W - 2*M, BOT = 282;
  let y = M;
  const INK=[27,34,38], MUT=[86,98,106], ACC=[15,94,120], CRIT=[179,38,30];
  const cor = c => doc.setTextColor(...c);
  const need = h => { if (y + h > BOT) { doc.addPage(); y = M; } };
  const txt = (s, {size=10, bold=false, c=INK, x=M, w=CW, gap=1.2}={}) => {
    doc.setFont("helvetica", bold?"bold":"normal"); doc.setFontSize(size); cor(c);
    const lines = doc.splitTextToSize(String(s), w); const lh = size*0.42;
    lines.forEach(l => { need(lh); doc.text(l, x, y + lh*0.8); y += lh; }); y += gap;
  };
  const sec = s => { need(14); y += 4; txt(s.toUpperCase(), {size:10, bold:true, c:ACC, gap:0.5}); doc.setDrawColor(205,211,208); doc.line(M, y, W-M, y); y += 3; };
  const bullets = (arr, x=M, w=CW) => arr.forEach(s => { const yy = y; txt("•", {x, w:4, gap:0}); y = yy; txt(s, {x:x+4, w:w-4, gap:0.6}); });

  doc.setFont("helvetica","bold"); doc.setFontSize(22); cor(INK); doc.text("SIDAM", M, y+8);
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5); cor(MUT); doc.text("Sistema Inteligente de Diagnóstico Automotivo de Motores", M, y+13);
  doc.setFont("helvetica","bold"); doc.setFontSize(10); cor(INK); doc.text("Relatório de diagnóstico", W-M, y+5, {align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5); cor(MUT); doc.text(d.num, W-M, y+9.5, {align:"right"}); doc.text(d.data, W-M, y+13.5, {align:"right"});
  y += 17; doc.setDrawColor(...INK); doc.setLineWidth(0.8); doc.line(M, y, W-M, y); doc.setLineWidth(0.2); y += 5;

  if (d.crit.length) {
    const t = `Atenção: pare o veículo. Sintoma(s) crítico(s): ${d.crit.join(", ")}. Desligue o motor em local seguro e procure atendimento mecânico antes de voltar a rodar.`;
    doc.setFontSize(10); const n = doc.splitTextToSize(t, CW-8).length; const h = n*4.2 + 6;
    need(h); doc.setFillColor(250,222,219); doc.setDrawColor(...CRIT); doc.setLineWidth(0.6); doc.roundedRect(M, y, CW, h, 1.5, 1.5, "FD"); doc.setLineWidth(0.2);
    y += 3; txt(t, {x:M+4, w:CW-8, bold:true, c:CRIT, gap:0}); y += 5;
  }

  sec("Veículo");
  const campos = [["Modelo e ano",d.v.modelo],["Placa",d.v.placa],["Quilometragem",d.v.km],["Responsável",d.v.resp],["Motor",d.motor]].filter(x=>x[1]);
  const colW = CW/3; campos.forEach((c,i) => {
    const col = i%3; if (col===0 && i) y += 10; need(10);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); cor(MUT); doc.text(c[0].toUpperCase(), M+col*colW, y+3);
    doc.setFont("helvetica","bold"); doc.setFontSize(10); cor(INK); doc.text(doc.splitTextToSize(c[1], colW-4)[0], M+col*colW, y+7.5);
  }); y += 11;

  sec("Sintomas informados");
  bullets(d.sintomas.map(s => `${s.nome} (${s.categoria})`));

  if (d.respostas.length) {
    sec("Respostas complementares");
    d.respostas.forEach(x => { const yy = y; txt(x.p, {w:CW-22, gap:0}); const y2 = y; y = yy; txt(x.r, {x:W-M-18, w:18, bold:true, gap:0}); y = Math.max(y, y2) + 1.2; });
  }

  sec("Causas prováveis");
  d.res.forEach((r,i) => {
    need(i<5 ? 30 : 10);
    const yy = y; txt(`${i+1}. ${r.c.nome}`, {size:11, bold:true, w:CW-22, gap:0}); const y2 = y;
    doc.setFont("helvetica","bold"); doc.setFontSize(13); cor(ACC); doc.text(r.pct+"%", W-M, yy+4.6, {align:"right"}); y = Math.max(y2, yy+5.5);
    const bw = CW*r.pct/100; doc.setFillColor(227,231,229); doc.rect(M, y, CW, 1.2, "F"); doc.setFillColor(...ACC); doc.rect(M, y, Math.max(bw,0.5), 1.2, "F"); y += 3;
    txt(`Urgência ${URG[r.c.urgencia].toLowerCase()} · ${r.c.sistema} · ${URGTXT[r.c.urgencia]}`, {size:8.5, c:MUT, gap:1});
    if (i<5) {
      [["Peças relacionadas", r.c.pecas.map(p=>P[p])], ["Como confirmar", r.c.testes], ["Soluções", r.c.solucoes.map(s=>`${s.descricao} (complexidade ${URG[s.complexidade].toLowerCase()})`)]].forEach(([h,l]) => {
        need(8); txt(h.toUpperCase(), {size:7.5, bold:true, c:MUT, gap:0.4}); bullets(l); y += 0.6;
      });
      if (r.c.observacao) txt("Observação: " + r.c.observacao, {size:9, bold:true, c:[168,106,6]});
    }
    txt("Indicada por: " + r.origem.join(", "), {size:8, c:MUT, gap:2});
    doc.setDrawColor(227,231,229); doc.line(M, y, W-M, y); y += 3;
  });

  need(40); y += 2; txt(AVISO, {size:8.5, c:MUT, gap:2});
  y += 18; doc.setDrawColor(...INK); doc.line(M, y, M+75, y); doc.line(W-M-75, y, W-M, y);
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5); cor(MUT); doc.text("Responsável pelo diagnóstico", M, y+4); doc.text("Cliente", W-M-75, y+4);

  const n = doc.getNumberOfPages();
  for (let i=1;i<=n;i++){ doc.setPage(i); doc.setFontSize(7.5); cor(MUT); doc.setFont("helvetica","normal");
    doc.text(`${d.num} · página ${i} de ${n}`, W-M, 292, {align:"right"}); doc.text("SIDAM – versão 1.0", M, 292); }
  return doc.output("arraybuffer");
}

async function salvar(fmt){
  const msg = document.getElementById("repmsg");
  const btns = [document.getElementById("pdf"), document.getElementById("html")];
  const set = t => { if (msg) msg.textContent = t; };
  let dl = null;
  try { dl = await window.claude?.use?.("downloads"); } catch(e) { dl = null; }
  if (!dl) { set("Não foi possível preparar o download neste navegador."); return; }
  const d = dadosRelatorio();
  let data;
  try {
    if (fmt === "pdf") { if (!window.jspdf) { set("O gerador de PDF não carregou. Verifique a conexão e recarregue a página, ou use a opção HTML."); return; } data = relatorioPDF(d); }
    else data = relatorioHTML(d);
  } catch(e) { set("Não foi possível montar o relatório. Tente a outra opção de formato."); return; }
  btns.forEach(b => b && (b.disabled = true)); set("Preparando o arquivo…");
  try {
    await dl.save({filename: `${d.num}.${fmt}`, data});
    set(`Relatório ${d.num}.${fmt} baixado. Verifique a pasta de downloads.`);
  } catch(e) {
    const c = e && e.code;
    set(c === "declined" ? "Salvamento cancelado." : c === "rate_limited" ? "Já existe uma confirmação aberta. Conclua ou aguarde alguns segundos e tente de novo." : "Não foi possível salvar o arquivo nesta visualização.");
  } finally { btns.forEach(b => b && (b.disabled = false)); }
}

const store = {kind:"wait", items:[], err:""};
const LS = "sidam-historico-v1";
const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch(e) { return null; } };
const lsWrite = a => { try { localStorage.setItem(LS, JSON.stringify(a)); return true; } catch(e) { return false; } };
const ordena = a => a.sort((x,y) => String(y.criadoEm).localeCompare(String(x.criadoEm)));
let COL = null;

async function iniciarHistorico(){
  try {
    const db = await window.claude?.use?.("db");
    const user = await window.claude?.use?.("user");
    const uid = user ? await user.id() : null;
    iniciarBase(db, user);
    if (db && uid) {
      COL = db.collection("data/users/" + uid + "/diagnosticos");
      store.kind = "db";
      COL.onSnapshot(s => { store.items = ordena(s.docs.map(d => ({id:d.id, ...d.data()}))); store.err = ""; atualizaContagem(); if (st.view==="hist") rHist(true); },
        e => { store.err = "Não foi possível carregar o histórico agora. Tente recarregar a página."; if (st.view==="hist") rHist(true); });
      return;
    }
  } catch(e) {}
  const a = lsRead();
  if (a) { store.kind = "local"; store.items = ordena(a); } else store.kind = "none";
  atualizaContagem(); if (st.view==="hist") rHist(true);
}

function registro(){
  const res = diagnosticar();
  const top = res[0];
  return {
    num: st.num, criadoEm: st.criadoEm, atualizadoEm: new Date().toISOString(), versaoBase: DB.versao,
    comb: st.comb, turbo: st.turbo, sel: [...st.sel], ans: {...st.ans}, veic: {...st.veic},
    resumo: {causa: top ? top.c.nome : "", pct: top ? top.pct : 0, critico: st.sel.some(id => S[id].critico),
      sintomas: st.sel.map(id => S[id].nome)}
  };
}

async function salvarHistorico(){
  const msg = document.getElementById("histmsg"), b = document.getElementById("savehist");
  const set = t => msg && (msg.textContent = t);
  if (!st.num) { const n = novoNumero(); st.num = n.num; st.criadoEm = n.iso; }
  const rec = registro();
  if (b) b.disabled = true;
  try {
    if (store.kind === "db") await COL.doc(st.num).set(rec);
    else if (store.kind === "local") {
      const a = (lsRead() || []).filter(x => x.id !== st.num); a.push({id:st.num, ...rec});
      if (!lsWrite(a)) throw new Error("ls"); store.items = ordena(a); atualizaContagem();
    } else { set("O histórico não está disponível nesta visualização."); return; }
    st.salvo = true; set(`Diagnóstico ${st.num} salvo no histórico.`);
    if (b) b.textContent = "Atualizar no histórico";
  } catch(e) { set("Não foi possível salvar no histórico. Tente novamente em instantes."); }
  finally { if (b) b.disabled = false; }
}

async function excluirHistorico(id){
  try {
    if (store.kind === "db") await COL.doc(id).delete();
    else { const a = (lsRead() || []).filter(x => x.id !== id); lsWrite(a); store.items = ordena(a); atualizaContagem(); rHist(true); }
    if (st.num === id) { st.salvo = false; }
  } catch(e) { const m = document.getElementById("hmsg"); if (m) m.textContent = "Não foi possível excluir. Tente novamente."; }
}

function abrirHistorico(id){
  const r = store.items.find(x => x.id === id); if (!r) return;
  Object.assign(st, {view:"diag", comb:r.comb, turbo:!!r.turbo, sel:(r.sel||[]).filter(s => S[s]), ans:{...(r.ans||{})},
    veic:{modelo:"",placa:"",km:"",resp:"", ...(r.veic||{})}, num:r.num, criadoEm:r.criadoEm, salvo:true, more:false});
  st.cats = [...new Set(st.sel.map(x => S[x].categoria))]; if (!st.cats.length) st.cats = [CATS[0]];
  go(4);
}

function atualizaContagem(){
  const c = document.getElementById("hcount");
  if (c) c.textContent = store.items.length ? String(store.items.length) : "";
}

let filtro = "", confirmar = null;
function rHist(keep){
  setSteps();
  const q = filtro.trim().toLowerCase();
  const lista = store.items.filter(r => !q || [r.num, r.veic?.placa, r.veic?.modelo, r.veic?.resp, r.resumo?.causa].join(" ").toLowerCase().includes(q));
  const fmt = iso => { try { return new Date(iso).toLocaleString("pt-BR", {dateStyle:"short", timeStyle:"short"}); } catch(e) { return ""; } };
  const nota = store.kind === "local" ? "Os diagnósticos ficam salvos apenas neste navegador, neste aparelho. Entre com sua conta Google para guardá-los com segurança e acessá-los de qualquer lugar."
    : store.kind === "db" ? "Os diagnósticos ficam salvos na sua conta e só você tem acesso a eles."
    : store.kind === "none" ? "O histórico não está disponível nesta visualização." : "Carregando histórico…";
  view.innerHTML = `
  <div class="wrap" style="gap:16px">
    <div><h1>Histórico de diagnósticos</h1>
    <p class="lead">${store.items.length} diagnóstico${store.items.length===1?"":"s"} salvo${store.items.length===1?"":"s"}. ${nota}</p></div>
    ${store.err ? `<p class="err">${esc(store.err)}</p>` : ""}
    ${store.items.length ? `<label class="fld" for="hbusca"><span>Buscar por placa, modelo, responsável, número ou causa</span>
      <input id="hbusca" type="search" value="${esc(filtro)}" placeholder="Ex.: ABC1D23" autocomplete="off"></label>` : ""}
    <p class="hint" id="hmsg" role="status" aria-live="polite"></p>
    <div class="hlist">
      ${!store.items.length ? `<div class="panel empty-state"><h2>Nenhum diagnóstico salvo ainda</h2>
        <p class="hint">Ao concluir um diagnóstico, use o botão "Salvar no histórico" na tela de resultado. Ele aparecerá aqui para consulta e reimpressão.</p>
        <div><button class="btn primary" id="hnovo" type="button">Fazer um diagnóstico</button></div></div>`
      : !lista.length ? `<p class="empty">Nenhum diagnóstico encontrado para "${esc(filtro)}".</p>`
      : lista.map(r => { const v = r.veic || {}, s = r.resumo || {};
        const ident = [v.modelo, v.placa, v.km && v.km + " km", COMB[r.comb] + (r.turbo ? " turbo" : "")].filter(Boolean).map(esc).join(" · ");
        const sint = s.sintomas || [];
        return `
      <article class="hitem">
        <div class="hhead"><span class="code">${esc(r.num)}</span><span class="code">${fmt(r.criadoEm)}</span></div>
        <h3>${ident}</h3>
        <p class="hint">${sint.slice(0,3).map(esc).join(", ")}${sint.length>3?` e mais ${sint.length-3}`:""}</p>
        <div class="hres"><span>Causa mais provável: <b>${esc(s.causa||"—")}</b> <span class="code">${s.pct??""}%</span></span>${s.critico?`<span class="tag crit">Sintoma crítico</span>`:""}</div>
        ${v.resp?`<p class="hint">Responsável: ${esc(v.resp)}</p>`:""}
        <div class="nav" style="justify-content:flex-start">
          ${confirmar === r.id
            ? `<span class="hint" style="align-self:center">Excluir ${esc(r.num)} definitivamente?</span><button class="btn danger" data-del="${esc(r.id)}" type="button">Excluir</button><button class="btn" data-cancel type="button">Cancelar</button>`
            : `<button class="btn primary" data-open="${esc(r.id)}" type="button">Abrir</button><button class="btn" data-ask="${esc(r.id)}" type="button">Excluir</button>`}
        </div>
      </article>`; }).join("")}
    </div>
  </div>`;
  const busca = view.querySelector("#hbusca");
  if (busca) { busca.oninput = () => { filtro = busca.value; rHist(true); const b = view.querySelector("#hbusca"); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }; }
  view.querySelector("#hnovo")?.addEventListener("click", () => mostrar("diag"));
  view.querySelectorAll("[data-open]").forEach(b => b.onclick = () => abrirHistorico(b.dataset.open));
  view.querySelectorAll("[data-ask]").forEach(b => b.onclick = () => { confirmar = b.dataset.ask; rHist(true); view.querySelector("[data-del]")?.focus(); });
  view.querySelector("[data-cancel]")?.addEventListener("click", () => { confirmar = null; rHist(true); });
  view.querySelector("[data-del]")?.addEventListener("click", e => { const id = e.currentTarget.dataset.del; confirmar = null; excluirHistorico(id); });
}

function mostrar(v){
  st.view = v; confirmar = null;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  document.getElementById("steps").hidden = v !== "diag";
  if (v === "hist") { rHist(); window.scrollTo({top:0}); } else if (v === "admin") { adm.msg = ""; rAdmin(); window.scrollTo({top:0}); } else render();
}

/* ---------- Base editável (banco do sistema) ---------- */
const ORIG = JSON.parse(JSON.stringify(DB));
const COLS = ["sintomas", "causas", "pecas", "perguntas"];
let BASE = null, PODE_EDITAR = false, baseOrigem = "embutida", baseAtualizada = null;

function indexar(){
  C = Object.fromEntries(DB.causas.map(c => [c.id, c]));
  P = Object.fromEntries(DB.pecas.map(p => [p.id, p.nome]));
  S = Object.fromEntries(DB.sintomas.map(s => [s.id, s]));
  Q = Object.fromEntries(DB.perguntas.map(q => [q.id, q]));
  CATS = [...new Set(DB.sintomas.map(s => s.categoria))];
  st.sel = st.sel.filter(id => S[id]);
  st.cats = st.cats.filter(c => CATS.includes(c));
}

async function iniciarBase(db, user){
  if (!db) return;
  try { PODE_EDITAR = user ? await user.canEdit() : false; } catch(e) { PODE_EDITAR = false; }
  BASE = db;
  const tab = document.getElementById("tab-admin"); if (tab) tab.hidden = !PODE_EDITAR;
  const recebido = {};
  COLS.forEach(n => db.doc("base/" + n).onSnapshot(snap => {
    recebido[n] = snap.exists ? snap.data() : null;
    if (Object.keys(recebido).length < COLS.length) return;
    if (COLS.every(k => recebido[k] && Array.isArray(recebido[k].itens))) {
      DB = {versao: recebido.sintomas.versao || DB.versao};
      COLS.forEach(k => DB[k] = recebido[k].itens);
      baseOrigem = "banco";
      baseAtualizada = COLS.map(k => recebido[k].atualizadoEm).filter(Boolean).sort().pop() || null;
    } else baseOrigem = "embutida";
    indexar();
    if (st.view === "admin") { if (!adm.edit) rAdmin(true); }
    else if (st.view === "diag" && st.step === 2) render();
  }, () => {}));
}

async function gravar(nomes){
  if (!BASE || !PODE_EDITAR) throw new Error("sem permissão");
  const quando = new Date().toISOString();
  if (baseOrigem !== "banco") nomes = COLS;
  for (const n of nomes) await BASE.doc("base/" + n).set({itens: DB[n], versao: DB.versao, atualizadoEm: quando});
  baseOrigem = "banco"; baseAtualizada = quando;
}

/* ---------- Área administrativa ---------- */
const adm = {tab:"sintomas", q:"", edit:null, form:null, err:"", msg:"", confirm:null, busy:false, restaurar:false};
const PREF = {sintomas:"SIN", causas:"CAU", pecas:"PEC", perguntas:"PER"};
const NOMES = {sintomas:"Sintomas", causas:"Causas", pecas:"Peças", perguntas:"Perguntas"};
const UNID = {sintomas:"sintoma", causas:"causa", pecas:"peça", perguntas:"pergunta"};
const NOVO = {sintomas:"Novo sintoma", causas:"Nova causa", pecas:"Nova peça", perguntas:"Nova pergunta"};
const proxId = col => { const n = Math.max(0, ...DB[col].map(x => parseInt(String(x.id).split("-")[1], 10) || 0)); return `${PREF[col]}-${String(n+1).padStart(3,"0")}`; };
const ordNome = a => [...a].sort((x,y) => (x.nome||x.texto).localeCompare(y.nome||y.texto, "pt-BR"));
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? NaN : n; };
const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel?"selected":""}>${esc(l)}</option>`;

function usoCausa(id){ return {s: DB.sintomas.filter(s => s.causas.some(c => c.causaId === id)), q: DB.perguntas.filter(q => [...(q.efeitos.sim||[]), ...(q.efeitos.nao||[])].some(e => e.causaId === id))}; }
function usoPeca(id){ return DB.causas.filter(c => c.pecas.includes(id)); }

function novoForm(col){
  if (col === "sintomas") return {id:null, nome:"", categoria:"", descricao:"", critico:false, causas:[{causaId:"", peso:""}]};
  if (col === "causas") return {id:null, nome:"", sistema:"", combustiveis:["flex","gasolina","diesel"], somenteTurbo:false, urgencia:"media", pecas:[], testes:"", solucoes:[{descricao:"", complexidade:"baixa"}], observacao:""};
  if (col === "pecas") return {id:null, nome:""};
  return {id:null, sintomaId:"", texto:"", efeitos:[{resp:"sim", causaId:"", multiplicador:""}]};
}
function formDe(col, it){
  const f = JSON.parse(JSON.stringify(it));
  if (col === "causas") f.testes = it.testes.join("\n");
  if (col === "perguntas") f.efeitos = [...(it.efeitos.sim||[]).map(e => ({resp:"sim", ...e})), ...(it.efeitos.nao||[]).map(e => ({resp:"nao", ...e}))];
  return f;
}

function coletar(){
  const f = adm.form; if (!f) return;
  view.querySelectorAll("[data-f]").forEach(el => { f[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; });
  const comb = view.querySelectorAll("[data-comb]"); if (comb.length) f.combustiveis = [...comb].filter(c => c.checked).map(c => c.value);
  view.querySelectorAll("[data-row]").forEach(el => { const [lista, i, campo] = el.dataset.row.split(":"); if (f[lista] && f[lista][i]) f[lista][i][campo] = el.value; });
}

function validar(col, f){
  const e = [];
  if (col === "sintomas") {
    if (!f.nome.trim()) e.push("Informe o nome do sintoma.");
    if (!f.categoria.trim()) e.push("Informe a categoria.");
    const linhas = f.causas.filter(c => c.causaId || c.peso !== "");
    if (!linhas.length) e.push("Ligue pelo menos uma causa ao sintoma.");
    if (linhas.some(c => !c.causaId)) e.push("Escolha a causa em todas as linhas de causas.");
    if (linhas.some(c => !(num(c.peso) > 0))) e.push("Todos os pesos precisam ser números maiores que zero.");
    if (new Set(linhas.map(c => c.causaId)).size !== linhas.length) e.push("A mesma causa aparece mais de uma vez.");
    const soma = linhas.reduce((s,c) => s + (num(c.peso)||0), 0);
    if (linhas.length && Math.abs(soma - 1) > 0.01) e.push(`A soma dos pesos está em ${soma.toFixed(2).replace(".", ",")} e precisa fechar em 1,00. Use o botão "Ajustar para 1,00".`);
  }
  if (col === "causas") {
    if (!f.nome.trim()) e.push("Informe o nome da causa.");
    if (!f.sistema.trim()) e.push("Informe o sistema do veículo.");
    if (!f.combustiveis.length) e.push("Marque pelo menos um tipo de combustível.");
    if (!f.testes.split("\n").some(t => t.trim())) e.push("Descreva pelo menos um teste de confirmação.");
    if (!f.solucoes.some(s => s.descricao.trim())) e.push("Descreva pelo menos uma solução.");
  }
  if (col === "pecas") {
    if (!f.nome.trim()) e.push("Informe o nome da peça.");
    else if (DB.pecas.some(p => p.id !== f.id && p.nome.trim().toLowerCase() === f.nome.trim().toLowerCase())) e.push("Já existe uma peça com esse nome.");
  }
  if (col === "perguntas") {
    if (!f.sintomaId) e.push("Escolha o sintoma ao qual a pergunta pertence.");
    if (!f.texto.trim()) e.push("Escreva o texto da pergunta.");
    const linhas = f.efeitos.filter(x => x.causaId || x.multiplicador !== "");
    if (!linhas.length) e.push("Informe pelo menos um efeito da resposta.");
    if (linhas.some(x => !x.causaId)) e.push("Escolha a causa em todas as linhas de efeito.");
    if (linhas.some(x => !(num(x.multiplicador) > 0))) e.push("Os multiplicadores precisam ser números maiores que zero (abaixo de 1 reduz, acima de 1 aumenta).");
  }
  return e;
}

function montar(col, f){
  const id = f.id || proxId(col);
  if (col === "sintomas") return {id, nome:f.nome.trim(), categoria:f.categoria.trim(), descricao:f.descricao.trim(), critico:!!f.critico,
    causas:f.causas.filter(c => c.causaId).map(c => ({causaId:c.causaId, peso:Math.round(num(c.peso)*1000)/1000})),
    perguntas: f.id ? (S[f.id]?.perguntas || []) : []};
  if (col === "causas") return {id, nome:f.nome.trim(), sistema:f.sistema.trim(), combustiveis:f.combustiveis, somenteTurbo:!!f.somenteTurbo,
    urgencia:f.urgencia, pecas:f.pecas, testes:f.testes.split("\n").map(t => t.trim()).filter(Boolean),
    solucoes:f.solucoes.filter(s => s.descricao.trim()).map(s => ({descricao:s.descricao.trim(), complexidade:s.complexidade})), observacao:f.observacao.trim()};
  if (col === "pecas") return {id, nome:f.nome.trim()};
  const ef = {sim:[], nao:[]};
  f.efeitos.filter(x => x.causaId).forEach(x => ef[x.resp].push({causaId:x.causaId, multiplicador:Math.round(num(x.multiplicador)*100)/100}));
  if (!ef.nao.length) delete ef.nao;
  if (!ef.sim.length) delete ef.sim;
  return {id, sintomaId:f.sintomaId, texto:f.texto.trim(), efeitos:ef};
}

async function salvarItem(){
  coletar();
  const col = adm.tab, f = adm.form, erros = validar(col, f);
  if (erros.length) { adm.err = erros.join(" "); rAdmin(); view.querySelector("#aerr")?.focus(); return; }
  const it = montar(col, f), antes = JSON.stringify(DB), muda = [col];
  const i = DB[col].findIndex(x => x.id === it.id);
  if (i >= 0) DB[col][i] = it; else DB[col].push(it);
  if (col === "perguntas") {
    DB.sintomas.forEach(s => { s.perguntas = s.perguntas.filter(q => q !== it.id); });
    DB.sintomas.find(s => s.id === it.sintomaId).perguntas.push(it.id);
    muda.push("sintomas");
  }
  if (col === "sintomas") {
    const ok = new Set(it.causas.map(c => c.causaId));
    DB.perguntas.filter(q => q.sintomaId === it.id).forEach(q => ["sim","nao"].forEach(r => { if (q.efeitos[r]) q.efeitos[r] = q.efeitos[r].filter(e => ok.has(e.causaId)); }));
    muda.push("perguntas");
  }
  adm.busy = true; rAdmin();
  try { await gravar([...new Set(muda)]); indexar(); adm.msg = `${UNID[col][0].toUpperCase()+UNID[col].slice(1)} ${it.id} ${col==="sintomas"?"salvo":"salva"}.`; adm.edit = null; adm.form = null; adm.err = ""; }
  catch(e) { DB = JSON.parse(antes); indexar(); adm.err = "Não foi possível gravar a alteração. Verifique a conexão e tente de novo."; }
  adm.busy = false; rAdmin(); window.scrollTo({top:0});
}

async function excluirItem(id){
  const col = adm.tab, antes = JSON.stringify(DB), muda = [col];
  DB[col] = DB[col].filter(x => x.id !== id);
  if (col === "sintomas") { DB.perguntas = DB.perguntas.filter(q => q.sintomaId !== id); muda.push("perguntas"); }
  if (col === "perguntas") { DB.sintomas.forEach(s => s.perguntas = s.perguntas.filter(q => q !== id)); muda.push("sintomas"); }
  adm.busy = true; adm.confirm = null; rAdmin();
  try { await gravar(muda); indexar(); adm.msg = `${id} excluído.`; adm.edit = null; adm.form = null; }
  catch(e) { DB = JSON.parse(antes); indexar(); adm.err = "Não foi possível excluir. Tente de novo."; }
  adm.busy = false; rAdmin();
}

async function restaurarOriginal(){
  const antes = JSON.stringify(DB);
  DB = JSON.parse(JSON.stringify(ORIG)); adm.busy = true; adm.restaurar = false; rAdmin();
  try { await gravar(COLS); indexar(); adm.msg = "Base original (v1.0) restaurada."; }
  catch(e) { DB = JSON.parse(antes); indexar(); adm.err = "Não foi possível restaurar a base. Tente de novo."; }
  adm.busy = false; rAdmin();
}

async function exportarBase(){
  let dl = null; try { dl = await window.claude?.use?.("downloads"); } catch(e) {}
  if (!dl) { adm.msg = "A exportação de arquivos não está disponível nesta visualização."; rAdmin(true); return; }
  const a = new Date(), p = n => String(n).padStart(2,"0");
  try { await dl.save({filename:`sidam-base-${a.getFullYear()}${p(a.getMonth()+1)}${p(a.getDate())}.json`, data: JSON.stringify(DB, null, 2)}); adm.msg = "Base exportada em JSON."; }
  catch(e) { adm.msg = e?.code === "declined" ? "Exportação cancelada." : "Não foi possível exportar o arquivo."; }
  rAdmin(true);
}

function linhaLista(col, it){
  if (col === "sintomas") { const soma = it.causas.reduce((s,c)=>s+c.peso,0);
    return [it.nome, `${it.categoria} · ${it.causas.length} causa${it.causas.length>1?"s":""} · ${it.perguntas.length} pergunta${it.perguntas.length===1?"":"s"}`, it.critico ? `<span class="tag crit">Crítico</span>` : "", Math.abs(soma-1)>0.01 ? `<span class="tag u-media">Pesos somam ${soma.toFixed(2).replace(".",",")}</span>` : ""]; }
  if (col === "causas") { const u = usoCausa(it.id);
    return [it.nome, `${it.sistema} · ${it.combustiveis.map(c => COMB[c]).join(", ")}${it.somenteTurbo?" · só turbo":""} · ${u.s.length} sintoma${u.s.length===1?"":"s"}`, `<span class="tag u-${it.urgencia}">${URG[it.urgencia]}</span>`, u.s.length ? "" : `<span class="tag u-media">Sem sintoma ligado</span>`]; }
  if (col === "pecas") { const u = usoPeca(it.id);
    return [it.nome, u.length ? `Usada em ${u.length} causa${u.length>1?"s":""}` : "Não usada em nenhuma causa", "", ""]; }
  return [it.texto, S[it.sintomaId] ? S[it.sintomaId].nome : "Sintoma removido", "", ""];
}

function rAdmin(keep){
  setSteps();
  if (!PODE_EDITAR) { view.innerHTML = `<div class="panel"><h2>Área restrita</h2><p class="hint">Somente quem pode editar este sistema acessa a administração.</p></div>`; return; }
  const col = adm.tab;
  const quando = baseAtualizada ? new Date(baseAtualizada).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : null;
  const status = baseOrigem === "banco" ? `Base em uso: editada${quando?` em ${quando}`:""}.` : "Base em uso: original (v1.0). A primeira alteração salva cria a cópia editável.";
  const topo = `
    <div><h1>Administração da base</h1>
    <p class="lead">${DB.sintomas.length} sintomas, ${DB.causas.length} causas, ${DB.pecas.length} peças e ${DB.perguntas.length} perguntas. ${status} As alterações valem para todos os diagnósticos feitos a partir de agora.</p></div>
    <div class="nav" style="justify-content:flex-start">
      <nav class="cats" aria-label="Cadastros">${COLS.map(c => `<button type="button" class="cat" data-at="${c}" aria-pressed="${c===col}">${NOMES[c]}<span class="n">${DB[c].length}</span></button>`).join("")}</nav>
    </div>
    ${adm.msg ? `<p class="okmsg" role="status">${esc(adm.msg)}</p>` : ""}
    ${adm.err && !adm.edit ? `<p class="err" role="alert">${esc(adm.err)}</p>` : ""}`;
  if (adm.edit) { view.innerHTML = `<div class="wrap" style="gap:16px">${topo}${formHTML(col, adm.form)}</div>`; ligarForm(col); return; }
  const q = adm.q.trim().toLowerCase();
  const itens = (col === "perguntas" ? [...DB[col]].sort((a,b) => a.sintomaId.localeCompare(b.sintomaId)) : ordNome(DB[col]))
    .filter(it => !q || [it.id, it.nome, it.texto, it.categoria, it.sistema].join(" ").toLowerCase().includes(q));
  view.innerHTML = `<div class="wrap" style="gap:16px">${topo}
    <div class="panel" style="gap:12px">
      <div class="atools">
        <label class="fld" for="abusca" style="flex:1"><span>Buscar em ${NOMES[col].toLowerCase()}</span><input id="abusca" type="search" value="${esc(adm.q)}" placeholder="Nome ou código" autocomplete="off"></label>
        <button class="btn primary" id="anovo" type="button">${NOVO[col]}</button>
      </div>
      <div class="alist">${itens.length ? itens.map(it => { const [t, sub, b1, b2] = linhaLista(col, it); return `
        <button type="button" class="arow" data-ed="${esc(it.id)}"><span class="code">${esc(it.id)}</span><span class="atit"><b>${esc(t)}</b><small>${esc(sub)}</small></span><span class="abadges">${b1}${b2}</span></button>`; }).join("")
        : `<p class="empty">Nada encontrado.</p>`}</div>
    </div>
    <div class="panel" style="gap:10px">
      <span class="label">Manutenção da base</span>
      <p class="hint">Exporte a base para guardar uma cópia de segurança ou para importá-la no Firebase quando o sistema for publicado.</p>
      <div class="nav" style="justify-content:flex-start">
        <button class="btn" id="aexp" type="button">Exportar base (JSON)</button>
        ${adm.restaurar ? `<span class="hint" style="align-self:center">Todas as alterações serão substituídas pela base original. Confirmar?</span><button class="btn danger" id="arestok" type="button">Restaurar</button><button class="btn" id="arestno" type="button">Cancelar</button>`
          : `<button class="btn" id="arest" type="button">Restaurar base original</button>`}
      </div>
    </div></div>`;
  view.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { adm.tab = b.dataset.at; adm.edit = null; adm.form = null; adm.confirm = null; adm.restaurar = false; adm.q = ""; adm.msg = ""; adm.err = ""; rAdmin(); });
  const busca = view.querySelector("#abusca");
  busca.oninput = () => { adm.q = busca.value; rAdmin(); const b = view.querySelector("#abusca"); b.focus(); b.setSelectionRange(b.value.length, b.value.length); };
  view.querySelector("#anovo").onclick = () => { adm.edit = "novo"; adm.form = novoForm(col); adm.err = ""; adm.msg = ""; rAdmin(); window.scrollTo({top:0}); };
  view.querySelectorAll("[data-ed]").forEach(b => b.onclick = () => { const it = DB[col].find(x => x.id === b.dataset.ed); adm.edit = it.id; adm.form = formDe(col, it); adm.err = ""; adm.msg = ""; adm.confirm = null; rAdmin(); window.scrollTo({top:0}); });
  view.querySelector("#aexp").onclick = exportarBase;
  view.querySelector("#arest")?.addEventListener("click", () => { adm.restaurar = true; rAdmin(); });
  view.querySelector("#arestno")?.addEventListener("click", () => { adm.restaurar = false; rAdmin(); });
  view.querySelector("#arestok")?.addEventListener("click", restaurarOriginal);
}

function campo(id, rot, html, dica){ return `<label class="fld" for="${id}"><span>${rot}</span>${html}${dica?`<small class="hint">${dica}</small>`:""}</label>`; }

function formHTML(col, f){
  const novo = !f.id, titulo = novo ? NOVO[col] : `Editar ${UNID[col]} ${f.id}`;
  const causasOrd = ordNome(DB.causas);
  let corpo = "";
  if (col === "sintomas") {
    const soma = f.causas.reduce((s,c) => s + (num(c.peso)||0), 0);
    corpo = `
      <div class="fields">
        ${campo("f-nome","Nome do sintoma *",`<input id="f-nome" data-f="nome" type="text" value="${esc(f.nome)}">`)}
        ${campo("f-cat","Categoria *",`<input id="f-cat" data-f="categoria" type="text" list="lcat" value="${esc(f.categoria)}"><datalist id="lcat">${CATS.map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist>`,"Escolha uma existente ou digite uma nova.")}
      </div>
      ${campo("f-desc","Descrição (como o usuário percebe o sintoma)",`<textarea id="f-desc" data-f="descricao" rows="2">${esc(f.descricao)}</textarea>`)}
      <label class="switch"><input type="checkbox" id="f-crit" data-f="critico" ${f.critico?"checked":""}><span><b>Sintoma crítico</b><br><small style="color:var(--muted)">Exibe o alerta "pare o veículo" no resultado e no relatório.</small></span></label>
      <div class="rows"><span class="label">Causas ligadas e pesos *</span>
        ${f.causas.map((c,i) => `<div class="row">
          <select aria-label="Causa ${i+1}" id="f-c${i}" data-row="causas:${i}:causaId">${opt("","Escolha a causa…",!c.causaId)}${causasOrd.map(x => opt(x.id, x.nome, x.id===c.causaId)).join("")}</select>
          <input aria-label="Peso da causa ${i+1}" id="f-p${i}" class="nw" data-row="causas:${i}:peso" type="text" inputmode="decimal" value="${esc(c.peso)}" placeholder="0,25">
          <button type="button" class="btn sm" data-rm="causas:${i}" aria-label="Remover causa ${i+1}">Remover</button></div>`).join("")}
        <div class="nav" style="justify-content:flex-start;align-items:center"><button type="button" class="btn sm" data-add="causas">Adicionar causa</button><button type="button" class="btn sm" id="fnorm">Ajustar para 1,00</button>
          <span class="hint">Soma atual: <b class="${Math.abs(soma-1)>0.01?"bad":""}">${soma.toFixed(2).replace(".",",")}</b></span></div>
        <p class="hint">O peso indica o quanto cada causa explica o sintoma. A soma precisa fechar em 1,00.</p>
      </div>
      ${f.id ? `<p class="hint">Perguntas complementares deste sintoma: ${(S[f.id]?.perguntas||[]).length}. Para editá-las, use o cadastro Perguntas.</p>` : ""}`;
  }
  if (col === "causas") {
    const sist = [...new Set(DB.causas.map(c => c.sistema))].sort();
    corpo = `
      <div class="fields">
        ${campo("f-nome","Nome da causa *",`<input id="f-nome" data-f="nome" type="text" value="${esc(f.nome)}">`)}
        ${campo("f-sis","Sistema do veículo *",`<input id="f-sis" data-f="sistema" type="text" list="lsis" value="${esc(f.sistema)}"><datalist id="lsis">${sist.map(s => `<option value="${esc(s)}"></option>`).join("")}</datalist>`)}
        ${campo("f-urg","Urgência",`<select id="f-urg" data-f="urgencia">${Object.entries(URG).map(([k,l]) => opt(k, `${l} — ${URGTXT[k]}`, k===f.urgencia)).join("")}</select>`)}
      </div>
      <div class="rows"><span class="label">Ocorre em *</span>
        <div class="checks">${Object.entries(COMB).map(([k,l]) => `<label><input type="checkbox" data-comb value="${k}" id="f-comb-${k}" ${f.combustiveis.includes(k)?"checked":""}> ${l}</label>`).join("")}
        <label><input type="checkbox" data-f="somenteTurbo" id="f-turbo" ${f.somenteTurbo?"checked":""}> Somente motores turbo</label></div></div>
      <div class="rows"><span class="label">Peças relacionadas</span>
        <div class="tray">${f.pecas.length ? f.pecas.map(p => `<span class="chip">${esc(P[p]||p)}<button type="button" data-rmp="${esc(p)}" aria-label="Remover ${esc(P[p]||p)}">×</button></span>`).join("") : `<span class="empty">Nenhuma peça ligada.</span>`}</div>
        <div class="row"><select id="f-addp" aria-label="Adicionar peça">${opt("","Adicionar peça existente…",true)}${ordNome(DB.pecas).filter(p => !f.pecas.includes(p.id)).map(p => opt(p.id, p.nome)).join("")}</select></div>
        <p class="hint">Peça nova? Cadastre primeiro em Peças e depois volte aqui.</p></div>
      ${campo("f-test","Testes de confirmação * (um por linha)",`<textarea id="f-test" data-f="testes" rows="3">${esc(f.testes)}</textarea>`)}
      <div class="rows"><span class="label">Soluções *</span>
        ${f.solucoes.map((s,i) => `<div class="row">
          <input aria-label="Solução ${i+1}" id="f-s${i}" data-row="solucoes:${i}:descricao" type="text" value="${esc(s.descricao)}" placeholder="Descreva o reparo">
          <select aria-label="Complexidade da solução ${i+1}" id="f-sc${i}" class="nw2" data-row="solucoes:${i}:complexidade">${["baixa","media","alta"].map(k => opt(k, "Complexidade " + URG[k].toLowerCase(), k===s.complexidade)).join("")}</select>
          <button type="button" class="btn sm" data-rm="solucoes:${i}" aria-label="Remover solução ${i+1}">Remover</button></div>`).join("")}
        <div><button type="button" class="btn sm" data-add="solucoes">Adicionar solução</button></div></div>
      ${campo("f-obs","Observação de segurança (opcional)",`<input id="f-obs" data-f="observacao" type="text" value="${esc(f.observacao)}" placeholder="Ex.: Não rode com a luz de óleo acesa">`)}`;
  }
  if (col === "pecas") {
    const u = f.id ? usoPeca(f.id) : [];
    corpo = `${campo("f-nome","Nome da peça *",`<input id="f-nome" data-f="nome" type="text" value="${esc(f.nome)}">`)}
      ${f.id ? `<p class="hint">${u.length ? "Usada em: " + u.map(c => esc(c.nome)).join(", ") : "Ainda não está ligada a nenhuma causa."}</p>` : ""}`;
  }
  if (col === "perguntas") {
    const sint = S[f.sintomaId], alvo = sint ? sint.causas.map(c => C[c.causaId]).filter(Boolean) : [];
    corpo = `
      ${campo("f-sint","Sintoma *",`<select id="f-sint" data-f="sintomaId">${opt("","Escolha o sintoma…",!f.sintomaId)}${ordNome(DB.sintomas).map(s => opt(s.id, s.nome, s.id===f.sintomaId)).join("")}</select>`,"A pergunta aparece quando este sintoma é marcado.")}
      ${campo("f-txt","Pergunta *",`<input id="f-txt" data-f="texto" type="text" value="${esc(f.texto)}" placeholder="Ex.: A fumaça aumenta ao acelerar forte?">`,"Escreva de forma que a resposta seja sim ou não.")}
      <div class="rows"><span class="label">Efeito de cada resposta *</span>
        ${!sint ? `<p class="hint">Escolha o sintoma para ver as causas disponíveis.</p>` : f.efeitos.map((x,i) => `<div class="row">
          <select aria-label="Resposta ${i+1}" id="f-er${i}" class="nw2" data-row="efeitos:${i}:resp">${opt("sim","Se responder Sim",x.resp==="sim")}${opt("nao","Se responder Não",x.resp==="nao")}</select>
          <select aria-label="Causa afetada ${i+1}" id="f-ec${i}" data-row="efeitos:${i}:causaId">${opt("","Causa afetada…",!x.causaId)}${alvo.map(c => opt(c.id, c.nome, c.id===x.causaId)).join("")}</select>
          <input aria-label="Multiplicador ${i+1}" id="f-em${i}" class="nw" data-row="efeitos:${i}:multiplicador" type="text" inputmode="decimal" value="${esc(x.multiplicador)}" placeholder="1,5">
          <button type="button" class="btn sm" data-rm="efeitos:${i}" aria-label="Remover efeito ${i+1}">Remover</button></div>`).join("")}
        ${sint ? `<div><button type="button" class="btn sm" data-add="efeitos">Adicionar efeito</button></div>` : ""}
        <p class="hint">Multiplicador acima de 1 aumenta a chance da causa (1,5 = +50%). Abaixo de 1 reduz (0,5 = metade). "Não sei" nunca altera o resultado.</p></div>`;
  }
  let excluir = "";
  if (f.id) {
    let bloqueio = "";
    if (col === "causas") { const u = usoCausa(f.id); if (u.s.length || u.q.length) bloqueio = `Para excluir, primeiro retire esta causa de: ${[...u.s.map(s => s.nome), ...u.q.map(q => "pergunta " + q.id)].map(esc).join(", ")}.`; }
    if (col === "pecas") { const u = usoPeca(f.id); if (u.length) bloqueio = `Para excluir, primeiro retire esta peça de: ${u.map(c => esc(c.nome)).join(", ")}.`; }
    const aviso = col === "sintomas" && (S[f.id]?.perguntas||[]).length ? ` As ${(S[f.id].perguntas).length} perguntas ligadas a ele também serão excluídas.` : "";
    excluir = bloqueio ? `<p class="hint">${bloqueio}</p>`
      : adm.confirm === f.id ? `<span class="hint" style="align-self:center">Excluir ${f.id} definitivamente?${aviso}</span><button class="btn danger" id="fdelok" type="button">Excluir</button><button class="btn" id="fdelno" type="button">Cancelar</button>`
      : `<button class="btn" id="fdel" type="button">Excluir</button>`;
  }
  return `<form class="panel" id="aform" novalidate>
    <h2>${titulo}</h2>
    ${adm.err ? `<p class="err" id="aerr" tabindex="-1" role="alert">${esc(adm.err)}</p>` : ""}
    ${corpo}
    <div class="nav"><div class="nav" style="justify-content:flex-start">${excluir}</div>
      <div class="nav"><button class="btn" id="fcancel" type="button">Cancelar</button><button class="btn primary" type="submit" ${adm.busy?"disabled":""}>${adm.busy?"Salvando…":"Salvar"}</button></div></div>
  </form>`;
}

function ligarForm(col){
  const f = adm.form, re = () => { const y = window.scrollY; rAdmin(); window.scrollTo({top:y}); };
  view.querySelector("#aform").onsubmit = e => { e.preventDefault(); if (!adm.busy) salvarItem(); };
  view.querySelector("#fcancel").onclick = () => { adm.edit = null; adm.form = null; adm.err = ""; adm.confirm = null; rAdmin(); };
  view.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { coletar(); const k = b.dataset.add;
    f[k].push(k === "causas" ? {causaId:"", peso:""} : k === "solucoes" ? {descricao:"", complexidade:"baixa"} : {resp:"sim", causaId:"", multiplicador:""}); re(); });
  view.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { coletar(); const [k,i] = b.dataset.rm.split(":"); f[k].splice(+i, 1); if (!f[k].length) f[k].push(novoForm(col)[k][0]); re(); });
  view.querySelector("#fnorm")?.addEventListener("click", () => { coletar(); const l = f.causas.filter(c => num(c.peso) > 0), s = l.reduce((a,c) => a + num(c.peso), 0);
    if (!s) { adm.err = "Informe os pesos antes de ajustar."; re(); return; }
    let acc = 0; l.forEach((c,i) => { const v = i < l.length-1 ? Math.round(num(c.peso)/s*100)/100 : Math.round((1-acc)*100)/100; acc += v; c.peso = String(v).replace(".", ","); }); adm.err = ""; re(); });
  view.querySelector("#f-addp")?.addEventListener("change", e => { coletar(); if (e.target.value) f.pecas.push(e.target.value); re(); });
  view.querySelectorAll("[data-rmp]").forEach(b => b.onclick = () => { coletar(); f.pecas = f.pecas.filter(p => p !== b.dataset.rmp); re(); });
  view.querySelector("#f-sint")?.addEventListener("change", () => { coletar(); re(); });
  view.querySelector("#fdel")?.addEventListener("click", () => { coletar(); adm.confirm = f.id; re(); });
  view.querySelector("#fdelno")?.addEventListener("click", () => { coletar(); adm.confirm = null; re(); });
  view.querySelector("#fdelok")?.addEventListener("click", () => excluirItem(f.id));
}

document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => mostrar(b.dataset.v));
function imprimirRelatorio(){
  const w = window.open("", "_blank");
  const msg = document.getElementById("repmsg");
  if (!w) { if (msg) msg.textContent = "O navegador bloqueou a janela de impressão. Permita pop-ups para este site ou use Salvar em PDF."; return; }
  w.document.open(); w.document.write(relatorioHTML(dadosRelatorio()).replace("</body>", "<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body>")); w.document.close();
}
render();
await window.SIDAM_PLATAFORMA;
iniciarHistorico();
