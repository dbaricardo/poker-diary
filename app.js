// app.js — Poker Diary Main Application
(function(){
const $=s=>document.querySelector(s), $a=s=>document.querySelectorAll(s);
let currentWeekOffset=0, handCount=0;

function setText(sel,val){const e=$(sel);if(e)e.textContent=val;}

// === Navigation ===
function navigate(page){
  $a('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
  $a('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
  $('#sidebar')?.classList.remove('open');
  if(page==='dashboard')renderDashboard();
  else if(page==='sessions')renderSessionsList();
  else if(page==='weekly')renderWeekly();
  else if(page==='bankroll')renderBankroll();
  else if(page==='new-session')initSessionForm();
  updateBankrollDisplays();
}

// === Bankroll Displays ===
function updateBankrollDisplays(){
  const br=getBankroll(), txt=formatMoneyPlain(br);
  setText('#sidebar-bankroll',txt);
  setText('#mobile-bankroll',txt);
  setText('#bankroll-current-value',txt);
}

// === Dashboard ===
function renderDashboard(){
  const sessions=getSessions();
  const total=sessions.reduce((a,s)=>a+(s.result||0),0);
  const mins=sessions.reduce((a,s)=>a+(s.time||0),0);
  const hrs=mins/60;
  setText('#stat-profit',formatMoney(total));
  setText('#stat-sessions',sessions.length);
  setText('#stat-hours',hrs.toFixed(1)+'h');
  setText('#stat-winrate',hrs>0?formatMoney(total/hrs)+'/h':'$0/h');

  // Recent sessions
  const rc=$('#recent-sessions');
  if(rc){
    const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));
    if(!sorted.length){rc.innerHTML='<p class="empty-state">Nenhuma sessão registrada ainda.</p>';
    }else{
      rc.innerHTML='';
      sorted.slice(0,5).forEach(s=>{
        const d=document.createElement('div');d.className='recent-item';
        d.innerHTML=`<div><span class="recent-date">${s.date}</span><span class="recent-limit">${s.limit}</span></div><span class="recent-result ${(s.result||0)>=0?'positive':'negative'}">${formatMoney(s.result||0)}</span>`;
        d.onclick=()=>openModal(s.id);
        rc.appendChild(d);
      });
    }
  }

  // Discipline bars (last 10)
  const last10=[...sessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  if(last10.length){
    const n=last10.length;
    const pct=(field)=>Math.round(last10.filter(s=>s.discipline&&s.discipline[field]).length/n*100);
    const setBar=(id,pctId,val)=>{const b=$(id);if(b)b.style.width=val+'%';setText(pctId,val+'%');};
    setBar('#disc-limp','#disc-limp-pct',pct('gaveLimp'));
    setBar('#disc-raise','#disc-raise-pct',pct('paidRaise'));
    setBar('#disc-position','#disc-position-pct',pct('respectedPosition'));
    setBar('#disc-hero','#disc-hero-pct',pct('heroCall'));
    setBar('#disc-stoploss','#disc-stoploss-pct',pct('stopLoss'));
  }

  // Tilt ring
  const tiltPct=sessions.length?sessions.filter(s=>s.tilt).length/sessions.length:0;
  const circle=$('#tilt-circle');
  if(circle)circle.setAttribute('stroke-dashoffset',264-264*tiltPct);
  setText('#tilt-pct',Math.round(tiltPct*100)+'%');

  drawBankrollChart();
  updateBankrollDisplays();
}

function drawBankrollChart(){
  const canvas=$('#bankroll-chart');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width=canvas.offsetWidth||600;
  const H=canvas.height=canvas.offsetHeight||200;
  const sessions=[...getSessions()].sort((a,b)=>a.date.localeCompare(b.date));
  ctx.clearRect(0,0,W,H);
  if(!sessions.length){
    ctx.fillStyle='#64748b';ctx.font='14px Inter';
    ctx.textAlign='center';ctx.fillText('Registre sessões para ver o gráfico',W/2,H/2);
    return;
  }
  const pts=[];let cum=0;
  sessions.forEach(s=>{cum+=(s.result||0);pts.push(cum);});
  const mn=Math.min(0,...pts),mx=Math.max(0,...pts),range=mx-mn||1,pad=30;
  const xStep=(W-pad*2)/(pts.length-1||1);
  const toY=v=>pad+(1-(v-mn)/range)*(H-pad*2);
  // Zero line
  ctx.beginPath();ctx.moveTo(pad,toY(0));ctx.lineTo(W-pad,toY(0));
  ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;ctx.stroke();
  // Gradient fill
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(99,102,241,0.25)');grad.addColorStop(1,'rgba(99,102,241,0)');
  ctx.beginPath();ctx.moveTo(pad,toY(pts[0]));
  pts.forEach((p,i)=>ctx.lineTo(pad+i*xStep,toY(p)));
  ctx.lineTo(pad+(pts.length-1)*xStep,H-pad);ctx.lineTo(pad,H-pad);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  // Line
  ctx.beginPath();ctx.moveTo(pad,toY(pts[0]));
  pts.forEach((p,i)=>ctx.lineTo(pad+i*xStep,toY(p)));
  ctx.strokeStyle='#6366f1';ctx.lineWidth=2.5;ctx.stroke();
  // Dots
  pts.forEach((p,i)=>{
    ctx.beginPath();ctx.arc(pad+i*xStep,toY(p),4,0,Math.PI*2);
    ctx.fillStyle=p>=0?'#10b981':'#ef4444';ctx.fill();
    ctx.strokeStyle='#0a0e17';ctx.lineWidth=2;ctx.stroke();
  });
}

// === Session Form ===
function initSessionForm(){
  const d=$('#session-date');
  if(d&&!d.value)d.value=new Date().toISOString().slice(0,10);
}

function setupFormListeners(){
  // Sliders
  ['session-energy','session-focus','session-mood'].forEach(id=>{
    const sl=$('#'+id);if(!sl)return;
    const valId=id.replace('session-','')+'_val';
    const sp=$('#'+id.replace('session-','')+'-val');
    if(sp){sp.textContent=sl.value;sl.oninput=()=>sp.textContent=sl.value;}
  });
  // Fix: match actual span IDs
  const eSl=$('#session-energy'),eV=$('#energy-val');
  if(eSl&&eV){eV.textContent=eSl.value;eSl.oninput=()=>eV.textContent=eSl.value;}
  const fSl=$('#session-focus'),fV=$('#focus-val');
  if(fSl&&fV){fV.textContent=fSl.value;fSl.oninput=()=>fV.textContent=fSl.value;}
  const mSl=$('#session-mood'),mV=$('#mood-val');
  if(mSl&&mV){mV.textContent=mSl.value;mSl.oninput=()=>mV.textContent=mSl.value;}

  // Tilt toggle
  const tiltCb=$('#session-tilt');
  if(tiltCb){
    tiltCb.onchange=()=>{
      const g=$('#tilt-type-group');if(g)g.style.display=tiltCb.checked?'block':'none';
      const lbl=$('#tilt-label');if(lbl)lbl.textContent=tiltCb.checked?'Sim':'Não';
    };
  }

  // Result preview
  const ib=$('#session-buyin-initial'),fb=$('#session-buyin-final');
  const updateResult=()=>{
    const ini=parseFloat(ib?.value)||0, fin=parseFloat(fb?.value)||0;
    const r=fin-ini;
    const rv=$('#result-value');if(rv){rv.textContent=formatMoney(r);rv.style.color=r>=0?'#10b981':'#ef4444';}
    const limit=$('#session-limit')?.value||'NL2';
    const bi=getBuyInAmount(limit);
    const rb=$('#result-buyins');if(rb)rb.textContent=`(${(r/bi).toFixed(1)} buy-ins)`;
  };
  if(ib)ib.oninput=updateResult;
  if(fb)fb.oninput=updateResult;

  // Add hand button
  const addBtn=$('#add-hand-btn');
  if(addBtn)addBtn.onclick=addHandCard;

  // Form submit
  const form=$('#session-form');
  if(form)form.onsubmit=submitSession;
}

function addHandCard(){
  const c=$('#hands-container');if(!c)return;
  handCount++;
  const card=document.createElement('div');card.className='hand-card';
  card.innerHTML=`<div class="hand-card-header"><span class="hand-card-title">Mão ${handCount}</span><button type="button" class="hand-remove">✕</button></div>
<div class="form-grid">
<div class="form-group"><label>Posição</label><select class="h-pos"><option>UTG</option><option>HJ</option><option>CO</option><option>BTN</option><option>SB</option><option>BB</option></select></div>
<div class="form-group"><label>Mão</label><input type="text" class="h-hand" placeholder="AKs, QQ, etc."></div>
<div class="form-group"><label>Ação pré-flop</label><textarea class="h-preflop" rows="2" placeholder="Raise 3x, 3-bet..."></textarea></div>
<div class="form-group"><label>Flop</label><textarea class="h-flop" rows="2" placeholder="Board + ação"></textarea></div>
<div class="form-group"><label>Turn</label><textarea class="h-turn" rows="2" placeholder="Board + ação"></textarea></div>
<div class="form-group"><label>River</label><textarea class="h-river" rows="2" placeholder="Board + ação"></textarea></div>
</div>
<div class="form-group" style="margin-top:8px"><label>Dúvida principal</label><textarea class="h-doubt" rows="2" placeholder="Qual a principal dúvida desta mão?"></textarea></div>`;
  c.appendChild(card);
  card.querySelector('.hand-remove').onclick=()=>card.remove();
}

function submitSession(e){
  e.preventDefault();
  const v=id=>{const el=$(id);return el?el.value:'';};
  const n=id=>parseFloat(v(id))||0;
  const chk=id=>{const el=$(id);return el?el.checked:false;};
  const ini=n('#session-buyin-initial'), fin=n('#session-buyin-final');
  const result=fin-ini;
  const limit=v('#session-limit');
  const bi=getBuyInAmount(limit);

  const hands=[];
  $a('.hand-card').forEach(hc=>{
    hands.push({
      position:hc.querySelector('.h-pos')?.value||'',
      hand:hc.querySelector('.h-hand')?.value||'',
      preflop:hc.querySelector('.h-preflop')?.value||'',
      flop:hc.querySelector('.h-flop')?.value||'',
      turn:hc.querySelector('.h-turn')?.value||'',
      river:hc.querySelector('.h-river')?.value||'',
      doubt:hc.querySelector('.h-doubt')?.value||''
    });
  });

  const session={
    date:v('#session-date'), limit, format:v('#session-format'),
    time:n('#session-time'), tables:n('#session-tables'),
    initialBankroll:ini, finalBankroll:fin, result,
    resultBuyins:bi?+(result/bi).toFixed(2):0,
    energy:n('#session-energy'), focus:n('#session-focus'), mood:n('#session-mood'),
    stateAfter:v('#session-state-after'),
    tilt:chk('#session-tilt'), tiltType:chk('#session-tilt')?v('#session-tilt-type'):'',
    discipline:{
      gaveLimp:chk('#disc-gave-limp'), paidRaise:chk('#disc-paid-raise'),
      respectedPosition:chk('#disc-respected-position'),
      heroCall:chk('#disc-hero-call'), stopLoss:chk('#disc-stop-loss')
    },
    hands,
    review:{
      best:v('#review-best'), worst:v('#review-worst'), error:v('#review-error'),
      lesson:v('#review-lesson'), rule:v('#review-rule')
    }
  };

  saveSession(session);
  toast('✅ Sessão salva com sucesso!','success');
  e.target.reset();
  const hc=$('#hands-container');if(hc)hc.innerHTML='';
  handCount=0;
  navigate('dashboard');
}

// === Sessions List ===
function renderSessionsList(){
  const c=$('#sessions-list');if(!c)return;
  let sessions=[...getSessions()].sort((a,b)=>b.date.localeCompare(a.date));
  const search=$('#session-search')?.value?.toLowerCase()||'';
  const limitF=$('#session-filter-limit')?.value||'';
  const resultF=$('#session-filter-result')?.value||'';
  if(search)sessions=sessions.filter(s=>(s.date+' '+s.limit+' '+s.format+(s.review?.lesson||'')).toLowerCase().includes(search));
  if(limitF)sessions=sessions.filter(s=>s.limit===limitF);
  if(resultF==='positive')sessions=sessions.filter(s=>(s.result||0)>=0);
  if(resultF==='negative')sessions=sessions.filter(s=>(s.result||0)<0);

  if(!sessions.length){c.innerHTML='<p class="empty-state">Nenhuma sessão encontrada. <a href="#" data-page="new-session">Registre sua primeira sessão!</a></p>';return;}
  c.innerHTML='';
  sessions.forEach(s=>{
    const card=document.createElement('div');card.className='session-card';
    card.innerHTML=`<span class="session-card-date">${s.date}</span>
<div class="session-card-info"><span class="session-card-limit">${s.limit} — ${s.format||''}</span><span class="session-card-meta">${s.time||0}min · ${s.tables||1} mesa(s)${s.tilt?' · 😤 Tilt':''}</span></div>
<span class="session-card-result ${(s.result||0)>=0?'positive':'negative'}">${formatMoney(s.result||0)}</span>
<button class="session-card-delete" title="Excluir">🗑</button>`;
    card.querySelector('.session-card-delete').onclick=e=>{
      e.stopPropagation();
      if(confirm('Excluir esta sessão?')){deleteSession(s.id);renderSessionsList();updateBankrollDisplays();toast('Sessão excluída','info');}
    };
    card.onclick=()=>openModal(s.id);
    c.appendChild(card);
  });
}

// === Modal ===
function openModal(id){
  const s=getSessionById(id);if(!s)return;
  const overlay=$('#modal-overlay');if(!overlay)return;
  const mc=$('#modal-content');
  const disc=s.discipline||{};
  const rv=s.review||{};
  const check=(v,good)=>v?(good?'✅':'❌'):(good?'❌':'✅');

  let html=`<h2 style="margin-bottom:16px">📋 Sessão — ${s.date}</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
<div><strong>Limite:</strong> ${s.limit}</div><div><strong>Formato:</strong> ${s.format||'—'}</div>
<div><strong>Tempo:</strong> ${s.time||0}min</div><div><strong>Mesas:</strong> ${s.tables||1}</div>
<div><strong>Banca Inicial:</strong> ${formatMoneyPlain(s.initialBankroll||0)}</div><div><strong>Banca Final:</strong> ${formatMoneyPlain(s.finalBankroll||0)}</div>
</div>
<div style="padding:16px;border-radius:8px;background:rgba(255,255,255,0.04);margin-bottom:16px;text-align:center">
<span style="font-size:0.85rem;color:#94a3b8">Resultado</span><br>
<span style="font-size:1.8rem;font-weight:800;font-family:var(--mono);color:${(s.result||0)>=0?'#10b981':'#ef4444'}">${formatMoney(s.result||0)}</span>
<span style="color:#64748b;font-size:0.85rem"> (${s.resultBuyins||0} buy-ins)</span>
</div>
<h3>🧠 Estado Emocional</h3>
<p>Energia: ${s.energy}/10 · Foco: ${s.focus}/10 · Humor: ${s.mood}/10</p>
<p>Estado depois: ${s.stateAfter||'—'} · Tilt: ${s.tilt?'Sim — '+s.tiltType:'Não'}</p>
<h3 style="margin-top:16px">📏 Disciplina</h3>
<ul style="list-style:none;padding:0">
<li>${check(disc.gaveLimp,false)} Dei limp</li>
<li>${check(disc.paidRaise,false)} Paguei raise sem plano</li>
<li>${check(disc.respectedPosition,true)} Respeitei posição</li>
<li>${check(disc.heroCall,false)} Fiz hero call duvidoso</li>
<li>${check(disc.stopLoss,true)} Respeitei stop loss</li>
</ul>`;

  if(s.hands&&s.hands.length){
    html+='<h3 style="margin-top:16px">🃏 Mãos Marcadas</h3>';
    s.hands.forEach((h,i)=>{
      html+=`<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:12px;margin-bottom:8px">
<strong>${h.position} — ${h.hand}</strong>
<p style="font-size:0.85rem;color:#94a3b8">PF: ${h.preflop||'—'} | Flop: ${h.flop||'—'} | Turn: ${h.turn||'—'} | River: ${h.river||'—'}</p>
${h.doubt?'<p style="font-style:italic;color:#f59e0b;font-size:0.85rem">Dúvida: '+h.doubt+'</p>':''}
</div>`;
    });
  }

  html+=`<h3 style="margin-top:16px">📝 Revisão</h3>
<p><strong>Melhor decisão:</strong> ${rv.best||'—'}</p>
<p><strong>Pior decisão:</strong> ${rv.worst||'—'}</p>
<p><strong>Erro principal:</strong> ${rv.error||'—'}</p>
<p><strong>Lição do dia:</strong> ${rv.lesson||'—'}</p>
<p><strong>Regra próxima sessão:</strong> ${rv.rule||'—'}</p>`;

  mc.innerHTML=html;
  overlay.classList.add('active');
}

function closeModal(){$('#modal-overlay')?.classList.remove('active');}

// === Weekly Review ===
function renderWeekly(){
  const d=new Date();d.setDate(d.getDate()+currentWeekOffset*7);
  const wk=getWeekKey(d);
  const range=getWeekRange(wk);
  const fmt=d=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  setText('#week-label',`${fmt(range.start)} — ${fmt(range.end)} (${wk})`);

  const sessions=getSessionsForWeek(wk);
  const tot=sessions.reduce((a,s)=>a+(s.result||0),0);
  const hrs=sessions.reduce((a,s)=>a+(s.time||0),0)/60;
  const buyins=sessions.reduce((a,s)=>a+(s.resultBuyins||0),0);

  setText('#ws-sessions',sessions.length);
  setText('#ws-hours',hrs.toFixed(1)+'h');
  const wsR=$('#ws-result');if(wsR){wsR.textContent=formatMoney(tot);wsR.style.color=tot>=0?'#10b981':'#ef4444';}
  setText('#ws-buyins',buyins.toFixed(1));

  setText('#ws-limps',sessions.filter(s=>s.discipline?.gaveLimp).length);
  setText('#ws-calls',sessions.filter(s=>s.discipline?.paidRaise).length);
  setText('#ws-hero',sessions.filter(s=>s.discipline?.heroCall).length);
  setText('#ws-stoploss',sessions.filter(s=>!s.discipline?.stopLoss).length);
  setText('#ws-tilt',sessions.filter(s=>s.tilt).length+'/'+sessions.length);

  const triggers=sessions.filter(s=>s.tilt&&s.tiltType).map(s=>s.tiltType);
  const mode=triggers.length?triggers.sort((a,b)=>triggers.filter(v=>v===a).length-triggers.filter(v=>v===b).length).pop():'—';
  setText('#ws-trigger',mode);

  // Load saved notes
  const notes=getWeeklyNotes()[wk]||{};
  const wl=$('#weekly-leak');if(wl)wl.value=notes.leak||'';
  const wr=$('#weekly-rule');if(wr)wr.value=notes.rule||'';
  const ws=$('#weekly-study');if(ws)ws.value=notes.study||'';
}

// === Bankroll Page ===
function renderBankroll(){
  const br=getBankroll();
  setText('#bankroll-current-value',formatMoneyPlain(br));
  const buyIns=Math.floor(br/getBuyInAmount('NL2'));
  setText('#bm-buyins',buyIns);
  let risk='🟢 Baixo';if(buyIns<20)risk='🔴 Alto';else if(buyIns<40)risk='🟡 Médio';
  setText('#bm-risk',risk);
  let next='Mantenha NL2';
  if(br>=200)next='NL5 ($200+)';if(br>=500)next='NL10 ($500+)';if(br>=1000)next='NL25 ($1000+)';
  setText('#bm-next-limit',next);

  // Transaction history
  const hc=$('#bankroll-history');
  if(hc){
    const txs=getTransactions();
    if(!txs.length){hc.innerHTML='<p class="empty-state">Nenhuma transação registrada.</p>';}
    else{
      hc.innerHTML='';
      txs.forEach(t=>{
        const row=document.createElement('div');row.className='br-item';
        row.innerHTML=`<span>${t.date?.slice(0,10)||'—'}</span><span class="br-item-type ${t.type}">${t.type==='deposit'?'Depósito':'Saque'}</span><span style="font-family:var(--mono);font-weight:600;color:${t.type==='deposit'?'#10b981':'#ef4444'}">${t.type==='deposit'?'+':'-'}$${Math.abs(t.amount).toFixed(2)}</span>`;
        hc.appendChild(row);
      });
    }
  }
  updateBankrollDisplays();
}

// === Init ===
document.addEventListener('DOMContentLoaded',()=>{
  // Navigation
  $a('[data-page]').forEach(l=>l.addEventListener('click',e=>{
    e.preventDefault();navigate(l.dataset.page);
  }));

  // Mobile menu
  const mt=$('#menu-toggle');
  if(mt)mt.onclick=()=>$('#sidebar')?.classList.toggle('open');

  // Session form
  setupFormListeners();

  // Session list filters
  ['#session-search','#session-filter-limit','#session-filter-result'].forEach(sel=>{
    const el=$(sel);if(!el)return;
    el.addEventListener('input',renderSessionsList);
    el.addEventListener('change',renderSessionsList);
  });

  // Modal
  $('#modal-close')?.addEventListener('click',closeModal);
  $('#modal-overlay')?.addEventListener('click',e=>{if(e.target.id==='modal-overlay')closeModal();});

  // Weekly nav
  $('#prev-week')?.addEventListener('click',()=>{currentWeekOffset--;renderWeekly();});
  $('#next-week')?.addEventListener('click',()=>{currentWeekOffset++;renderWeekly();});

  // Weekly notes form
  const wnf=$('#weekly-notes-form');
  if(wnf)wnf.onsubmit=e=>{
    e.preventDefault();
    const d=new Date();d.setDate(d.getDate()+currentWeekOffset*7);
    const wk=getWeekKey(d);
    saveWeeklyNote(wk,{
      leak:$('#weekly-leak')?.value||'',
      rule:$('#weekly-rule')?.value||'',
      study:$('#weekly-study')?.value||''
    });
    toast('📝 Notas semanais salvas!','success');
  };

  // Bankroll form
  const brf=$('#bankroll-form');
  if(brf)brf.onsubmit=e=>{
    e.preventDefault();
    const type=$('#br-type')?.value;
    const amt=parseFloat($('#br-amount')?.value);
    if(!amt||amt<=0){toast('Insira um valor válido','error');return;}
    addTransaction({type,amount:amt,note:$('#br-note')?.value||''});
    toast(type==='deposit'?'💰 Depósito registrado!':'💸 Saque registrado!','success');
    brf.reset();
    renderBankroll();
  };

  // Settings
  $('#export-data')?.addEventListener('click',()=>{exportAllData();toast('📥 Dados exportados!','info');});
  $('#import-data')?.addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      if(importData(ev.target.result)){toast('📤 Dados importados!','success');renderDashboard();}
      else toast('Erro ao importar','error');
    };
    r.readAsText(f);
  });
  $('#clear-data')?.addEventListener('click',()=>{
    if(confirm('⚠️ Limpar TODOS os dados? Esta ação não pode ser desfeita.')){
      clearAllData();toast('🗑️ Dados limpos','info');renderDashboard();updateBankrollDisplays();
    }
  });
  $('#save-settings')?.addEventListener('click',()=>{
    const s=getSettings();
    s.stopLoss=parseInt($('#stop-loss-amount')?.value)||3;
    saveSettings(s);toast('⚙️ Configurações salvas!','success');
  });

  // Hand History Import
  $('#import-hh')?.addEventListener('change',handleHHImport);

  // Init
  initSessionForm();
  renderDashboard();
  // Load settings
  const settings=getSettings();
  const slInput=$('#stop-loss-amount');if(slInput)slInput.value=settings.stopLoss||3;
});

