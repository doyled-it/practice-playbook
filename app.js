let DATA = {};
let currentCategory = null;
let stepIndex = 0;
let sessionId = null;

async function loadData() {
  const res = await fetch('routines.json');
  DATA = await res.json();
  const categories = Object.keys(DATA);
  buildTabs(categories);
  setCategory(categories.includes('Simulator') ? 'Simulator' : categories[0]);
}

function buildTabs(categories) {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  categories.forEach(cat => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.textContent = cat;
    b.addEventListener('click', () => setCategory(cat));
    tabs.appendChild(b);
  });
}

function setCategory(cat) {
  currentCategory = cat;
  stepIndex = 0;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.textContent === cat));
  render();
}

function render() {
  const carousel = document.getElementById('carousel');
  carousel.innerHTML = '';
  const steps = DATA[currentCategory] || [];
  steps.forEach((step, i) => carousel.appendChild(createCard(step, i)));
  updateIndicator();
  requestAnimationFrame(() => {
    const current = carousel.children[stepIndex];
    current?.scrollIntoView({behavior:'instant', inline:'center', block:'nearest'});
  });
}

function createCard(step, index) {
  const allowLogging = currentCategory !== 'Simulator';
  const card = document.createElement('section');
  card.className = 'card';
  card.setAttribute('role','group');
  card.setAttribute('aria-label', step.title);

  const itemsHtml = step.items.map(renderItem).join('');
  let formHtml = '';
  if (allowLogging) {
    const schemas = step.items.flatMap(it => (it.logSchema || []).map(s => ({...s, scope: it.label || step.title})));
    if (schemas.length) formHtml = renderForm(schemas, index);
  }

  // Quick Tip / Pro Insight blocks (merged across items in step)
  const quicks = [];
  const insights = [];
  step.items.forEach(it => {
    if (it.quickTip) quicks.push(`<li>${it.quickTip}</li>`);
    if (it.insight)  insights.push(`<li>${it.insight}</li>`);
  });

  card.innerHTML = `
    <div class="headerline">
      <div class="kicker">${currentCategory}</div>
      <div class="kicker">${index+1}/${(DATA[currentCategory]||[]).length}</div>
    </div>
    <h2>${step.title}</h2>
    <div class="content">
      <div class="section tip"><h3>Quick Tips</h3><ul>${quicks.join('') || '<li>Focus on the key feel.</li>'}</ul></div>
      <ul>${itemsHtml}</ul>
      <div class="section insight"><h3>Pro Insights</h3><ul>${insights.join('') || '<li>Focus on start line, contact, and commitment.</li>'}</ul></div>
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
    const id = `f_${idx}_${s.id}`; // ensure unique per slide
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
  const steps = DATA[currentCategory] || [];
  document.getElementById('stepIndicator').textContent = `${stepIndex + 1}/${steps.length}`;
}

function next() {
  const steps = DATA[currentCategory] || [];
  if (stepIndex < steps.length - 1) {
    stepIndex++;
    scrollToIndex(stepIndex);
  }
}
function prev() {
  if (stepIndex > 0) {
    stepIndex--;
    scrollToIndex(stepIndex);
  }
}
function scrollToIndex(i) {
  const carousel = document.getElementById('carousel');
  const el = carousel.children[i];
  if (!el) return;
  el.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
  updateIndicator();
}

document.getElementById('prevBtn').addEventListener('click', prev);
document.getElementById('nextBtn').addEventListener('click', next);

// Scroll position -> stepIndex (smooth indicator)
const carousel = document.getElementById('carousel');
let rafId = null;
function onScroll() {
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
  });
}
carousel.addEventListener('scroll', onScroll, {passive: true});

// Theme toggle
document.getElementById('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
});
(function initTheme(){
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.body.classList.add('light');
})();

// Session logging (Range/Short Game/Bunker/Putting only)
function startSession() {
  sessionId = 'sess_' + new Date().toISOString();
  alert('Session started');
}
function saveStep() {
  if (!sessionId) { alert('Start a session first'); return; }
  if (currentCategory === 'Simulator') { alert('Logging disabled in Simulator'); return; }

  const steps = DATA[currentCategory] || [];
  const step = steps[stepIndex];
  const visibleCard = document.getElementById('carousel').children[stepIndex];
  const entries = {};
  visibleCard.querySelectorAll('.log-input').forEach(el => {
    const id = el.id || Math.random().toString(36).slice(2);
    entries[id] = (el.type === 'checkbox') ? el.checked : el.value;
  });
  const payload = { id: sessionId, ts: new Date().toISOString(), category: currentCategory, stepTitle: step.title, entries };
  const existing = JSON.parse(localStorage.getItem('pp_sessions')||'[]');
  existing.push(payload);
  localStorage.setItem('pp_sessions', JSON.stringify(existing));
  alert('Saved');
}
function exportLog() {
  const data = JSON.parse(localStorage.getItem('pp_sessions')||'[]');
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'practice_sessions.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}

document.getElementById('startBtn').addEventListener('click', startSession);
document.getElementById('saveBtn').addEventListener('click', saveStep);
document.getElementById('exportBtn').addEventListener('click', exportLog);

// Initial load
loadData();
