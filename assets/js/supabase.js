// ================================================================
// assets/js/supabase.js — Free BP SFS v2.3.0
// Ganti SUPABASE_URL dan SUPABASE_ANON_KEY
// ================================================================
const SUPABASE_URL      = 'https://mrubbgfthrxeveahvrsu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H-zZj7xLPNmF6NLRywYJxQ_71j5KdmQ';

// Email owner — ganti dengan email kamu
const OWNER_EMAIL = 'vanzzcode@gmail.com';
// Password verifikasi panel admin/owner (beda dari password login)
const ADMIN_VERIFY_PASSWORD = 'VanzzAkses895';
// Storage bucket name
const BUCKET = 'blueprint-images';

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================================
// AUTH
// ================================================================
async function registerUser(username, password) {
  const fakeEmail = username.toLowerCase().replace(/[^a-z0-9]/g, '') + '@sfs.local';
  const { data: existing } = await _sb.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) return { error: { message: 'Username sudah dipakai, coba yang lain.' } };
  const { data, error } = await _sb.auth.signUp({
    email: fakeEmail, password,
    options: { data: { username } }
  });
  return { data, error };
}

async function loginUser(username, password) {
  const fakeEmail = username.toLowerCase().replace(/[^a-z0-9]/g, '') + '@sfs.local';
  const { data, error } = await _sb.auth.signInWithPassword({ email: fakeEmail, password });
  if (error) return { error: { message: 'Username atau password salah.' } };
  // Update session tracker
  if (data?.user) {
    await _sb.rpc('update_session', { uid: data.user.id, uname: username });
  }
  return { data, error: null };
}

async function logoutUser() {
  return await _sb.auth.signOut();
}

