let DATA = {};
let currentCategory = null;
let stepIndex = 0;
let trackmanMode = false;

let sessionId = null;
let sessionLog = []; // array of {id, ts, category, stepTitle, entries: {...}, tm: bool}

async function loadData() {
  const res = await fetch('routines.json');
  DATA = await res.json();
  const categories = Object.keys(DATA);
  buildTabs(categories);
  setCategory(categories[0]);
}

function buildTabs(categories) {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  categories.forEach(cat => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.textContent = cat;
    b.onclick = () => setCategory(cat);
    tabs.appendChild(b);
  });
}

function setCategory(cat) {
  currentCategory = cat;
  stepIndex = 0;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.textContent === cat);
  });
  render();
}

function render() {
  const wrap = document.getElementById('cardWrap');
  wrap.innerHTML = '';
  const steps = DATA[currentCategory] || [];
  const step = steps[stepIndex];
  const card = createCard(step);
  wrap.appendChild(card);
  updateIndicator();
  bindSwipe(card); // ensure swipe works every time
}

function createCard(step) {
  const card = document.createElement('div');
  card.className = 'card';

  // Build items list
  const itemsHtml = step.items.map(renderItem).join('');

  // Build form inputs for logging (from all items' logSchema merged)
  const schemas = step.items.flatMap(it => (it.logSchema || []).map(s => ({...s, scope: it.label || step.title})));
  const formHtml = schemas.length ? renderForm(schemas) : '';

  // TrackMan tips (if toggle on)
  const tmTips = trackmanMode
      ? step.items.flatMap(it => it.trackman || [])
      : [];

  card.innerHTML = `
    <div class="kicker">${currentCategory}</div>
    <h2>${step.title}</h2>
    <ul>${itemsHtml}</ul>
    ${tmTips.length ? `<div class="kicker">TrackMan Tips</div><ul>${tmTips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    ${formHtml}
  `;

  // Attach save handler to capture form values
  card.querySelectorAll('.log-input').forEach(el => {
    el.addEventListener('change', () => {/* noop; captured on Save */});
  });

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

function renderForm(schemas) {
  // Render as grouped inputs; 2 columns when possible
  const rows = [];
  for (const s of schemas) {
    let input = '';
    const id = `f_${s.id}`;
    if (s.type === 'number') input = `<input class="log-input" type="number" id="${id}" placeholder="${s.label}">`;
    else if (s.type === 'text') input = `<textarea class="log-input" id="${id}" placeholder="${s.label}"></textarea>`;
    else if (s.type === 'select') input = `<select class="log-input" id="${id}">${s.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
    else if (s.type === 'checkbox') input = `<input class="log-input" type="checkbox" id="${id}">`;
    else input = `<input class="log-input" type="text" id="${id}" placeholder="${s.label}">`;
    rows.push(`<div><label for="${id}">${s.label}</label>${input}</div>`);
  }
  const chunks = [];
  for (let i = 0; i < rows.length; i += 2) {
    chunks.push(`<div class="input-row">${rows[i]}${rows[i+1] || '<div></div>'}</div>`);
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
    slide(1);
  }
}
function prev() {
  if (stepIndex > 0) {
    stepIndex--;
    slide(-1);
  }
}

function slide(dir) {
  const wrap = document.getElementById('cardWrap');
  const oldCard = wrap.querySelector('.card');
  const steps = DATA[currentCategory];
  const step = steps[stepIndex];
  const newCard = createCard(step);
  newCard.style.transform = `translateX(${dir * 100}%)`;
  wrap.appendChild(newCard);

  requestAnimationFrame(() => {
    // animate
    oldCard.style.transition = 'transform .25s ease';
    newCard.style.transition = 'transform .25s ease';
    oldCard.style.transform = `translateX(${-dir * 100}%)`;
    newCard.style.transform = 'translateX(0)';
    setTimeout(() => {
      wrap.removeChild(oldCard);
      updateIndicator();
    }, 260);
  });

  // IMPORTANT: bind swipe on the new card so swipe works continuously
  bindSwipe(newCard);
}

function bindSwipe(el) {
  let x0 = null, dx = 0, active = false;
  el.addEventListener('touchstart', e => {
    x0 = e.touches[0].clientX; dx = 0; active = true; el.style.transition = '';
  }, {passive: true});
  el.addEventListener('touchmove', e => {
    if (!active) return;
    dx = e.touches[0].clientX - x0;
    el.style.transform = `translateX(${dx}px)`;
  }, {passive: true});
  el.addEventListener('touchend', () => {
    if (!active) return;
    const width = el.clientWidth;
    if (Math.abs(dx) > width * 0.2) {
      if (dx < 0) next(); else prev();
    } else {
      el.style.transition = 'transform .2s ease'; el.style.transform = 'translateX(0)';
      setTimeout(() => { el.style.transition = ''; }, 210);
    }
    active = false; x0 = null; dx = 0;
  });
}

document.getElementById('prevBtn').onclick = prev;
document.getElementById('nextBtn').onclick = next;

document.getElementById('themeBtn').onclick = () => {
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
};
(function initTheme(){
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.body.classList.add('light');
})();

// TrackMan toggle
document.getElementById('tmToggle').addEventListener('change', (e) => {
  trackmanMode = e.target.checked;
  render();
});

// -------- Session logger --------
function startSession() {
  const now = new Date();
  sessionId = `sess_${now.toISOString()}`;
  sessionLog = [];
  console.log('Session started', sessionId);
  alert('Session started');
}
function saveStep() {
  if (!sessionId) { alert('Start a session first'); return; }
  const steps = DATA[currentCategory] || [];
  const step = steps[stepIndex];
  const entries = {};
  // collect all inputs on page
  document.querySelectorAll('.log-input').forEach(el => {
    const id = el.id || Math.random().toString(36).slice(2);
    if (el.type === 'checkbox') entries[id] = el.checked;
    else entries[id] = el.value;
  });
  sessionLog.push({
    id: sessionId,
    ts: new Date().toISOString(),
    category: currentCategory,
    stepTitle: step.title,
    tm: trackmanMode,
    entries
  });
  // persist to localStorage
  const existing = JSON.parse(localStorage.getItem('pp_sessions') || '[]');
  existing.push(sessionLog[sessionLog.length-1]);
  localStorage.setItem('pp_sessions', JSON.stringify(existing));
  alert('Saved step');
}
function exportLog() {
  const data = JSON.parse(localStorage.getItem('pp_sessions') || '[]');
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'practice_sessions.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('startBtn').onclick = startSession;
document.getElementById('saveBtn').onclick = saveStep;
document.getElementById('exportBtn').onclick = exportLog;

loadData();
