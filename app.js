let DATA = {};
let currentCategory = null;
let stepIndex = 0;

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
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="kicker">${currentCategory}</div>
    <h2>${step.title}</h2>
    <ul>${step.items.map(renderItem).join('')}</ul>
  `;
  wrap.appendChild(card);
  updateIndicator();
  bindSwipe(card);
}

function renderItem(item) {
  if (typeof item === 'string') {
    return `<li>${item}</li>`;
  }
  let html = `<li>${item.label || ''}`;
  const badges = [];
  if (item.perClub) {
    item.perClub.forEach(pc => badges.push(`<span class="badge">${pc.club} × ${pc.balls}</span>`));
  }
  if (item.balls) {
    badges.push(`<span class="badge">${item.balls} balls</span>`);
  }
  if (badges.length) html += `<div class="badges">${badges.join('')}</div>`;
  html += `</li>`;
  return html;
}

function updateIndicator() {
  const steps = DATA[currentCategory] || [];
  const ind = document.getElementById('stepIndicator');
  ind.textContent = `${stepIndex + 1}/${steps.length}`;
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
  const newCard = oldCard.cloneNode(false);
  const steps = DATA[currentCategory];
  const step = steps[stepIndex];
  newCard.className = 'card';
  newCard.innerHTML = `
    <div class="kicker">${currentCategory}</div>
    <h2>${step.title}</h2>
    <ul>${step.items.map(renderItem).join('')}</ul>
  `;
  newCard.style.transform = `translateX(${dir * 100}%)`;
  wrap.appendChild(newCard);

  requestAnimationFrame(() => {
    oldCard.style.transition = 'transform .25s ease';
    newCard.style.transition = 'transform .25s ease';
    oldCard.style.transform = `translateX(${-dir * 100}%)`;
    newCard.style.transform = 'translateX(0)';
    setTimeout(() => {
      wrap.removeChild(oldCard);
      updateIndicator();
    }, 260);
  });
}

function bindSwipe(el) {
  let x0 = null;
  let dx = 0;
  el.addEventListener('touchstart', e => {
    x0 = e.touches[0].clientX;
    dx = 0;
  }, {passive: true});
  el.addEventListener('touchmove', e => {
    if (x0 === null) return;
    dx = e.touches[0].clientX - x0;
    el.style.transform = `translateX(${dx}px)`;
  }, {passive: true});
  el.addEventListener('touchend', () => {
    const width = el.clientWidth;
    if (Math.abs(dx) > width * 0.2) {
      if (dx < 0) next(); else prev();
    } else {
      el.style.transition = 'transform .2s ease'; el.style.transform = 'translateX(0)';
      setTimeout(() => { el.style.transition = ''; }, 210);
    }
    x0 = null;
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

loadData();
