let DATA = {};
let PROGRAMS = {};
let ROUTES = {};
let currentRoute = '#home';

// Session state
let activeSession = null; // {id, ts, location, programId, programName, durationMin, routineTitle, notes, steps:[], simLinks, simFiles}
let assembledSteps = [];   // Steps for this session (from programs)
let stepIndex = 0;

// Snap assist: when touch scrolling ends, force snap to nearest slide
let snapTimer = null;
function snapToNearest() {
  const carousel = document.getElementById('carousel');
  if (!carousel) return;
  const children = Array.from(carousel.children);
  const mid = carousel.scrollLeft + carousel.clientWidth/2;
  let closest = 0, min = Infinity;
  children.forEach((el, idx) => {
    const center = el.offsetLeft + el.offsetWidth/2;
    const d = Math.abs(center - mid);
    if (d < min) { min = d; closest = idx; }
  });
  const el = carousel.children[closest];
  if (el) el.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
}


// Timer
let timerMs = 0;
let timerEnd = null;
let timerRunning = false;
let timerTickHandle = null;

async function loadData() {
  const res = await fetch('routines.json');
  DATA = await res.json();
  const pRes = await fetch('programs.json');
  PROGRAMS = await pRes.json();
  initRouter();
  navigate('#home');
}

function initRouter() {
  ROUTES['#home'] = renderHome;
  ROUTES['#practice'] = renderPractice;
  ROUTES['#history'] = renderHistory;
  ROUTES['#trends'] = renderTrends;

  document.querySelectorAll('.navlink').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });

  document.getElementById('themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  });
  const saved = localStorage.getItem('theme'); if (saved === 'light') document.body.classList.add('light');
}

function navigate(route) {
  currentRoute = route;
  document.querySelectorAll('.navlink').forEach(b => b.classList.toggle('active', b.dataset.route === route));
  const view = document.getElementById('view');
  view.innerHTML = '';

  const tmpl = document.getElementById(route.substring(1)+'Tmpl');
  if (!tmpl) return;
  const node = tmpl.content.cloneNode(true);
  view.appendChild(node);
  ROUTES[route]?.();
}

// ---------- Home / Planner ----------
function renderHome() {
  const locSelect = document.getElementById('locSelect');
  const routineSelect = document.getElementById('routineSelect');
  const durationInput = document.getElementById('durationInput');
  const planNotes = document.getElementById('planNotes');

  // Locations
  Object.keys(DATA).filter(loc => loc !== 'Pro Templates').forEach(loc => {
    const opt = document.createElement('option'); opt.value = loc; opt.textContent = loc;
    locSelect.appendChild(opt);
  });
  locSelect.addEventListener('change', updatePrograms);

  function updatePrograms() {
    routineSelect.innerHTML = '';
    const loc = locSelect.value;
    const progs = PROGRAMS[loc] || [];
    progs.forEach(p => {
      const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; opt.dataset.default = p.defaultMinutes;
      routineSelect.appendChild(opt);
    });
    if (progs[0]) durationInput.value = progs[0].defaultMinutes || 60;
  }

  // default to Simulator
  locSelect.value = 'Simulator';
  updatePrograms();
  routineSelect.addEventListener('change', () => {
    const sel = routineSelect.selectedOptions[0];
    if (sel?.dataset?.default) durationInput.value = sel.dataset.default;
  });

  const timerModeSel = document.getElementById('timerMode');
  document.getElementById('startSessionBtn').addEventListener('click', async () => {
    const loc = locSelect.value;
    const progId = routineSelect.value;
    const progs = PROGRAMS[loc] || [];
    const prog = progs.find(p => p.id === progId) || progs[0];
    const allSteps = DATA[loc] || [];
    assembledSteps = (prog.steps || []).map(idx => allSteps[idx]).filter(Boolean);

    activeSession = {
      id: 'sess_' + new Date().toISOString(),
      ts: new Date().toISOString(),
      location: loc,
      programId: prog.id,
      programName: prog.name,
      durationMin: parseInt(durationInput.value || prog.defaultMinutes || 60, 10),
      routineTitle: prog.name,
      notes: planNotes.value || '',
      timerMode: (timerModeSel?.value || (loc === 'Range' ? 'up' : 'down')),
      simLinks: [], simFiles: [],
      steps: []
    };

    // Timer init
    if ((activeSession.timerMode||'down') === 'down') startTimerDown(activeSession.durationMin); else startTimerUp();

    navigate('#practice');
  });

  // Export / Import using IndexedDB
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const exportObj = await storageAPI.importExport(null, 'export');
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'practice_playbook_export.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  });
  document.getElementById('importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      await storageAPI.importExport(obj, 'import');
      alert('Import complete');
    } catch { alert('Invalid JSON'); }
  });
}

