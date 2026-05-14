// ================================================================
// assets/js/main.js — Free BP SFS v2.3.0
// ================================================================

// ── STARFIELD ────────────────────────────────────────────────────
function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  function createStars(n) {
    stars = [];
    for (let i = 0; i < n; i++) stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: Math.random()*1.5+0.2, alpha: Math.random()*0.8+0.2, speed: Math.random()*0.3+0.05, flicker: Math.random()*0.02+0.005, fd: 1 });
  }
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    stars.forEach(s => {
      s.alpha += s.flicker*s.fd; if(s.alpha>=1||s.alpha<=0.1) s.fd*=-1;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(200,230,255,${s.alpha})`; ctx.fill();
      s.y+=s.speed; if(s.y>canvas.height){s.y=0;s.x=Math.random()*canvas.width;}
    });
    requestAnimationFrame(draw);
  }
  resize(); createStars(200); draw();
  window.addEventListener('resize',()=>{resize();createStars(200);});
}

// ── HELPERS ──────────────────────────────────────────────────────
const PLACEHOLDER_PATTERNS = ['LINK_BLUEPRINT','DISINI','javascript:','contoh.com','example.com'];
function isPlaceholderLink(href) {
  if (!href) return true;
  const h = href.trim().toLowerCase();
  if (h===''||h==='#') return true;
  return PLACEHOLDER_PATTERNS.some(p => href.toUpperCase().includes(p.toUpperCase()));
}

function getBasePath() {
  return window.location.pathname.includes('/pages/') ? '../' : '';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (d > 0) return `${d} hari lalu`;
  if (h > 0) return `${h} jam lalu`;
  if (m > 0) return `${m} mnt lalu`;
  return 'Baru saja';
}

function renderBadges(profile) {
  let b = '';
  if (!profile) return b;
  if (profile.is_verified) b += `<span class="badge-verified" title="Akun Terverifikasi">✅</span>`;
  if (profile.is_creator) b += `<span class="badge-creator">🏷️ KREATOR</span>`;
  return b;
}

// ── STATS ────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const [visitorTotal, stats] = await Promise.all([
      window.SFS.trackVisitor(),
      window.SFS.getTotalStats()
    ]);
    function animCount(el, target) {
      let c=0; const step=Math.max(1,Math.ceil(target/40));
      const t=setInterval(()=>{c=Math.min(c+step,target);el.textContent=c.toLocaleString();if(c>=target)clearInterval(t);},30);
    }
    document.querySelectorAll('#statVisitors').forEach(el=>animCount(el, visitorTotal));
    document.querySelectorAll('#statTotalBP').forEach(el=>{el.textContent=stats.totalBP;});
    document.querySelectorAll('#statTotalDownloads').forEach(el=>animCount(el, stats.totalDownloads));
  } catch(e) { console.warn('Stats error:',e); }
}

// ── AUTH UI ──────────────────────────────────────────────────────
async function initAuthUI() {
  const profile = await window.SFS.getCurrentProfile();
  const base = getBasePath();

  document.querySelectorAll('.nav-auth-area').forEach(area => {
    if (profile) {
      const badges = renderBadges(profile);
      let panelLinks = '';
      if (profile.role === 'moderator' || profile.role === 'admin' || profile.role === 'owner') {
        panelLinks += `<li><a href="${base}pages/moderator.html"><span class="nav-icon">🔨</span> Panel Moderator</a></li>`;
      }
      if (profile.role === 'admin' || profile.role === 'owner') {
        panelLinks += `<li><a href="${base}pages/admin.html"><span class="nav-icon">🛡️</span> Panel Admin</a></li>`;
      }

      area.innerHTML = `
        <li class="nav-username">👤 ${profile.username}${badges}</li>
        <li><a href="${base}pages/my-blueprints.html"><span class="nav-icon">🗂️</span> Blueprint Saya</a></li>
        <li><a href="${base}pages/upload.html"><span class="nav-icon">⬆️</span> Upload Blueprint</a></li>
        <li><a href="${base}pages/profile.html"><span class="nav-icon">👤</span> Profil</a></li>
        ${panelLinks}
        <li><a href="#" id="btnLogout"><span class="nav-icon">🚪</span> Logout</a></li>
      `;
      document.getElementById('btnLogout')?.addEventListener('click', async(e) => {
        e.preventDefault();
        await window.SFS.logoutUser();
        location.reload();
      });
    } else {
      area.innerHTML = `
        <li><a href="${base}pages/upload.html"><span class="nav-icon">⬆️</span> Upload Blueprint</a></li>
        <li><a href="${base}pages/login.html"><span class="nav-icon">🔑</span> Login / Register</a></li>
      `;
    }
  });
}

// ── ANNOUNCEMENTS BANNER ──────────────────────────────────────────
async function loadAnnouncements() {
  const container = document.getElementById('announcementBanner');
  if (!container) return;
  const list = await window.SFS.getActiveAnnouncements();
  if (!list.length) { container.style.display = 'none'; return; }
  container.innerHTML = list.map(a => `
    <div class="announcement-item">
      <span class="ann-icon">📢</span>
      <span class="ann-text">${a.content}</span>
      <button class="ann-close" data-id="${a.id}">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('.ann-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.announcement-item').style.display = 'none';
    });
  });
}