async function getCurrentUser() {
  const { data: { user } } = await _sb.auth.getUser();
  return user;
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await _sb.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

async function verifyAdminPassword(inputPassword) {
  return inputPassword === ADMIN_VERIFY_PASSWORD;
}

// ================================================================
// VISITOR
// ================================================================
async function trackVisitor() {
  const KEY = 'sfs_visited_v3';
  let total = 0;
  if (!sessionStorage.getItem(KEY)) {
    const { data } = await _sb.rpc('increment_visitor');
    total = data || 0;
    sessionStorage.setItem(KEY, '1');
  } else {
    const { data } = await _sb.from('visitors').select('total').eq('id', 1).single();
    total = data?.total || 0;
  }
  return total;
}

// ================================================================
// STATS
// ================================================================
async function getTotalStats() {
  const [{ count: totalBP }, { data: dlData }, { count: totalUsers }] = await Promise.all([
    _sb.from('blueprints').select('*', { count: 'exact', head: true }).eq('is_approved', true).eq('is_deleted', false),
    _sb.from('blueprints').select('download_count').eq('is_approved', true).eq('is_deleted', false),
    _sb.from('profiles').select('*', { count: 'exact', head: true })
  ]);
  const totalDownloads = (dlData || []).reduce((s, r) => s + (r.download_count || 0), 0);
  return { totalBP: totalBP || 0, totalDownloads, totalUsers: totalUsers || 0 };
}

// ================================================================
// BLUEPRINTS — READ
// ================================================================
async function getBlueprints(category = null, sortBy = 'created_at', page = 1, limit = 12, search = '') {
  let q = _sb.from('blueprints').select('*').eq('is_approved', true).eq('is_deleted', false);
  if (category) q = q.eq('category', category);
  if (search) q = q.ilike('name', `%${search}%`);
  if (sortBy === 'like_count') q = q.order('like_count', { ascending: false });
  else if (sortBy === 'download_count') q = q.order('download_count', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  const from = (page - 1) * limit;
  q = q.range(from, from + limit - 1);
  const { data, error, count } = await q;
  return { data: data || [], error, count };
}

async function getBlueprintById(id) {
  const { data, error } = await _sb.from('blueprints').select('*').eq('id', id).single();
  return { data, error };
}

async function getBlueprintsByUser(userId) {
  // Ambil semua termasuk yang dihapus untuk "Blueprint Saya"
  const { data, error } = await _sb.from('blueprints')
    .select('*')
    .eq('user_id', userId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

async function getAllBlueprintsAdmin() {
  const { data, error } = await _sb.from('blueprints')
    .select('*, profiles(username)')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

// ================================================================
// BLUEPRINTS — WRITE
// ================================================================
async function uploadBlueprint({ name, description, authorName, category, imageFile, imageBase64, link }) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Harus login untuk upload blueprint.' } };

  // Cek ban
  const profile = await getCurrentProfile();
  if (profile?.is_banned) return { error: { message: 'Akun kamu dibanned.' } };

  // Cek upload limit
  const canUpload = await _sb.rpc('check_upload_limit', { uid: user.id });
  if (!canUpload.data) return { error: { message: 'Batas upload hari ini tercapai (maks. 5 blueprint/hari).' } };

  let image_url = imageBase64 || null;
  let image_path = null;

  // Upload ke Storage jika ada file baru
  if (imageFile) {
    const ext = imageFile.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await _sb.storage.from(BUCKET).upload(path, imageFile, { upsert: true });
    if (!uploadErr) {
      const { data: urlData } = _sb.storage.from(BUCKET).getPublicUrl(path);
      image_url = urlData.publicUrl;
      image_path = path;
    }
  }

  const { data, error } = await _sb.from('blueprints').insert([{
    user_id: user.id, name, description,
    author_name: authorName, category,
    image_url, image_path, link,
    download_count: 0, like_count: 0,
    is_approved: true, is_deleted: false
  }]).select().single();

  if (!error) await _sb.rpc('increment_upload_count', { uid: user.id });
  return { data, error };
}

async function editBlueprint(id, { name, description, category, imageFile, link }) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Harus login.' } };

  let updates = { name, description, category, link };

  if (imageFile) {
    // Hapus gambar lama dari storage dulu
    const { data: bp } = await getBlueprintById(id);
    if (bp?.image_path) {
      await _sb.storage.from(BUCKET).remove([bp.image_path]);
    }
    const ext = imageFile.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await _sb.storage.from(BUCKET).upload(path, imageFile, { upsert: true });
    if (!uploadErr) {
      const { data: urlData } = _sb.storage.from(BUCKET).getPublicUrl(path);
      updates.image_url = urlData.publicUrl;
      updates.image_path = path;
    }
  }

  const { data, error } = await _sb.from('blueprints').update(updates).eq('id', id).eq('user_id', user.id).select().single();
  return { data, error };
}

async function deleteOwnBlueprint(id) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Harus login.' } };
  // Hapus gambar dari storage
  const { data: bp } = await getBlueprintById(id);
  if (bp?.image_path) await _sb.storage.from(BUCKET).remove([bp.image_path]);
  const { error } = await _sb.from('blueprints').delete().eq('id', id).eq('user_id', user.id);
  return { error };
}

async function adminDeleteBlueprint(id, reason) {
  const actor = await getCurrentProfile();
  if (!actor) return { error: { message: 'Tidak terautentikasi.' } };

  // Hapus gambar dari storage
  const { data: bp } = await getBlueprintById(id);
  if (bp?.image_path) await _sb.storage.from(BUCKET).remove([bp.image_path]);

  const { error } = await _sb.from('blueprints').update({
    is_deleted: true,
    deleted_by: actor.id,
    deleted_reason: reason,
    deleted_at: new Date().toISOString(),
    image_url: bp?.image_path ? null : bp?.image_url // hapus URL jika dari storage
  }).eq('id', id);

  // Log aktivitas
  if (!error) {
    await logActivity('hapus_blueprint', 'blueprint', id, bp?.name || id, reason);
  }
  return { error };
}

// ================================================================
// DOWNLOAD
// ================================================================
async function recordDownload(blueprintId) {
  await _sb.rpc('increment_download', { bp_id: blueprintId });
}

// ================================================================
// LIKES
// ================================================================
async function toggleLike(blueprintId) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Harus login untuk like.' } };
  const { data, error } = await _sb.rpc('toggle_like', { bp_id: blueprintId, uid: user.id });
  return { data, error };
}

async function getUserLikes(userId) {
  const { data } = await _sb.from('likes').select('blueprint_id').eq('user_id', userId);
  return (data || []).map(r => r.blueprint_id);
}

// ================================================================
// COMMENTS
// ================================================================
async function getComments(blueprintId) {
  const { data, error } = await _sb.from('comments')
    .select('*, profiles(username, is_verified, is_creator, role)')
    .eq('blueprint_id', blueprintId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  return { data: data || [], error };
}

async function addComment(blueprintId, content) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Harus login untuk komentar.' } };
  const profile = await getCurrentProfile();
  if (profile?.is_banned) return { error: { message: 'Akun kamu dibanned.' } };
  const { data, error } = await _sb.from('comments').insert([{
    blueprint_id: blueprintId, user_id: user.id, content
  }]).select('*, profiles(username, is_verified, is_creator, role)').single();
  return { data, error };
}

async function deleteComment(commentId) {
  const actor = await getCurrentProfile();
  if (!actor) return { error: { message: 'Tidak terautentikasi.' } };
  const { error } = await _sb.from('comments').update({
    is_deleted: true, deleted_by: actor.id
  }).eq('id', commentId);
  if (!error) await logActivity('hapus_komentar', 'comment', commentId, commentId, null);
  return { error };
}

// ================================================================
// REPORTS
// ================================================================
async function submitReport(targetType, targetId, reason) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Harus login untuk melapor.' } };
  const { data, error } = await _sb.from('reports').insert([{
    reporter_id: user.id, target_type: targetType, target_id: targetId, reason
  }]).select().single();
  return { data, error };
}