// ---------- Timer ----------
function startTimerDown(mins) {
  timerMs = mins * 60 * 1000;
  timerEnd = Date.now() + timerMs;
  timerRunning = true;
  tickTimerDown();
}
function tickTimerDown() {
  if (!timerRunning) return;
  const remain = Math.max(0, timerEnd - Date.now());
  const m = Math.floor(remain/60000);
  const s = Math.floor((remain%60000)/1000);
  const display = (m<10?'0':'')+m+':' + (s<10?'0':'')+s;
  const el = document.getElementById('timerDisplay');
  if (el) el.textContent = display;
  if (remain === 0) {
    timerRunning = false;
    if (navigator.vibrate) navigator.vibrate([100,100,100]);
  } else {
    timerTickHandle = setTimeout(tickTimerDown, 500);
  }
}
function startTimerUp(){ timerMs = 0; timerRunning = true; tickTimerUp(); }
function tickTimerUp(){
  if (!timerRunning) return;
  timerMs += 500;
  const m = Math.floor(timerMs/60000);
  const s = Math.floor((timerMs%60000)/1000);
  const display = (m<10?'0':'')+m+':' + (s<10?'0':'')+s;
  const el = document.getElementById('timerDisplay');
  if (el) el.textContent = display;
  timerTickHandle = setTimeout(tickTimerUp, 500);
}

// ---------- Practice Flow ----------
function renderPractice() {
  if (!activeSession) { alert('Start a session from Home'); navigate('#home'); return; }
  stepIndex = 0;

  const practiceMeta = document.getElementById('practiceMeta');
  practiceMeta.textContent = `${activeSession.location} • ${activeSession.routineTitle}`;

  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  const carousel = document.getElementById('carousel');
  carousel.innerHTML = '';

  assembledSteps.forEach((step, i) => {
    const b = document.createElement('button'); b.className = 'tab'; b.textContent = step.title;
    b.addEventListener('click', () => scrollToIndex(i));
    tabs.appendChild(b);
    carousel.appendChild(createCard(step, i, activeSession.location !== 'Simulator'));
  });
  updateIndicator();
  requestAnimationFrame(() => {
    carousel.children[0]?.scrollIntoView({behavior:'instant', inline:'center', block:'nearest'});
  });
  document.querySelectorAll('.tab')[0]?.classList.add('active');

  // Buttons
  document.getElementById('prevBtn').addEventListener('click', prev);
  document.getElementById('nextBtn').addEventListener('click', next);
  document.getElementById('saveBtn').addEventListener('click', saveStepLog);
  document.getElementById('endBtn').addEventListener('click', openSaveDialog);
  document.getElementById('openRandomizer').addEventListener('click', openRandomizerModal);

  // Timer controls (mode-aware)
  document.getElementById('timerToggle').addEventListener('click', () => {
    timerRunning = !timerRunning;
    if (timerRunning) {
      if ((activeSession.timerMode||'down') === 'down') { timerEnd = Date.now() + (timerEnd - Date.now()); tickTimerDown(); }
      else { tickTimerUp(); }
    }
    document.getElementById('timerToggle').textContent = timerRunning ? 'Pause' : 'Resume';
  });
  document.getElementById('timerAdd').addEventListener('click', () => {
    if ((activeSession.timerMode||'down') === 'down') { timerEnd += 60*1000; }
    else { timerMs += 60*1000; }
    if (!timerRunning) { timerRunning = true; ((activeSession.timerMode||'down') === 'down' ? tickTimerDown() : tickTimerUp()); document.getElementById('timerToggle').textContent = 'Pause'; }
  });

  // Scroll handler
  let rafId = null;
  let isTouching = false;
  carousel.addEventListener('touchstart', ()=>{ isTouching = true; });
  carousel.addEventListener('touchend', ()=>{ isTouching = false; clearTimeout(snapTimer); snapTimer = setTimeout(snapToNearest, 80); });
  carousel.addEventListener('pointerdown', ()=>{ isTouching = true; });
  carousel.addEventListener('pointerup', ()=>{ isTouching = false; clearTimeout(snapTimer); snapTimer = setTimeout(snapToNearest, 80); });
  carousel.addEventListener('scroll', () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const children = Array.from(carousel.children);
      const mid = carousel.scrollLeft + carousel.clientWidth/2;
      let closest = 0, min = Infinity;
      children.forEach((el, idx) => {
        const center = el.offsetLeft + el.offsetWidth/2;
        const d = Math.abs(center - mid);
        if (d < min) { min = d; closest = idx; }
      });
      stepIndex = closest;
      updateIndicator();
      document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active', i===stepIndex));
    });
  }, {passive:true});
}