// ── BLUEPRINT CARD ────────────────────────────────────────────────
function buildCard(bp, userLikes = [], currentUserId = null, showActions = false) {
  const isLiked = userLikes.includes(bp.id);
  const isDeleted = bp.is_deleted;
  const imgHTML = bp.image_url
    ? `<img src="${bp.image_url}" class="bp-card-img" alt="${bp.name}" style="cursor:zoom-in;">`
    : `<div class="bp-card-img-placeholder" style="cursor:zoom-in;">🚀</div>`;

  if (isDeleted) {
    return `
      <div class="bp-card deleted-card">
        <div class="deleted-notice">
          <div class="deleted-title">⚠️ Blueprint Dihapus</div>
          <div class="deleted-name">${bp.name}</div>
          <div class="deleted-reason">Alasan: "${bp.deleted_reason || 'Tidak ada alasan diberikan.'}"</div>
          <div class="deleted-time">Dihapus ${timeAgo(bp.deleted_at)}</div>
        </div>
      </div>`;
  }

  const hasLink = bp.link && !isPlaceholderLink(bp.link);
  const dlBtn = hasLink
    ? `<a href="${bp.link}" class="btn-download" target="_blank" data-bp-id="${bp.id}">⬇ Ambil BP</a>`
    : `<span class="coming-soon-badge">SEGERA</span><button class="btn-download disabled" style="cursor:not-allowed;">🔒 Segera</button>`;

  const actionsHTML = showActions && currentUserId && bp.user_id === currentUserId ? `
    <div class="bp-user-actions">
      <button class="btn-edit" data-bp-id="${bp.id}">✏️ Edit</button>
      <button class="btn-delete-own" data-bp-id="${bp.id}">🗑️ Hapus</button>
    </div>` : '';

  return `
    <div class="bp-card" data-bp-id="${bp.id}">
      <a href="${getBasePath()}pages/blueprint.html?id=${bp.id}" class="bp-card-link">
        ${imgHTML}
      </a>
      <div class="bp-card-body">
        <span class="bp-author"><span class="author-icon">👤</span> By ${bp.author_name}</span>
        <h3><a href="${getBasePath()}pages/blueprint.html?id=${bp.id}" style="color:inherit;text-decoration:none;">${bp.name}</a></h3>
        <p class="desc">${bp.description || ''}</p>
      </div>
      <div class="bp-card-footer">
        <div class="bp-stats">
          <span>📥 ${(bp.download_count||0).toLocaleString()}</span>
          <button class="like-btn ${isLiked?'liked':''}" data-bp-id="${bp.id}">
            ${isLiked?'❤️':'🤍'} <span class="like-count">${(bp.like_count||0).toLocaleString()}</span>
          </button>
        </div>
        ${dlBtn}
      </div>
      ${actionsHTML}
    </div>`;
}

// ── RENDER BLUEPRINTS (kategori) ──────────────────────────────────
let currentPage = 1;
let currentSearch = '';
let currentSort = 'created_at';