async function getPendingReports() {
  const { data, error } = await _sb.from('reports')
    .select('*, profiles!reporter_id(username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return { data: data || [], error };
}

async function actionReport(reportId, action) {
  const actor = await getCurrentProfile();
  const { error } = await _sb.from('reports').update({
    status: action, actioned_by: actor?.id
  }).eq('id', reportId);
  return { error };
}

// ================================================================
// WARNINGS & BAN
// ================================================================
async function giveWarning(targetUserId, reason) {
  const actor = await getCurrentProfile();
  if (!actor) return { error: { message: 'Tidak terautentikasi.' } };
  const { data, error } = await _sb.rpc('add_warning', {
    target_uid: targetUserId, given_by_uid: actor.id, warn_reason: reason
  });
  if (!error) {
    const { data: targetProfile } = await _sb.from('profiles').select('username').eq('id', targetUserId).single();
    await logActivity('beri_peringatan', 'user', targetUserId, targetProfile?.username || targetUserId, reason);
  }
  return { data, error };
}

async function banUser(targetUserId, reason) {
  const actor = await getCurrentProfile();
  const { error } = await _sb.from('profiles').update({
    is_banned: true, ban_reason: reason
  }).eq('id', targetUserId);
  if (!error) {
    const { data: t } = await _sb.from('profiles').select('username').eq('id', targetUserId).single();
    await logActivity('ban_user', 'user', targetUserId, t?.username || targetUserId, reason);
  }
  return { error };
}

async function unbanUser(targetUserId) {
  const { error } = await _sb.from('profiles').update({
    is_banned: false, ban_reason: null, warning_count: 0
  }).eq('id', targetUserId);
  if (!error) {
    const { data: t } = await _sb.from('profiles').select('username').eq('id', targetUserId).single();
    await logActivity('unban_user', 'user', targetUserId, t?.username || targetUserId, null);
  }
  return { error };
}

// ================================================================
// ANNOUNCEMENTS
// ================================================================
async function getActiveAnnouncements() {
  const { data } = await _sb.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false });
  return data || [];
}

async function postAnnouncement(content) {
  const actor = await getCurrentProfile();
  const { data, error } = await _sb.from('announcements').insert([{
    content, created_by: actor?.id, is_active: true
  }]).select().single();
  return { data, error };
}

async function deleteAnnouncement(id) {
  const { error } = await _sb.from('announcements').update({ is_active: false }).eq('id', id);
  return { error };
}

// ================================================================
// USERS — OWNER ONLY
// ================================================================
async function getAllUsers() {
  const { data, error } = await _sb.from('profiles').select('*').order('created_at', { ascending: false });
  return { data: data || [], error };
}

async function getOnlineUsers() {
  // Online = last_seen dalam 5 menit terakhir
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await _sb.from('user_sessions')
    .select('*, profiles(username, role, is_verified, is_creator)')
    .gte('last_seen', fiveMinAgo)
    .order('last_seen', { ascending: false });
  return { data: data || [], error };
}

async function findUserByUsernameOrEmail(query) {
  const isEmail = query.includes('@');
  let q = _sb.from('profiles').select('*');
  if (isEmail) {
    // Cari via fake email
    const fakeEmail = query.toLowerCase().replace(/[^a-z0-9@.]/g, '');
    const { data: authData } = await _sb.from('profiles').select('*').ilike('username', `%${query.split('@')[0]}%`);
    return { data: authData || [] };
  } else {
    q = q.ilike('username', `%${query}%`);
  }
  const { data, error } = await q.limit(5);
  return { data: data || [], error };
}

async function setUserRole(targetUserId, role) {
  const actor = await getCurrentProfile();
  const { error } = await _sb.from('profiles').update({ role }).eq('id', targetUserId);
  if (!error) {
    const { data: t } = await _sb.from('profiles').select('username').eq('id', targetUserId).single();
    await logActivity('ubah_role', 'user', targetUserId, t?.username || targetUserId, `Role → ${role}`);
  }
  return { error };
}