function createCard(step, index, allowLogging) {
  const card = document.createElement('section');
  card.className = 'card';

  const itemsHtml = step.items.map(renderItem).join('');
  const quicks = [], insights = [], simSettings = [], lookFor = [];
  step.items.forEach(it => {
    if (it.quickTip) quicks.push(`<li>${it.quickTip}</li>`);
    if (it.insight)  insights.push(`<li>${it.insight}</li>`);
    if (it.simSettings) it.simSettings.forEach(s => simSettings.push(`<li>${s}</li>`));
    if (it.lookFor)    it.lookFor.forEach(s => lookFor.push(`<li>${s}</li>`));
  });

  let formHtml = '';
  if (allowLogging) {
    const schemas = step.items.flatMap(it => (it.logSchema || []).map(s => ({...s, scope: it.label || step.title})));
    if (schemas.length) formHtml = renderForm(schemas, index);
  }

  const randBlock = (step.title||'').toLowerCase().includes('random') ? `<div class="section"><h3>Randomizer (quick)</h3><div class="actions-row"><button class="pill" data-rand="gen">Generate</button><button class="pill ghost" data-rand="copy">Copy</button></div><pre class="kicker" id="randInline_${index}" style="white-space: pre-wrap;"></pre></div>` : '';
  card.innerHTML = `
    <div class="headerline">
      <div class="kicker">${activeSession.location}</div>
      <div class="kicker">${index+1}/${assembledSteps.length}</div>
    </div>
    <h2>${step.title}</h2>
    <div class="content">
      <div class="section tip"><h3>Quick Tips</h3><ul>${quicks.join('') || '<li>Focus on the key feel.</li>'}</ul></div>
      <ul>${itemsHtml}</ul>
      ${randBlock}
      <div class="section insight"><h3>Pro Insights</h3><ul>${insights.join('') || '<li>Contact, start line, commitment.</li>'}</ul></div>
      ${simSettings.length ? `<div class="section sim"><h3>Simulator Settings</h3><ul>${simSettings.join('')}</ul></div>` : ''}
      ${lookFor.length ? `<div class="section sim"><h3>What to Track</h3><ul>${lookFor.join('')}</ul></div>` : ''}
      ${formHtml}
    </div>
  `;
  if ((step.title||'').toLowerCase().includes('random')) {
    const pre = card.querySelector(`#randInline_${index}`);
    const genBtn = card.querySelector('[data-rand="gen"]');
    const copyBtn = card.querySelector('[data-rand="copy"]');
    const arr = generateRealisticDistances(12, 85, 195, 'balanced');
    pre.textContent = arr.join(', ');
    genBtn.addEventListener('click', ()=>{ const a = generateRealisticDistances(12, 85, 195, 'balanced'); pre.textContent = a.join(', '); });
    copyBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(pre.textContent||''); });
  }
  return card;
}