// === Hand History Import Handler ===
function handleHHImport(e){
  const files=e.target.files;if(!files.length)return;
  let totalHands=0,totalSessions=0;
  const promises=[];
  for(const f of files){
    promises.push(new Promise(resolve=>{
      const r=new FileReader();
      r.onload=ev=>{
        const result=HandHistoryParser.parse(ev.target.result);
        if(result.sessions){
          result.sessions.forEach(ps=>{
            const session={
              date:ps.date, limit:ps.limit, format:ps.tableType==='6-max'?'Cash Game 6-max':'Cash Game 9-max',
              time:ps.duration||0, tables:1, initialBankroll:0, finalBankroll:ps.result||0,
              result:ps.result||0, resultBuyins:ps.result?+(ps.result/getBuyInAmount(ps.limit||'NL2')).toFixed(2):0,
              energy:5,focus:5,mood:5,stateAfter:'Neutro',tilt:false,tiltType:'',
              discipline:{gaveLimp:false,paidRaise:false,respectedPosition:true,heroCall:false,stopLoss:true},
              hands:(ps.notableHands||[]).map(h=>({
                position:h.position||'',hand:h.cards||'',preflop:'',
                flop:'',turn:'',river:'',doubt:'Board: '+(h.board||'')
              })),
              review:{best:'',worst:'',error:'',lesson:'Sessão importada de '+ps.site,rule:''},
              source:'import',site:ps.site
            };
            saveSession(session);
            totalSessions++;
          });
          totalHands+=result.hands.length;
        }
        resolve();
      };
      r.readAsText(f);
    }));
  }
  Promise.all(promises).then(()=>{
    toast(`🃏 Importado: ${totalHands} mãos em ${totalSessions} sessões!`,'success');
    renderDashboard();updateBankrollDisplays();
    e.target.value='';
  });
}
})();
