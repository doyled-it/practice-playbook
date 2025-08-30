let DATA = {};
let ROUTES = {};
let currentRoute = '#home';

// Session state (in-memory until saved)
let activeSession = null; // {id, ts, location, routineIndex, routineTitle, notes, simLinks[], simFiles[], steps: []}

// Load routines & init SPA
async function loadData() {
  const res = await fetch('routines.json');
  DATA = await res.json();
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
  const planNotes = document.getElementById('planNotes');
  const simAttach = document.getElementById('simAttach');

  // Populate locations
  Object.keys(DATA).forEach(loc => {
    const opt = document.createElement('option'); opt.value = loc; opt.textContent = loc;
    locSelect.appendChild(opt);
  });
  locSelect.addEventListener('change', updateRoutines);
  function updateRoutines() {
    routineSelect.innerHTML = '';
    const loc = locSelect.value;
    (DATA[loc]||[]).forEach((step, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = step.title;
      routineSelect.appendChild(opt);
    });
    simAttach.classList.toggle('hidden', loc !== 'Simulator');
  }
  locSelect.value = 'Simulator'; updateRoutines();

  // Attachments
  const linksInput = document.getElementById('simLinks');
  const filesInput = document.getElementById('simFiles');

  document.getElementById('startSessionBtn').addEventListener('click', async () => {
    const loc = locSelect.value;
    const routineIdx = parseInt(routineSelect.value || '0', 10);
    const routineTitle = (DATA[loc]||[])[routineIdx]?.title || 'Routine';

    // Read files as data URLs
    const filePromises = [];
    if (loc === 'Simulator' && filesInput.files?.length) {
      for (const f of filesInput.files) {
        filePromises.push(new Promise((resolve,reject)=>{
          const reader = new FileReader();
          reader.onload = () => resolve({name: f.name, type: f.type, dataUrl: reader.result});
          reader.onerror = reject;
          reader.readAsDataURL(f);
        }));
      }
    }
    const simFiles = (loc === 'Simulator') ? await Promise.all(filePromises) : [];
    const simLinks = (loc === 'Simulator') ? (linksInput.value || '').split(',').map(s => s.trim()).filter(Boolean) : [];

    activeSession = {
      id: 'sess_' + new Date().toISOString(),
      ts: new Date().toISOString(),
      location: loc,
      routineIndex: routineIdx,
      routineTitle,
      notes: planNotes.value || '',
      simLinks, simFiles,
      steps: [] // {title, entries:{}, ts}
    };

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

// ---------- Practice Flow ----------
let stepIndex = 0;

function renderPractice() {
  if (!activeSession) { alert('Start a session from Home'); navigate('#home'); return; }
  stepIndex = 0;

  const practiceMeta = document.getElementById('practiceMeta');
  practiceMeta.textContent = `${activeSession.location} • ${activeSession.routineTitle}`;

  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  const carousel = document.getElementById('carousel');
  carousel.innerHTML = '';

  const steps = DATA[activeSession.location] || [];
  steps.forEach((step, i) => {
    const b = document.createElement('button'); b.className = 'tab'; b.textContent = step.title;
    b.addEventListener('click', () => scrollToIndex(i));
    tabs.appendChild(b);
    carousel.appendChild(createCard(step, i, activeSession.location !== 'Simulator'));
  });
  updateIndicator();
  requestAnimationFrame(() => {
    carousel.children[0]?.scrollIntoView({behavior:'instant', inline:'center', block:'nearest'});
  });

  // Buttons
  document.getElementById('prevBtn').addEventListener('click', prev);
  document.getElementById('nextBtn').addEventListener('click', next);
  document.getElementById('saveBtn').addEventListener('click', saveStepLog);
  document.getElementById('endBtn').addEventListener('click', endSession);

  // Scroll handler to keep stepIndex in sync
  let rafId = null;
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

  card.innerHTML = `
    <div class="headerline">
      <div class="kicker">${activeSession.location}</div>
      <div class="kicker">${index+1}/${(DATA[activeSession.location]||[]).length}</div>
    </div>
    <h2>${step.title}</h2>
    <div class="content">
      <div class="section tip"><h3>Quick Tips</h3><ul>${quicks.join('') || '<li>Focus on the key feel.</li>'}</ul></div>
      <ul>${itemsHtml}</ul>
      <div class="section insight"><h3>Pro Insights</h3><ul>${insights.join('') || '<li>Contact, start line, commitment.</li>'}</ul></div>
      ${simSettings.length ? `<div class="section sim"><h3>Simulator Settings</h3><ul>${simSettings.join('')}</ul></div>` : ''}
      ${lookFor.length ? `<div class="section sim"><h3>What to Track</h3><ul>${lookFor.join('')}</ul></div>` : ''}
      ${formHtml}
    </div>
  `;
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
  const steps = DATA[activeSession.location] || [];
  document.getElementById('stepIndicator').textContent = `${stepIndex + 1}/${steps.length}`;
}

function next() { const steps = DATA[activeSession.location] || []; if (stepIndex < steps.length - 1) { stepIndex++; scrollToIndex(stepIndex); } }
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
  const steps = DATA[activeSession.location] || [];
  const step = steps[stepIndex];
  const visibleCard = document.getElementById('carousel').children[stepIndex];
  const entries = {};
  visibleCard.querySelectorAll('.log-input').forEach(el => {
    const id = el.id || Math.random().toString(36).slice(2);
    entries[id] = (el.type === 'checkbox') ? el.checked : el.value;
  });
  activeSession.steps.push({ title: step.title, entries, ts: new Date().toISOString() });
  alert('Step saved');
}

// End session -> persist to IndexedDB
async function endSession() {
  await storageAPI.saveSession(activeSession);
  // Legacy logs for trends: flatten each step entry into 'logs'
  for (const st of (activeSession.steps || [])) {
    await storageAPI.saveLegacyLog({ id: activeSession.id, ts: st.ts, category: activeSession.location, stepTitle: st.title, entries: st.entries });
  }
  alert('Session saved');
  activeSession = null;
  navigate('#history');
}

// ---------- History ----------
async function renderHistory() {
  const list = document.getElementById('historyList');
  const filterLoc = document.getElementById('filterLoc');
  const filterText = document.getElementById('filterText');

  // Filters
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

  // Collect numeric field ids across logs
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

    // axes
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();

    // line
    ctx.strokeStyle = '#7b61ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p,i)=>{ const x=xScale(p.t.getTime()), y=yScale(p.v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();

    // points
    ctx.fillStyle = '#36c2b3';
    points.forEach(p=>{ const x=xScale(p.t.getTime()), y=yScale(p.v); ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });
  }

  metricSelect.addEventListener('change', draw);
  metricLoc.addEventListener('change', draw);
  draw();
}

document.addEventListener('DOMContentLoaded', loadData);