function renderItem(item) {
  if (typeof item === 'string') return `<li>${item}</li>`;
  let html = `<li>${item.label || ''}`;
  const badges = [];
  if (item.perClub) item.perClub.forEach(pc => badges.push(`<span class="badge">${pc.club} × ${pc.balls}</span>`));
  if (item.balls) badges.push(`<span class="badge">${item.balls} balls</span>`);
  if (badges.length) html += `<div class="badges">${badges.join(' ')}</div>`;
  html += `</li>`;
  return html;
}

function renderForm(schemas, idx) {
  const rows = [];
  for (const s of schemas) {
    let input = '';
    const id = `f_${idx}_${s.id}`;
    if (s.type === 'number') input = `<input class="log-input" type="number" id="${id}" placeholder="${s.label}">`;
    else if (s.type === 'text') input = `<textarea class="log-input" id="${id}" placeholder="${s.label}"></textarea>`;
    else if (s.type === 'select') input = `<select class="log-input" id="${id}">${(s.options||[]).map(o => `<option>${o}</option>`).join('')}</select>`;
    else if (s.type === 'checkbox') input = `<input class="log-input" type="checkbox" id="${id}">`;
    else input = `<input class="log-input" type="text" id="${id}" placeholder="${s.label}">`;
    rows.push(`<div><label for="${id}">${s.label}</label>${input}</div>`);
  }
  const chunks = [];
  for (let i = 0; i < rows.length; i += 2) {
    chunks.push(`<div class="input-row">${rows[i]}${rows[i+1]||'<div></div>'}</div>`);
  }
  return `<div class="inputs">${chunks.join('')}</div>`;
}

function updateIndicator() {
  document.getElementById('stepIndicator').textContent = `${stepIndex + 1}/${assembledSteps.length}`;
}

function next() { if (stepIndex < assembledSteps.length - 1) { stepIndex++; scrollToIndex(stepIndex); } }
function prev() { if (stepIndex > 0) { stepIndex--; scrollToIndex(stepIndex); } }
function scrollToIndex(i) {
  const carousel = document.getElementById('carousel');
  const el = carousel.children[i]; if (!el) return;
  el.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
  updateIndicator();
}

// Save logs for current step (non-Simulator)
function saveStepLog() {
  if (activeSession.location === 'Simulator') { alert('Logging disabled in Simulator'); return; }
  const step = assembledSteps[stepIndex];
  const visibleCard = document.getElementById('carousel').children[stepIndex];
  const entries = {};
  visibleCard.querySelectorAll('.log-input').forEach(el => {
    const id = el.id || Math.random().toString(36).slice(2);
    entries[id] = (el.type === 'checkbox') ? el.checked : el.value;
  });
  activeSession.steps.push({ title: step.title, entries, ts: new Date().toISOString() });
  alert('Step saved');
}

// Save Session flow with post-practice simulator attachments
function openSaveDialog() {
  const dlg = document.getElementById('saveDialog');
  const simSection = document.getElementById('simAttach');
  simSection.classList.toggle('hidden', activeSession.location !== 'Simulator');
  dlg.classList.remove('hidden');

  document.getElementById('cancelSave').onclick = () => dlg.classList.add('hidden');
  document.getElementById('confirmSave').onclick = confirmSave;
}

async function confirmSave() {
  const dlg = document.getElementById('saveDialog');
  if (activeSession.location === 'Simulator') {
    const linksInput = document.getElementById('simLinks');
    const filesInput = document.getElementById('simFiles');
    activeSession.simLinks = (linksInput.value || '').split(',').map(s => s.trim()).filter(Boolean);

    const filePromises = [];
    if (filesInput.files?.length) {
      for (const f of filesInput.files) {
        filePromises.push(new Promise((resolve,reject)=>{
          const reader = new FileReader();
          reader.onload = () => resolve({name: f.name, type: f.type, dataUrl: reader.result});
          reader.onerror = reject;
          reader.readAsDataURL(f);
        }));
      }
    }
    activeSession.simFiles = await Promise.all(filePromises);
  }

  await storageAPI.saveSession(activeSession);
  for (const st of (activeSession.steps || [])) {
    await storageAPI.saveLegacyLog({ id: activeSession.id, ts: st.ts, category: activeSession.location, stepTitle: st.title, entries: st.entries });
  }
  dlg.classList.add('hidden');
  alert('Session saved');
  activeSession = null;
  navigate('#history');
}