async function renderBlueprints(containerSelector, category) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = `<div class="loading-bp">⏳ Memuat blueprint...</div>`;

  const user = await window.SFS.getCurrentUser();
  const userLikes = user ? await window.SFS.getUserLikes(user.id) : [];

  const { data, error } = await window.SFS.getBlueprints(category, currentSort, currentPage, 12, currentSearch);
  if (error || !data.length) {
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem;">Belum ada blueprint di kategori ini.</p>`;
    return;
  }
  container.innerHTML = data.map(bp => buildCard(bp, userLikes, user?.id)).join('');
  attachCardListeners(container);
  initLightboxForContainer(container);
  renderPagination(category);
}

async function renderMyBlueprints(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const user = await window.SFS.getCurrentUser();
  if (!user) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem;">
        <p style="color:var(--text-muted);margin-bottom:1rem;">Kamu harus login untuk melihat blueprint kamu.</p>
        <a href="login.html" class="btn-download" style="display:inline-block;">🔑 Login Sekarang</a>
      </div>`;
    return;
  }
  container.innerHTML = `<div class="loading-bp">⏳ Memuat blueprint kamu...</div>`;
  const { data, error } = await window.SFS.getBlueprintsByUser(user.id);
  if (error || !data.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem;">
        <p style="color:var(--text-muted);margin-bottom:1rem;">Kamu belum upload blueprint apapun.</p>
        <a href="upload.html" class="btn-download" style="display:inline-block;">⬆️ Upload Sekarang</a>
      </div>`;
    return;
  }
  container.innerHTML = data.map(bp => buildCard(bp, [], user.id, true)).join('');
  attachCardListeners(container);
  attachMyBPListeners(container);
  initLightboxForContainer(container);
}

// ── CARD LISTENERS ────────────────────────────────────────────────
function attachCardListeners(container) {
  // Download
  container.querySelectorAll('.btn-download:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bpId = btn.dataset.bpId || btn.closest('.bp-card')?.dataset.bpId;
      if (!bpId) return;
      await window.SFS.recordDownload(bpId);
      const countEl = btn.closest('.bp-card')?.querySelector('.use-count strong');
      if (countEl) { countEl.textContent = parseInt(countEl.textContent||'0')+1; }
    });
  });
  // Like
  container.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bpId = btn.dataset.bpId;
      const { data, error } = await window.SFS.toggleLike(bpId);
      if (error) { if(error.message.includes('login')) window.location.href=`${getBasePath()}pages/login.html`; return; }
      btn.className = `like-btn ${data.liked?'liked':''}`;
      btn.innerHTML = `${data.liked?'❤️':'🤍'} <span class="like-count">${data.count.toLocaleString()}</span>`;
    });
  });
}

function attachMyBPListeners(container) {
  // Edit
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const bpId = btn.dataset.bpId;
      window.location.href = `upload.html?edit=${bpId}`;
    });
  });
  // Delete own
  container.querySelectorAll('.btn-delete-own').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bpId = btn.dataset.bpId;
      if (!confirm('Hapus blueprint ini? Tindakan tidak bisa dibatalkan.')) return;
      const { error } = await window.SFS.deleteOwnBlueprint(bpId);
      if (!error) btn.closest('.bp-card')?.remove();
      else alert('Gagal menghapus: ' + error.message);
    });
  });
}

// ── PAGINATION ────────────────────────────────────────────────────
function renderPagination(category) {
  const container = document.getElementById('pagination');
  if (!container) return;
  const pages = [currentPage-1, currentPage, currentPage+1].filter(p => p > 0);
  container.innerHTML = pages.map(p => `
    <button class="page-btn ${p===currentPage?'active':''}" data-page="${p}">${p}</button>
  `).join('');
  if (currentPage > 1) container.innerHTML = `<button class="page-btn" data-page="${currentPage-1}">‹</button>` + container.innerHTML;
  container.innerHTML += `<button class="page-btn" data-page="${currentPage+1}">›</button>`;
  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentPage = parseInt(btn.dataset.page);
      await renderBlueprints('.bp-grid', category);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ── SEARCH & FILTER ───────────────────────────────────────────────
function initSearchFilter(category) {
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        currentSearch = searchInput.value.trim();
        currentPage = 1;
        await renderBlueprints('.bp-grid', category);
      }, 400);
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', async () => {
      currentSort = sortSelect.value;
      currentPage = 1;
      await renderBlueprints('.bp-grid', category);
    });
  }
}

