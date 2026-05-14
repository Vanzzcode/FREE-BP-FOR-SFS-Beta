// ================================================================
// assets/js/admin.js — Free BP SFS v2.3.0
// Panel Admin, Owner, Moderator
// ================================================================

// ── VERIFY ADMIN ─────────────────────────────────────────────────
async function initAdminVerify(onSuccess) {
  const overlay = document.getElementById('verifyOverlay');
  const input = document.getElementById('adminPasswordInput');
  const btn = document.getElementById('btnVerifyAdmin');
  const errEl = document.getElementById('verifyError');
  if (!overlay) return;

  // Cek apakah sudah terverifikasi di session
  if (sessionStorage.getItem('admin_verified') === '1') {
    overlay.style.display = 'none';
    onSuccess?.();
    return;
  }

  overlay.style.display = 'flex';

  btn.addEventListener('click', async () => {
    const val = input.value;
    if (!val) return;
    const ok = await window.SFS.verifyAdminPassword(val);
    if (ok) {
      sessionStorage.setItem('admin_verified', '1');
      overlay.style.display = 'none';
      onSuccess?.();
    } else {
      errEl.textContent = '❌ Password salah.';
      input.value = '';
    }
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
}

// ── ADMIN PANEL ───────────────────────────────────────────────────
async function initAdminPanel() {
  await loadAdminStats();
  await loadAnnouncements_admin();
  await loadAllBlueprints_admin();
  await loadActivityLogs_admin();
}

async function loadAdminStats() {
  const stats = await window.SFS.getTotalStats();
  document.querySelectorAll('[data-stat="totalBP"]').forEach(el => el.textContent = stats.totalBP.toLocaleString());
  document.querySelectorAll('[data-stat="totalDownloads"]').forEach(el => el.textContent = stats.totalDownloads.toLocaleString());
  document.querySelectorAll('[data-stat="totalUsers"]').forEach(el => el.textContent = stats.totalUsers.toLocaleString());
}

async function loadAnnouncements_admin() {
  const list = await window.SFS.getActiveAnnouncements();
  const container = document.getElementById('adminAnnouncementList');
  if (!container) return;
  if (!list.length) { container.innerHTML = `<p class="text-muted">Tidak ada pengumuman aktif.</p>`; return; }
  container.innerHTML = list.map(a => `
    <div class="ann-row" data-id="${a.id}">
      <span class="ann-content">${a.content}</span>
      <button class="btn-sm btn-danger" onclick="deleteAnnouncement_admin('${a.id}')">🗑️ Hapus</button>
    </div>
  `).join('');
}

async function deleteAnnouncement_admin(id) {
  const { error } = await window.SFS.deleteAnnouncement(id);
  if (!error) loadAnnouncements_admin();
}

async function postAnnouncement_admin() {
  const input = document.getElementById('announcementInput');
  const content = input?.value?.trim();
  if (!content) return;
  const { error } = await window.SFS.postAnnouncement(content);
  if (!error) { input.value = ''; loadAnnouncements_admin(); }
  else showAdminMsg('Gagal post pengumuman: ' + error.message, 'error');
}

async function loadAllBlueprints_admin() {
  const tbody = document.getElementById('adminBPtbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1rem;">Memuat...</td></tr>`;
  const { data } = await window.SFS.getAllBlueprintsAdmin();
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1rem;">Belum ada blueprint.</td></tr>`; return; }
  tbody.innerHTML = data.map(bp => `
    <tr class="${bp.is_deleted?'row-deleted':''}">
      <td><strong>${bp.name}</strong></td>
      <td class="text-accent">${bp.profiles?.username || '—'}</td>
      <td><span class="cat-badge cat-${bp.category}">${bp.category.toUpperCase()}</span></td>
      <td>${(bp.download_count||0).toLocaleString()}</td>
      <td>❤️ ${(bp.like_count||0).toLocaleString()}</td>
      <td>${bp.is_deleted
        ? `<span class="status-badge deleted">Dihapus</span>`
        : `<span class="status-badge active">Aktif</span>`}</td>
      <td>${bp.is_deleted
        ? `<span style="font-size:12px;color:var(--text-muted);">${bp.deleted_reason||'—'}</span>`
        : `<button class="btn-sm btn-danger" onclick="openDeleteModal('${bp.id}','${bp.name.replace(/'/g,"\\'")}')">🗑️ Hapus</button>`}</td>
    </tr>
  `).join('');
}

function openDeleteModal(bpId, bpName) {
  const modal = document.getElementById('deleteModal');
  const label = document.getElementById('deleteModalLabel');
  const input = document.getElementById('deleteReasonInput');
  const btn = document.getElementById('btnConfirmDelete');
  if (!modal) return;
  label.textContent = `Hapus "${bpName}"`;
  input.value = '';
  modal.style.display = 'flex';
  btn.onclick = async () => {
    const reason = input.value.trim();
    if (!reason) { document.getElementById('deleteModalError').textContent = 'Alasan wajib diisi.'; return; }
    const { error } = await window.SFS.adminDeleteBlueprint(bpId, reason);
    if (!error) { modal.style.display = 'none'; loadAllBlueprints_admin(); }
    else document.getElementById('deleteModalError').textContent = 'Gagal: ' + error.message;
  };
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'none';
}

async function loadActivityLogs_admin() {
  const container = document.getElementById('activityLogList');
  if (!container) return;
  const logs = await window.SFS.getActivityLogs(50);
  if (!logs.length) { container.innerHTML = `<p class="text-muted">Belum ada aktivitas.</p>`; return; }
  const icons = { hapus_blueprint:'🗑️', hapus_komentar:'💬', beri_peringatan:'⚠️', ban_user:'🚫', unban_user:'✅', ubah_role:'👑', beri_centang_biru:'✅', cabut_centang_biru:'❌', beri_tag_kreator:'🏷️', cabut_tag_kreator:'❌' };
  container.innerHTML = logs.map(log => `
    <div class="log-row">
      <span class="log-icon-sm">${icons[log.action]||'📋'}</span>
      <div class="log-body">
        <span class="log-actor">${log.actor_username||'System'}</span>
        ${formatLogAction(log)}
      </div>
      <span class="log-time">${timeAgo(log.created_at)}</span>
    </div>
  `).join('');
}

function formatLogAction(log) {
  const actions = {
    hapus_blueprint: `menghapus blueprint <span class="text-accent">"${log.target_label}"</span>${log.reason?` — "${log.reason}"`:''} `,
    hapus_komentar: `menghapus komentar`,
    beri_peringatan: `memberi peringatan ke <span class="text-accent">${log.target_label}</span>${log.reason?` — "${log.reason}"`:''} `,
    ban_user: `<span class="text-danger">membanned</span> <span class="text-accent">${log.target_label}</span>${log.reason?` — "${log.reason}"`:''} `,
    unban_user: `<span class="text-success">unban</span> <span class="text-accent">${log.target_label}</span>`,
    ubah_role: `mengubah role <span class="text-accent">${log.target_label}</span> — ${log.reason||''}`,
    beri_centang_biru: `memberi centang biru ✅ ke <span class="text-accent">${log.target_label}</span>`,
    cabut_centang_biru: `mencabut centang biru dari <span class="text-accent">${log.target_label}</span>`,
    beri_tag_kreator: `memberi tag Kreator 🏷️ ke <span class="text-accent">${log.target_label}</span>`,
    cabut_tag_kreator: `mencabut tag Kreator dari <span class="text-accent">${log.target_label}</span>`,
  };
  return actions[log.action] || log.action;
}

// ── MODERATOR PANEL ───────────────────────────────────────────────
async function initModeratorPanel() {
  await loadPendingReports();
  await loadModLogs();
}

async function loadPendingReports() {
  const container = document.getElementById('reportsList');
  if (!container) return;
  container.innerHTML = `<p class="text-muted">Memuat laporan...</p>`;
  const { data } = await window.SFS.getPendingReports();
  if (!data.length) { container.innerHTML = `<p class="text-muted">Tidak ada laporan pending.</p>`; return; }
  container.innerHTML = data.map(r => `
    <div class="report-card" data-id="${r.id}">
      <div class="report-head">
        <span class="report-type-badge ${r.target_type}">${r.target_type === 'blueprint' ? '📋 BLUEPRINT' : '💬 KOMENTAR'}</span>
        <span class="text-muted" style="font-size:12px;">Dilaporkan oleh <strong>${r.profiles?.username||'?'}</strong> · ${timeAgo(r.created_at)}</span>
        <span class="status-badge pending" style="margin-left:auto;">Pending</span>
      </div>
      <div class="report-reason">"${r.reason}"</div>
      <div class="report-actions">
        <button class="btn-sm btn-ghost" onclick="ignoreReport('${r.id}')">Abaikan</button>
        <button class="btn-sm btn-danger" onclick="actionAndDeleteComment('${r.id}','${r.target_id}')">🗑️ Hapus Konten</button>
        <button class="btn-sm btn-mod" onclick="openWarnModal('${r.target_id}','${r.id}')">⚠️ Beri Peringatan</button>
      </div>
    </div>
  `).join('');
  document.getElementById('statPendingReports').textContent = data.length;
}

async function ignoreReport(reportId) {
  await window.SFS.actionReport(reportId, 'ignored');
  loadPendingReports();
}

async function actionAndDeleteComment(reportId, commentId) {
  await window.SFS.deleteComment(commentId);
  await window.SFS.actionReport(reportId, 'actioned');
  loadPendingReports();
}

function openWarnModal(targetUserId, reportId) {
  const modal = document.getElementById('warnModal');
  const input = document.getElementById('warnReasonInput');
  const btn = document.getElementById('btnConfirmWarn');
  if (!modal) return;
  modal.style.display = 'flex';
  input.value = '';
  btn.onclick = async () => {
    const reason = input.value.trim();
    if (!reason) { document.getElementById('warnModalError').textContent = 'Alasan wajib diisi.'; return; }
    const { data, error } = await window.SFS.giveWarning(targetUserId, reason);
    if (!error) {
      if (data?.auto_banned) showModMsg('User otomatis dibanned (3x peringatan).', 'warning');
      else showModMsg(`Peringatan ke-${data?.warning_count} berhasil diberikan.`, 'success');
      if (reportId) await window.SFS.actionReport(reportId, 'actioned');
      modal.style.display = 'none';
      loadPendingReports();
    } else document.getElementById('warnModalError').textContent = 'Gagal: ' + error.message;
  };
}

function closeWarnModal() { const m = document.getElementById('warnModal'); if(m) m.style.display='none'; }

async function loadModLogs() {
  const container = document.getElementById('modLogList');
  if (!container) return;
  const user = await window.SFS.getCurrentUser();
  const profile = await window.SFS.getCurrentProfile();
  const logs = await window.SFS.getActivityLogs(20);
  const myLogs = logs.filter(l => l.actor_id === user?.id);
  if (!myLogs.length) { container.innerHTML = `<p class="text-muted">Belum ada aktivitas.</p>`; return; }
  container.innerHTML = myLogs.map(l => `
    <div class="log-row">
      <span class="log-icon-sm">${l.action.includes('hapus')?'🗑️':'⚠️'}</span>
      <div class="log-body">${formatLogAction(l)}</div>
      <span class="log-time">${timeAgo(l.created_at)}</span>
    </div>
  `).join('');
}

// ── OWNER PANEL ───────────────────────────────────────────────────
async function initOwnerPanel() {
  await initAdminPanel();
  await loadAllUsers_owner();
  await loadOnlineUsers_owner();
}

async function loadAllUsers_owner() {
  const tbody = document.getElementById('ownerUserTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1rem;">Memuat...</td></tr>`;
  const { data } = await window.SFS.getAllUsers();
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="6">Belum ada user.</td></tr>`; return; }
  tbody.innerHTML = data.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="avatar-sm">${u.username[0].toUpperCase()}</div>
          <span>${u.username}</span>
          ${u.is_verified ? '<span class="badge-verified" title="Terverifikasi">✅</span>' : ''}
          ${u.is_creator ? '<span class="badge-creator">🏷️</span>' : ''}
        </div>
      </td>
      <td><span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span></td>
      <td>
        <div class="warn-dots-sm">
          ${[0,1,2].map(i=>`<span class="warn-dot-sm ${i<u.warning_count?'active':''}"></span>`).join('')}
        </div>
      </td>
      <td>${u.is_banned ? '<span class="status-badge banned">Banned</span>' : '<span class="status-badge active">Aktif</span>'}</td>
      <td style="font-size:12px;color:var(--text-muted);">${new Date(u.created_at).toLocaleDateString('id-ID')}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn-sm btn-ghost" onclick="openRoleModal('${u.id}','${u.username}','${u.role}','${u.is_verified}','${u.is_creator}')">⚙️ Kelola</button>
          ${u.is_banned
            ? `<button class="btn-sm btn-success" onclick="unbanUser_owner('${u.id}')">✅ Unban</button>`
            : `<button class="btn-sm btn-danger" onclick="openBanModal('${u.id}','${u.username}')">🚫 Ban</button>`}
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadOnlineUsers_owner() {
  const container = document.getElementById('onlineUsersList');
  if (!container) return;
  const { data } = await window.SFS.getOnlineUsers();
  document.getElementById('statOnlineUsers').textContent = data.length;
  if (!data.length) { container.innerHTML = `<p class="text-muted" style="padding:12px;">Tidak ada user online saat ini.</p>`; return; }
  container.innerHTML = data.map(s => `
    <div class="online-user-row">
      <div class="online-dot"></div>
      <span class="online-username">${s.profiles?.username || s.username}</span>
      <span class="role-badge role-${s.profiles?.role||'user'}" style="font-size:9px;">${(s.profiles?.role||'user').toUpperCase()}</span>
      ${s.profiles?.is_verified ? '<span class="badge-verified" style="font-size:11px;">✅</span>' : ''}
      <span class="text-muted" style="font-size:11px;margin-left:auto;">${timeAgo(s.last_seen)}</span>
    </div>
  `).join('');
}

function openRoleModal(userId, username, currentRole, isVerified, isCreator) {
  const modal = document.getElementById('roleModal');
  const title = document.getElementById('roleModalTitle');
  if (!modal) return;
  title.textContent = `Kelola: ${username}`;
  modal.dataset.userId = userId;
  // Set current values
  document.querySelectorAll('.role-opt').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.role === currentRole);
  });
  document.getElementById('toggleVerified').checked = isVerified === 'true';
  document.getElementById('toggleCreator').checked = isCreator === 'true';
  modal.style.display = 'flex';
}

function closeRoleModal() { const m = document.getElementById('roleModal'); if(m) m.style.display='none'; }

async function saveRoleModal() {
  const modal = document.getElementById('roleModal');
  const userId = modal.dataset.userId;
  const selectedRole = document.querySelector('.role-opt.selected')?.dataset.role;
  const isVerified = document.getElementById('toggleVerified').checked;
  const isCreator = document.getElementById('toggleCreator').checked;

  if (selectedRole) await window.SFS.setUserRole(userId, selectedRole);
  await window.SFS.setVerified(userId, isVerified);
  await window.SFS.setCreator(userId, isCreator);

  closeRoleModal();
  showOwnerMsg('Perubahan disimpan!', 'success');
  loadAllUsers_owner();
  loadActivityLogs_admin();
}

function openBanModal(userId, username) {
  const modal = document.getElementById('banModal');
  const label = document.getElementById('banModalLabel');
  const input = document.getElementById('banReasonInput');
  const btn = document.getElementById('btnConfirmBan');
  if (!modal) return;
  label.textContent = `Ban "${username}"`;
  input.value = '';
  modal.style.display = 'flex';
  btn.onclick = async () => {
    const reason = input.value.trim();
    if (!reason) { document.getElementById('banModalError').textContent = 'Alasan wajib diisi.'; return; }
    const { error } = await window.SFS.banUser(userId, reason);
    if (!error) { modal.style.display = 'none'; loadAllUsers_owner(); loadActivityLogs_admin(); showOwnerMsg('User berhasil dibanned.', 'success'); }
    else document.getElementById('banModalError').textContent = 'Gagal: ' + error.message;
  };
}

function closeBanModal() { const m = document.getElementById('banModal'); if(m) m.style.display='none'; }

async function unbanUser_owner(userId) {
  const { error } = await window.SFS.unbanUser(userId);
  if (!error) { loadAllUsers_owner(); loadActivityLogs_admin(); showOwnerMsg('User berhasil di-unban.', 'success'); }
}

async function searchUser_owner() {
  const query = document.getElementById('searchUserInput')?.value?.trim();
  if (!query) return;
  const { data } = await window.SFS.findUserByUsernameOrEmail(query);
  const result = document.getElementById('searchUserResult');
  if (!result) return;
  if (!data.length) { result.innerHTML = `<p class="text-muted">User tidak ditemukan.</p>`; return; }
  result.innerHTML = data.map(u => `
    <div class="search-user-row">
      <div class="avatar-sm">${u.username[0].toUpperCase()}</div>
      <div style="flex:1;">
        <div>${u.username} ${u.is_verified?'✅':''} ${u.is_creator?'🏷️':''}</div>
        <div style="font-size:11px;color:var(--text-muted);">Role: ${u.role} · Bergabung ${new Date(u.created_at).toLocaleDateString('id-ID')}</div>
      </div>
      <button class="btn-sm btn-ghost" onclick="openRoleModal('${u.id}','${u.username}','${u.role}','${u.is_verified}','${u.is_creator}')">⚙️ Kelola</button>
    </div>
  `).join('');
}

// ── MSG HELPERS ───────────────────────────────────────────────────
function showAdminMsg(msg, type) { _showMsg('adminMsg', msg, type); }
function showModMsg(msg, type)   { _showMsg('modMsg', msg, type); }
function showOwnerMsg(msg, type) { _showMsg('ownerMsg', msg, type); }
function _showMsg(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `panel-msg ${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m=Math.floor(diff/60000),h=Math.floor(diff/3600000),d=Math.floor(diff/86400000);
  if(d>0)return`${d} hari lalu`;if(h>0)return`${h} jam lalu`;if(m>0)return`${m} mnt lalu`;return'Baru saja';
}