// ---------- History ----------
async function renderHistory() {
  const list = document.getElementById('historyList');
  const filterLoc = document.getElementById('filterLoc');
  const filterText = document.getElementById('filterText');

  Object.keys(DATA).forEach(loc => {
    const opt = document.createElement('option'); opt.value = loc; opt.textContent = loc; filterLoc.appendChild(opt);
  });

  async function refresh() {
    const sessions = (await storageAPI.listSessions()).slice().reverse();
    const locVal = filterLoc.value; const textVal = (filterText.value||'').toLowerCase();
    list.innerHTML = '';
    sessions.filter(s => (!locVal || s.location === locVal) &&
                         (!textVal || s.routineTitle.toLowerCase().includes(textVal) || (s.notes||'').toLowerCase().includes(textVal)))
            .forEach(s => list.appendChild(renderSessionCard(s)));
  }
  filterLoc.addEventListener('change', refresh);
  filterText.addEventListener('input', refresh);
  refresh();
}

function renderSessionCard(s) {
  const card = document.createElement('div'); card.className = 'card session';
  const date = new Date(s.ts).toLocaleString();
  const attachments = [];
  if (s.simLinks?.length) attachments.push(`<span class="badge">${s.simLinks.length} link(s)</span>`);
  if (s.simFiles?.length) attachments.push(`<span class="badge">${s.simFiles.length} file(s)</span>`);

  const metrics = [];
  (s.steps||[]).forEach(st => {
    const nums = Object.entries(st.entries||{}).filter(([k,v]) => !isNaN(parseFloat(v)));
    if (nums.length) metrics.push(`${st.title}: ${nums.map(([k,v])=>`${k.split('_').slice(2).join('_')||k}:${v}`).join(', ')}`);
  });

  card.innerHTML = `
    <div class="badge-row">
      <span class="badge">${s.location}</span>
      <span class="badge">${s.routineTitle}</span>
      ${attachments.join(' ')}
    </div>
    <div><strong>${date}</strong></div>
    ${s.notes ? `<div class="kicker">${s.notes}</div>` : ''}
    ${metrics.length ? `<div class="section"><h3>Logged</h3><div class="kicker">${metrics.join(' • ')}</div></div>` : ''}
    ${(s.simLinks?.length||0) ? `<div class="section sim"><h3>Links</h3><ul>${s.simLinks.map(u=>`<li><a href="${u}" target="_blank" rel="noopener">${u}</a></li>`).join('')}</ul></div>`:''}
    ${(s.simFiles?.length||0) ? `<div class="section sim"><h3>Files</h3><div>${s.simFiles.map((f,i)=>`<a download="${f.name}" href="${f.dataUrl}" class="badge">${f.name}</a>`).join(' ')}</div></div>`:''}
  `;
  return card;
}