async function setVerified(targetUserId, value) {
  const { error } = await _sb.from('profiles').update({ is_verified: value }).eq('id', targetUserId);
  if (!error) {
    const { data: t } = await _sb.from('profiles').select('username').eq('id', targetUserId).single();
    await logActivity(value ? 'beri_centang_biru' : 'cabut_centang_biru', 'user', targetUserId, t?.username || targetUserId, null);
  }
  return { error };
}

async function setCreator(targetUserId, value) {
  const { error } = await _sb.from('profiles').update({ is_creator: value }).eq('id', targetUserId);
  if (!error) {
    const { data: t } = await _sb.from('profiles').select('username').eq('id', targetUserId).single();
    await logActivity(value ? 'beri_tag_kreator' : 'cabut_tag_kreator', 'user', targetUserId, t?.username || targetUserId, null);
  }
  return { error };
}

// ================================================================
// LEADERBOARD
// ================================================================
async function getTopBlueprints(limit = 10) {
  const { data } = await _sb.from('blueprints')
    .select('*, profiles(username, is_verified, is_creator)')
    .eq('is_deleted', false).eq('is_approved', true)
    .order('like_count', { ascending: false })
    .limit(limit);
  return data || [];
}

async function getTopUploaders(limit = 10) {
  const { data } = await _sb.from('profiles')
    .select('id, username, is_verified, is_creator, role')
    .eq('is_banned', false)
    .limit(limit);
  if (!data) return [];
  // Hitung total blueprint & download per user
  const result = await Promise.all(data.map(async (profile) => {
    const { count: bpCount } = await _sb.from('blueprints')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('is_deleted', false);
    const { data: dlData } = await _sb.from('blueprints')
      .select('download_count').eq('user_id', profile.id).eq('is_deleted', false);
    const totalDl = (dlData || []).reduce((s, r) => s + (r.download_count || 0), 0);
    return { ...profile, bp_count: bpCount || 0, total_downloads: totalDl };
  }));
  return result.sort((a, b) => b.bp_count - a.bp_count);
}

// ================================================================
// ACTIVITY LOGS
// ================================================================
async function logActivity(action, targetType, targetId, targetLabel, reason) {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  await _sb.from('activity_logs').insert([{
    actor_id: user?.id || null,
    actor_username: profile?.username || 'System',
    action, target_type: targetType,
    target_id: targetId, target_label: targetLabel, reason
  }]);
}

async function getActivityLogs(limit = 50) {
  const { data } = await _sb.from('activity_logs')
    .select('*').order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

// ================================================================
// UPDATE SESSION (panggil saat halaman dimuat & user login)
// ================================================================
async function updateSession() {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (user && profile) {
    await _sb.rpc('update_session', { uid: user.id, uname: profile.username });
  }
}

// ================================================================
// HELPER: render badge verified & creator
// ================================================================
function renderUserBadges(profile) {
  let badges = '';
  if (!profile) return badges;
  if (profile.is_verified) badges += `<span class="badge-verified" title="Akun Terverifikasi">✅</span>`;
  if (profile.is_creator) badges += `<span class="badge-creator" title="Kreator">🏷️ KREATOR</span>`;
  return badges;
}

// ================================================================
// EXPORT
// ================================================================
window.SFS = {
  // Auth
  registerUser, loginUser, logoutUser,
  getCurrentUser, getCurrentProfile,
  verifyAdminPassword,
  OWNER_EMAIL,
  // Visitor
  trackVisitor,
  // Stats
  getTotalStats,
  // Blueprints
  getBlueprints, getBlueprintById,
  getBlueprintsByUser, getAllBlueprintsAdmin,
  uploadBlueprint, editBlueprint,
  deleteOwnBlueprint, adminDeleteBlueprint,
  // Download & Like
  recordDownload, toggleLike, getUserLikes,
  // Comments
  getComments, addComment, deleteComment,
  // Reports
  submitReport, getPendingReports, actionReport,
  // Warnings & Ban
  giveWarning, banUser, unbanUser,
  // Announcements
  getActiveAnnouncements, postAnnouncement, deleteAnnouncement,
  // Users (Owner)
  getAllUsers, getOnlineUsers,
  findUserByUsernameOrEmail,
  setUserRole, setVerified, setCreator,
  // Leaderboard
  getTopBlueprints, getTopUploaders,
  // Logs
  getActivityLogs, logActivity,
  // Session
  updateSession,
  // Helpers
  renderUserBadges,
  BUCKET
};