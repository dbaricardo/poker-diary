// app.js — Poker Diary Main Application
(function(){
const $=s=>document.querySelector(s), $a=s=>document.querySelectorAll(s);
let currentWeekOffset=0, handCount=0, editingSessionId=null;

// Page title mapping for mobile header
const pageTitles = {
  dashboard: '📊 Dashboard',
  'new-session': '➕ Nova Sessão',
  sessions: '📋 Sessões',
  weekly: '📅 Revisão Semanal',
  bankroll: '💰 Bankroll',
  settings: '⚙️ Configurações'
};

function setText(sel,val){const e=$(sel);if(e)e.textContent=val;}

// === Debounce utility ===
function debounce(fn, ms=200){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

// === Count-up animation ===
function animateValue(el, end, format, duration=600) {
  if (!el) return;
  const start = parseFloat(el.dataset.lastValue) || 0;
  el.dataset.lastValue = end;
  if (start === end) { el.textContent = format(end); return; }
  const range = end - start;
  const startTime = performance.now();
  function update(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    el.textContent = format(start + range * eased);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = format(end); // ensure exact final value
  }
  requestAnimationFrame(update);
}

// === Button Ripple Effect ===
function initRippleEffect() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

// === Navigation with exit animation ===
function navigate(page){
  const current = document.querySelector('.page.active');
  const target = document.getElementById('page-'+page);
  if (current === target) return;

  // Update nav immediately
  $a('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
  $('#sidebar')?.classList.remove('open');

  // Update mobile header title
  const mt = $('.mobile-title');
  if (mt) mt.textContent = pageTitles[page] || '♠ PokerDiary';

  // Exit animation on current page
  if (current) {
    current.classList.remove('active');
    current.classList.add('page-exit');
    current.addEventListener('animationend', () => {
      current.classList.remove('page-exit');
    }, { once: true });
  }

  // Enter new page after brief delay
  setTimeout(() => {
    target.classList.add('active');
    // Trigger page-specific rendering
    if(page==='dashboard')renderDashboard();
    else if(page==='sessions')renderSessionsList();
    else if(page==='weekly')renderWeekly();
    else if(page==='bankroll')renderBankroll();
    else if(page==='new-session')initSessionForm();
    updateBankrollDisplays();
  }, current ? 150 : 0);
}

// === Bankroll Displays ===
function updateBankrollDisplays(){
  const br=getBankroll(), txt=formatMoneyPlain(br);
  const sidebarBr = $('#sidebar-bankroll');
  const mobileBr = $('#mobile-bankroll');
  if (sidebarBr) { sidebarBr.textContent = txt; sidebarBr.style.color = br >= 0 ? 'var(--green)' : 'var(--red)'; }
  if (mobileBr) { mobileBr.textContent = txt; mobileBr.style.color = br >= 0 ? 'var(--green)' : 'var(--red)'; }
  setText('#bankroll-current-value',txt);
}

// === Dashboard ===
function renderDashboard(){
  const sessions=getSessions();
  const total=sessions.reduce((a,s)=>a+(s.result||0),0);
  const mins=sessions.reduce((a,s)=>a+(s.time||0),0);
  const hrs=mins/60;

  // Animated stat values
  const profitEl = $('#stat-profit');
  const sessionsEl = $('#stat-sessions');
  const hoursEl = $('#stat-hours');
  const winrateEl = $('#stat-winrate');

  animateValue(profitEl, total, v => formatMoney(v));
  animateValue(sessionsEl, sessions.length, v => Math.round(v).toString());
  animateValue(hoursEl, hrs, v => v.toFixed(1)+'h');
  animateValue(winrateEl, hrs>0?total/hrs:0, v => formatMoney(v)+'/h');

  // Recent sessions
  const rc=$('#recent-sessions');
  if(rc){
    const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));
    if(!sorted.length){
      rc.innerHTML=`<div class="empty-state">
        <div class="empty-icon">🎰</div>
        <h3 class="empty-title">Nenhuma sessão ainda</h3>
        <p class="empty-text">Registre sua primeira sessão para ver seu histórico aqui.</p>
        <a href="#" data-page="new-session" class="btn btn-primary btn-sm">+ Nova Sessão</a>
      </div>`;
    }else{
      rc.innerHTML='';
      sorted.slice(0,5).forEach((s,i)=>{
        const d=document.createElement('div');d.className='recent-item';
        d.style.animationDelay=i*0.05+'s';
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
    const setBar=(id,pctId,val)=>{
      const b=$(id);
      if(b) { setTimeout(() => { b.style.width=val+'%'; }, 100); } // delay for animation
      setText(pctId,val+'%');
    };
    setBar('#disc-limp','#disc-limp-pct',pct('gaveLimp'));
    setBar('#disc-raise','#disc-raise-pct',pct('paidRaise'));
    setBar('#disc-position','#disc-position-pct',pct('respectedPosition'));
    setBar('#disc-hero','#disc-hero-pct',pct('heroCall'));
    setBar('#disc-stoploss','#disc-stoploss-pct',pct('stopLoss'));
  }

  // Tilt ring
  const tiltPct=sessions.length?sessions.filter(s=>s.tilt).length/sessions.length:0;
  const circle=$('#tilt-circle');
  if(circle) setTimeout(()=>circle.setAttribute('stroke-dashoffset',264-264*tiltPct),200);
  setText('#tilt-pct',Math.round(tiltPct*100)+'%');

  drawBankrollChart();
  updateBankrollDisplays();
}

// === Bankroll Chart — Enhanced ===
let chartTooltip = null;
let chartPoints = [];

function drawBankrollChart(){
  const canvas=$('#bankroll-chart');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width - 48; // account for card padding
  const H = 220;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const sessions=[...getSessions()].sort((a,b)=>a.date.localeCompare(b.date));
  ctx.clearRect(0,0,W,H);
  chartPoints = [];

  if(!sessions.length){
    ctx.fillStyle='#64748b';ctx.font='14px Inter';
    ctx.textAlign='center';ctx.fillText('Registre sessões para ver o gráfico',W/2,H/2);
    return;
  }

  const pts=[];let cum=0;
  const dates=[];
  sessions.forEach(s=>{cum+=(s.result||0);pts.push(cum);dates.push(s.date);});
  const mn=Math.min(0,...pts),mx=Math.max(0,...pts),range=mx-mn||1;
  const padL=55,padR=20,padT=20,padB=35;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const xStep=plotW/(pts.length-1||1);
  const toX=i=>padL+i*xStep;
  const toY=v=>padT+(1-(v-mn)/range)*plotH;

  // Grid lines (horizontal)
  const gridLines = 5;
  ctx.textAlign='right';ctx.textBaseline='middle';
  ctx.font='11px JetBrains Mono, monospace';
  for(let i=0;i<=gridLines;i++){
    const v=mn+(range/gridLines)*i;
    const y=toY(v);
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);
    ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.fillText('$'+v.toFixed(0),padL-8,y);
  }

  // Zero line
  if(mn<0&&mx>0){
    ctx.beginPath();ctx.moveTo(padL,toY(0));ctx.lineTo(W-padR,toY(0));
    ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
    ctx.stroke();ctx.setLineDash([]);
  }

  // X axis labels (first, last, middle)
  ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='rgba(255,255,255,0.3)';
  const labelIdxs=[0];
  if(pts.length>2)labelIdxs.push(Math.floor(pts.length/2));
  if(pts.length>1)labelIdxs.push(pts.length-1);
  labelIdxs.forEach(i=>{
    ctx.fillText(dates[i]||'',toX(i),H-padB+8);
  });

  // Gradient fill under curve
  const grad=ctx.createLinearGradient(0,padT,0,H-padB);
  const lastPt=pts[pts.length-1];
  if(lastPt>=0){
    grad.addColorStop(0,'rgba(16,185,129,0.2)');grad.addColorStop(1,'rgba(16,185,129,0)');
  }else{
    grad.addColorStop(0,'rgba(239,68,68,0.08)');grad.addColorStop(1,'rgba(239,68,68,0.15)');
  }

  // Draw bezier curve path
  ctx.beginPath();ctx.moveTo(toX(0),toY(pts[0]));
  for(let i=1;i<pts.length;i++){
    const cx=(toX(i-1)+toX(i))/2;
    ctx.bezierCurveTo(cx,toY(pts[i-1]),cx,toY(pts[i]),toX(i),toY(pts[i]));
  }
  // Fill
  const fillPath = new Path2D();
  fillPath.moveTo(toX(0),toY(pts[0]));
  for(let i=1;i<pts.length;i++){
    const cx=(toX(i-1)+toX(i))/2;
    fillPath.bezierCurveTo(cx,toY(pts[i-1]),cx,toY(pts[i]),toX(i),toY(pts[i]));
  }
  fillPath.lineTo(toX(pts.length-1),H-padB);fillPath.lineTo(toX(0),H-padB);fillPath.closePath();
  ctx.fillStyle=grad;ctx.fill(fillPath);

  // Line
  ctx.beginPath();ctx.moveTo(toX(0),toY(pts[0]));
  for(let i=1;i<pts.length;i++){
    const cx=(toX(i-1)+toX(i))/2;
    ctx.bezierCurveTo(cx,toY(pts[i-1]),cx,toY(pts[i]),toX(i),toY(pts[i]));
  }
  const lineColor = lastPt>=0 ? '#10b981' : '#ef4444';
  ctx.strokeStyle=lineColor;ctx.lineWidth=2.5;ctx.stroke();

  // Dots + store positions for tooltip
  pts.forEach((p,i)=>{
    const x=toX(i),y=toY(p);
    ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fillStyle=p>=0?'#10b981':'#ef4444';ctx.fill();
    ctx.strokeStyle='#0a0e17';ctx.lineWidth=2;ctx.stroke();
    chartPoints.push({x,y,value:p,date:dates[i]});
  });
}

function setupChartTooltip(){
  const canvas=$('#bankroll-chart');if(!canvas)return;
  const chartCard=canvas.closest('.chart-card');
  if(!chartCard)return;

  // Create tooltip element
  chartTooltip = document.createElement('div');
  chartTooltip.className='chart-tooltip';
  chartTooltip.innerHTML='<div class="ct-date"></div><div class="ct-value"></div>';
  chartCard.appendChild(chartTooltip);

  canvas.addEventListener('mousemove',e=>{
    if(!chartPoints.length){chartTooltip.classList.remove('visible');return;}
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    // Find nearest point
    let nearest=null,minDist=Infinity;
    chartPoints.forEach(p=>{
      const dist=Math.abs(p.x-mx);
      if(dist<minDist){minDist=dist;nearest=p;}
    });
    if(nearest&&minDist<30){
      chartTooltip.classList.add('visible');
      chartTooltip.querySelector('.ct-date').textContent=nearest.date;
      chartTooltip.querySelector('.ct-value').textContent=formatMoney(nearest.value);
      chartTooltip.querySelector('.ct-value').style.color=nearest.value>=0?'#10b981':'#ef4444';
      chartTooltip.style.left=(nearest.x+10)+'px';
      chartTooltip.style.top=(nearest.y-40)+'px';
    }else{
      chartTooltip.classList.remove('visible');
    }
  });
  canvas.addEventListener('mouseleave',()=>{
    chartTooltip.classList.remove('visible');
  });
}

// ResizeObserver for chart
function setupChartResize(){
  const canvas=$('#bankroll-chart');if(!canvas)return;
  const observer=new ResizeObserver(debounce(()=>{
    if(document.querySelector('#page-dashboard.active'))drawBankrollChart();
  },200));
  observer.observe(canvas.parentElement);
}

// === Session Form ===
function initSessionForm(){
  const d=$('#session-date');
  if(d&&!d.value&&!editingSessionId)d.value=new Date().toISOString().slice(0,10);
}

function setupFormListeners(){
  // Slider real-time values
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

  // Result preview with visual feedback
  const ib=$('#session-buyin-initial'),fb=$('#session-buyin-final');
  const updateResult=()=>{
    const ini=parseFloat(ib?.value)||0, fin=parseFloat(fb?.value)||0;
    const r=fin-ini;
    const rv=$('#result-value');
    if(rv){rv.textContent=formatMoney(r);rv.style.color=r>=0?'#10b981':'#ef4444';}
    const limit=$('#session-limit')?.value||'NL2';
    const bi=getBuyInAmount(limit);
    const rb=$('#result-buyins');if(rb)rb.textContent=`(${(r/bi).toFixed(1)} buy-ins)`;
    // Result preview border feedback
    const rp=$('#result-preview');
    if(rp){
      rp.classList.remove('positive','negative');
      if(fin&&ini) rp.classList.add(r>=0?'positive':'negative');
    }
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
  card.querySelector('.hand-remove').onclick=()=>{card.style.animation='handCardOut 0.3s ease forwards';setTimeout(()=>card.remove(),300);};
}

function submitSession(e){
  e.preventDefault();
  const v=id=>{const el=$(id);return el?el.value:'';};
  const n=id=>parseFloat(v(id))||0;
  const chk=id=>{const el=$(id);return el?el.checked:false;};
  const ini=n('#session-buyin-initial'), fin=n('#session-buyin-final');

  // === VALIDATION ===
  if(!v('#session-date')){toast('📅 Selecione uma data','error');return;}
  if(!n('#session-time')){toast('⏱️ Informe o tempo jogado','error');return;}
  if(!v('#session-buyin-initial')&&!v('#session-buyin-final')){
    toast('💰 Preencha a banca inicial e final','error');return;
  }

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

  // If editing, preserve the ID
  if(editingSessionId){
    session.id=editingSessionId;
    editingSessionId=null;
  }

  saveSession(session);

  // Success animation on save button
  const saveBtn=$('#save-session-btn');
  if(saveBtn){saveBtn.classList.add('success-pulse');setTimeout(()=>saveBtn.classList.remove('success-pulse'),800);}

  toast('✅ Sessão salva com sucesso!','success');
  e.target.reset();
  const hc=$('#hands-container');if(hc)hc.innerHTML='';
  handCount=0;
  navigate('dashboard');
}

// === Edit Session ===
function editSession(id){
  const s=getSessionById(id);if(!s)return;
  editingSessionId=id;
  closeModal();

  // Navigate to form
  navigate('new-session');

  // Populate form with session data
  setTimeout(()=>{
    const setVal=(sel,val)=>{const el=$(sel);if(el)el.value=val;};
    setVal('#session-date',s.date);
    setVal('#session-limit',s.limit);
    setVal('#session-format',s.format);
    setVal('#session-time',s.time);
    setVal('#session-tables',s.tables);
    setVal('#session-buyin-initial',s.initialBankroll);
    setVal('#session-buyin-final',s.finalBankroll);
    setVal('#session-energy',s.energy);
    setVal('#session-focus',s.focus);
    setVal('#session-mood',s.mood);
    setVal('#session-state-after',s.stateAfter);

    // Update slider labels
    const eV=$('#energy-val');if(eV)eV.textContent=s.energy;
    const fV=$('#focus-val');if(fV)fV.textContent=s.focus;
    const mV=$('#mood-val');if(mV)mV.textContent=s.mood;

    // Tilt
    const tiltCb=$('#session-tilt');
    if(tiltCb){
      tiltCb.checked=s.tilt;
      const g=$('#tilt-type-group');if(g)g.style.display=s.tilt?'block':'none';
      const lbl=$('#tilt-label');if(lbl)lbl.textContent=s.tilt?'Sim':'Não';
      if(s.tilt)setVal('#session-tilt-type',s.tiltType);
    }

    // Discipline
    const disc=s.discipline||{};
    const setChk=(sel,val)=>{const el=$(sel);if(el)el.checked=val;};
    setChk('#disc-gave-limp',disc.gaveLimp);
    setChk('#disc-paid-raise',disc.paidRaise);
    setChk('#disc-respected-position',disc.respectedPosition);
    setChk('#disc-hero-call',disc.heroCall);
    setChk('#disc-stop-loss',disc.stopLoss);

    // Hands
    const hc=$('#hands-container');if(hc)hc.innerHTML='';handCount=0;
    if(s.hands){
      s.hands.forEach(h=>{
        addHandCard();
        const cards=$a('.hand-card');
        const card=cards[cards.length-1];if(!card)return;
        const sv=(cls,val)=>{const el=card.querySelector('.'+cls);if(el)el.value=val||'';};
        sv('h-pos',h.position);sv('h-hand',h.hand);sv('h-preflop',h.preflop);
        sv('h-flop',h.flop);sv('h-turn',h.turn);sv('h-river',h.river);sv('h-doubt',h.doubt);
      });
    }

    // Review
    const rv=s.review||{};
    setVal('#review-best',rv.best);setVal('#review-worst',rv.worst);
    setVal('#review-error',rv.error);setVal('#review-lesson',rv.lesson);setVal('#review-rule',rv.rule);

    // Update result preview
    const rp=$('#result-value');
    if(rp){rp.textContent=formatMoney(s.result);rp.style.color=s.result>=0?'#10b981':'#ef4444';}
    const bi=getBuyInAmount(s.limit);
    const rb=$('#result-buyins');if(rb)rb.textContent=`(${(s.result/bi).toFixed(1)} buy-ins)`;

    // Update save button text
    const saveBtn=$('#save-session-btn');
    if(saveBtn)saveBtn.innerHTML='<span>💾</span> Atualizar Sessão';
  },200);
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

  if(!sessions.length){
    c.innerHTML=`<div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3 class="empty-title">Nenhuma sessão encontrada</h3>
      <p class="empty-text">Registre sessões para acompanhar seu progresso no poker.</p>
      <a href="#" data-page="new-session" class="btn btn-primary btn-sm">+ Registrar Sessão</a>
    </div>`;
    return;
  }
  c.innerHTML='';
  sessions.forEach((s,i)=>{
    const card=document.createElement('div');card.className='session-card';
    card.style.animationDelay=(i*0.04)+'s';
    card.innerHTML=`<span class="session-card-date">${s.date}</span>
<div class="session-card-info"><span class="session-card-limit">${s.limit} — ${s.format||''}</span><span class="session-card-meta">${s.time||0}min · ${s.tables||1} mesa(s)${s.tilt?' · 😤 Tilt':''}</span></div>
<span class="session-card-result ${(s.result||0)>=0?'positive':'negative'}">${formatMoney(s.result||0)}</span>
<button class="session-card-delete" title="Excluir">🗑</button>`;
    card.querySelector('.session-card-delete').onclick=e=>{
      e.stopPropagation();
      if(confirm('Excluir esta sessão?')){
        card.style.animation='listItemOut 0.3s ease forwards';
        setTimeout(()=>{deleteSession(s.id);renderSessionsList();updateBankrollDisplays();toast('Sessão excluída','info');},300);
      }
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
<p><strong>Regra próxima sessão:</strong> ${rv.rule||'—'}</p>
<div class="modal-actions">
  <button class="btn btn-primary btn-sm" id="modal-edit-btn">✏️ Editar Sessão</button>
  <button class="btn btn-danger btn-sm" id="modal-delete-btn">🗑️ Excluir</button>
</div>`;

  mc.innerHTML=html;
  overlay.classList.remove('closing');
  overlay.classList.add('active');

  // Action buttons
  $('#modal-edit-btn')?.addEventListener('click',()=>editSession(id));
  $('#modal-delete-btn')?.addEventListener('click',()=>{
    if(confirm('Excluir esta sessão?')){
      deleteSession(id);closeModal();
      toast('Sessão excluída','info');
      renderDashboard();updateBankrollDisplays();
    }
  });
}

function closeModal(){
  const overlay=$('#modal-overlay');
  if(!overlay||!overlay.classList.contains('active'))return;
  overlay.classList.add('closing');
  overlay.classList.remove('active');
  overlay.addEventListener('animationend',()=>{
    overlay.classList.remove('closing');
  },{once:true});
}

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
  const brValue=$('#bankroll-current-value');
  if(brValue) brValue.style.color=br>=0?'var(--green)':'var(--red)';

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
    if(!txs.length){
      hc.innerHTML=`<div class="empty-state">
        <div class="empty-icon">💳</div>
        <h3 class="empty-title">Nenhuma transação</h3>
        <p class="empty-text">Registre depósitos e saques para controlar seu bankroll.</p>
      </div>`;
    }else{
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

// === Keyboard Shortcuts ===
function setupKeyboardShortcuts(){
  document.addEventListener('keydown',e=>{
    // Don't trigger shortcuts when typing in inputs
    const tag=document.activeElement?.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;

    // Ctrl+S = save session (if on new-session page)
    if(e.ctrlKey&&e.key==='s'){
      e.preventDefault();
      if(document.querySelector('#page-new-session.active')){
        $('#session-form')?.dispatchEvent(new Event('submit',{cancelable:true}));
      }
    }
    // Esc = close modal
    if(e.key==='Escape'){closeModal();}

    // Number keys for navigation
    if(!e.ctrlKey&&!e.altKey&&!e.shiftKey){
      const pageMap={'1':'dashboard','2':'new-session','3':'sessions','4':'weekly','5':'bankroll','6':'settings'};
      if(pageMap[e.key]){e.preventDefault();navigate(pageMap[e.key]);}
    }
  });
}

// === Init ===
document.addEventListener('DOMContentLoaded',()=>{
  // Initialize ripple effect
  initRippleEffect();

  // Navigation
  $a('[data-page]').forEach(l=>l.addEventListener('click',e=>{
    e.preventDefault();navigate(l.dataset.page);
  }));

  // Mobile menu
  const mt=$('#menu-toggle');
  if(mt)mt.onclick=()=>$('#sidebar')?.classList.toggle('open');

  // Close sidebar on overlay click (mobile)
  document.addEventListener('click',e=>{
    const sidebar=$('#sidebar');
    if(sidebar&&sidebar.classList.contains('open')&&!sidebar.contains(e.target)&&!e.target.closest('#menu-toggle')){
      sidebar.classList.remove('open');
    }
  });

  // Session form
  setupFormListeners();

  // Session list filters
  ['#session-search','#session-filter-limit','#session-filter-result'].forEach(sel=>{
    const el=$(sel);if(!el)return;
    el.addEventListener('input',debounce(renderSessionsList,150));
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
    const success = addTransaction({type,amount:amt,note:$('#br-note')?.value||''});
    if(success === false) return; // validation failed in addTransaction
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
      if(importData(ev.target.result)){toast('📤 Dados importados!','success');renderDashboard();updateBankrollDisplays();}
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

  // Keyboard shortcuts
  setupKeyboardShortcuts();

  // Chart setup
  setupChartTooltip();
  setupChartResize();

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
  let totalHands=0,totalSessions=0,skipped=0;
  const existingKeys=getImportedSessionKeys();
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
            // Duplicate detection
            const key=`${session.date}_${session.limit}_${session.result}`;
            if(existingKeys.has(key)){skipped++;return;}
            existingKeys.add(key);
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
    let msg=`🃏 Importado: ${totalHands} mãos em ${totalSessions} sessões!`;
    if(skipped)msg+=` (${skipped} duplicadas ignoradas)`;
    toast(msg,'success');
    renderDashboard();updateBankrollDisplays();
    e.target.value='';
  });
}
})();