// ---------- Trends ----------
async function renderTrends() {
  const sessions = await storageAPI.listSessions();
  const logs = await storageAPI.listLogs();
  const metricSelect = document.getElementById('metricSelect');
  const metricLoc = document.getElementById('metricLoc');
  const canvas = document.getElementById('trendChart');
  const ctx = canvas.getContext('2d');
  const note = document.getElementById('trendNote');

  const metricSet = new Set();
  logs.forEach(l => {
    Object.entries(l.entries||{}).forEach(([k,v]) => { if (!isNaN(parseFloat(v))) metricSet.add(k); });
  });
  Array.from(metricSet).sort().forEach(id => {
    const opt = document.createElement('option'); opt.value = id; opt.textContent = id; metricSelect.appendChild(opt);
  });
  Object.keys(DATA).forEach(loc => {
    const opt = document.createElement('option'); opt.value = loc; opt.textContent = loc; metricLoc.appendChild(opt);
  });

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const id = metricSelect.value; if (!id) { note.textContent = 'Select a metric to see progress.'; return; }
    const loc = metricLoc.value;

    const points = [];
    logs.forEach(l => {
      if (loc && l.category !== loc) return;
      const v = parseFloat(l.entries?.[id]);
      if (!isNaN(v)) points.push({t: new Date(l.ts), v});
    });
    points.sort((a,b)=>a.t-b.t);
    if (!points.length) { note.textContent = 'No data for that metric yet.'; return; }
    note.textContent = `${id} — ${points.length} points`;

    const pad = 30, w = canvas.width, h = canvas.height;
    const xs = points.map(p=>p.t.getTime());
    const ys = points.map(p=>p.v);
    const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xScale = (x)=> pad + (w-2*pad)*( (x - xMin) / Math.max(1,(xMax - xMin)) );
    const yScale = (y)=> h - pad - (h-2*pad)*( (y - yMin) / Math.max(1,(yMax - yMin)) );

    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();

    ctx.strokeStyle = '#7b61ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p,i)=>{ const x=xScale(p.t.getTime()), y=yScale(p.v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();

    ctx.fillStyle = '#36c2b3';
    points.forEach(p=>{ const x=xScale(p.t.getTime()), y=yScale(p.v); ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });
  }

  metricSelect.addEventListener('change', draw);
  metricLoc.addEventListener('change', draw);
  draw();
}


// ---------- Randomizer ----------
function openRandomizerModal() {
  const tmpl = document.getElementById('randomizerTmpl');
  const node = tmpl.content.cloneNode(true);
  const view = document.getElementById('view');
  // Simple overlay like other dialogs
  const wrap = document.createElement('div'); wrap.className = 'dialog'; wrap.appendChild(node);
  document.body.appendChild(wrap);
  const out = wrap.querySelector('#randOut');
  function generate() {
    const count = parseInt(wrap.querySelector('#randCount').value || '12', 10);
    const min = parseInt(wrap.querySelector('#randMin').value || '85', 10);
    const max = parseInt(wrap.querySelector('#randMax').value || '195', 10);
    const profile = wrap.querySelector('#randProfile').value || 'balanced';
    const arr = generateRealisticDistances(count, min, max, profile);
    out.textContent = arr.join(', ');
  }
  wrap.querySelector('#randGen').addEventListener('click', generate);
  wrap.querySelector('#randCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(out.textContent || '');
  });
  wrap.addEventListener('click', (e)=>{ if(e.target===wrap) document.body.removeChild(wrap); });
  generate();
}

function generateRealisticDistances(count, min, max, profile='balanced') {
  const res = [];
  for (let i=0;i<count;i++) {
    let x = Math.random();
    // bias curves via piecewise
    let val = 0;
    if (profile === 'approach') {
      // Heavier in 120–170 (bell around 145)
      const mu = 0.6, sigma = 0.18; // map to 0..1 then scale
      const g = clamp(randn_bm(mu, sigma), 0, 1);
      val = mapRange(g, 0,1, Math.max(min, 110), Math.min(max, 185));
    } else if (profile === 'wedges') {
      const mu = 0.3, sigma = 0.18;
      const g = clamp(randn_bm(mu, sigma), 0, 1);
      val = mapRange(g, 0,1, Math.max(min, 70), Math.min(max, 125));
    } else { // balanced
      const g = Math.random();
      val = mapRange(g, 0,1, min, max);
    }
    // Round to realistic yardages: nearest 5
    const rounded = Math.round(val/5)*5;
    res.push(rounded);
  }
  return res;
}
function mapRange(v, a,b, c,d){ return c + (v-a)*(d-c)/(b-a || 1); }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
// Gaussian-ish
function randn_bm(mu=0.5, sigma=0.15){
  let u=0, v=0;
  while(u===0) u = Math.random();
  while(v===0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const z = mu + sigma * num;
  return z;
}


document.addEventListener('DOMContentLoaded', loadData);