// ── HAMBURGER MENU ────────────────────────────────────────────────
function initMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!hamburger||!sidebar||!overlay) return;
  hamburger.addEventListener('click', () => { hamburger.classList.toggle('active'); sidebar.classList.toggle('active'); overlay.classList.toggle('active'); });
  overlay.addEventListener('click', () => { hamburger.classList.remove('active'); sidebar.classList.remove('active'); overlay.classList.remove('active'); });
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-list a').forEach(link => { const href=link.getAttribute('href')?.split('/').pop(); if(href===current) link.classList.add('active'); });
}

// ── LIGHTBOX ──────────────────────────────────────────────────────
function initLightbox() {
  if (document.getElementById('lightboxOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'lightboxOverlay'; overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `<div class="lightbox-content"><button class="lightbox-close" id="lightboxClose">✕</button><div id="lightboxMedia"></div><div class="lightbox-caption" id="lightboxCaption"></div></div>`;
  document.body.appendChild(overlay);
  function open(src, caption, isEmoji) {
    document.getElementById('lightboxMedia').innerHTML = isEmoji ? `<div style="font-size:6rem;">${src}</div>` : `<img src="${src}" alt="${caption}">`;
    document.getElementById('lightboxCaption').textContent = caption;
    overlay.classList.add('active'); document.body.style.overflow = 'hidden';
  }
  window._openLightbox = open;
  function close() { overlay.classList.remove('active'); document.body.style.overflow = ''; }
  document.getElementById('lightboxClose').addEventListener('click', close);
  overlay.addEventListener('click', e => { if(e.target===overlay) close(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape') close(); });
  initLightboxForContainer(document);
}

function initLightboxForContainer(container) {
  container.querySelectorAll?.('.bp-card-img').forEach(img => {
    img.addEventListener('click', () => { const t=img.closest('.bp-card')?.querySelector('h3 a')?.textContent||img.alt; window._openLightbox?.(img.src,t,false); });
  });
  container.querySelectorAll?.('.bp-card-img-placeholder').forEach(el => {
    el.addEventListener('click', () => { const t=el.closest('.bp-card')?.querySelector('h3 a')?.textContent||'Blueprint'; window._openLightbox?.(el.textContent.trim(),t,true); });
  });
}

// ── RANDOM PAGE ───────────────────────────────────────────────────
async function initRandomPage() {
  const btn = document.getElementById('btnRandom');
  const result = document.getElementById('randomResult');
  if (!btn||!result) return;
  btn.addEventListener('click', async () => {
    result.innerHTML = `<div class="loading-bp">🎲 Mengambil blueprint acak...</div>`;
    result.classList.add('visible');
    const { data } = await window.SFS.getBlueprints(null, 'created_at', 1, 100);
    if (!data||!data.length) { result.innerHTML=`<p style="color:var(--text-muted)">Belum ada blueprint.</p>`; return; }
    const pick = data[Math.floor(Math.random()*data.length)];
    result.innerHTML = buildCard(pick, [], null);
    attachCardListeners(result);
    initLightboxForContainer(result);
  });
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStarfield();
  initMenu();
  initLightbox();
  await initAuthUI();
  await loadStats();
  await loadAnnouncements();
  await window.SFS.updateSession();
  initRandomPage();

  const page = window.location.pathname.split('/').pop();
  if (page === 'NASA.html')          { initSearchFilter('nasa');    await renderBlueprints('.bp-grid', 'nasa'); }
  if (page === 'spacex.html')        { initSearchFilter('spacex');  await renderBlueprints('.bp-grid', 'spacex'); }
  if (page === 'satelit.html')       { initSearchFilter('satelit'); await renderBlueprints('.bp-grid', 'satelit'); }
  if (page === 'my-blueprints.html') { await renderMyBlueprints('.bp-grid'); }
});
