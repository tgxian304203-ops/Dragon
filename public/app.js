/* ═══════════════════════════════════════════════════════════════
   🐉 RỒNG THẦN — FRONTEND LOGIC
   ═══════════════════════════════════════════════════════════════ */

const API = {
  chatSend:      '/api/chat/send',
  chatHistory:   (id) => `/api/chat/${id}/history`,
  chatDelete:    (id) => `/api/chat/${id}`,
  authRegister:  '/api/auth/register',
  authLogin:     '/api/auth/login',
  authLogout:    '/api/auth/logout',
  authMe:        '/api/auth/me',
  guestCreate:   '/api/guest/create',
  brainGetKeys:  '/api/brain/run',
  brainAddKey:   '/api/brain/key',
  brainDelKey:   (id) => `/api/brain/key/${id}`,
  recentList:    '/api/recent',
  projectList:   '/api/project',
  projectCreate: '/api/project',
  shareCreate:   '/api/share',
  settingsPw:    '/api/settings/password',
  settingsDel:   '/api/settings/account',
  voiceSend:     '/api/voice',
  fileSend:      '/api/file',
  imageSend:     '/api/upload',
};

const $ = (s) => document.querySelector(s);

const chatMessages   = $('#chat-messages');
const msgInput       = $('#msg-input');
const btnSend        = $('#btn-send');
const btnAttach      = $('#btn-attach');
const btnMic         = $('#btn-mic');
const btnLeft        = $('#btn-left');
const btnRight       = $('#btn-right');
const menuLeft       = $('#menu-left');
const menuRight      = $('#menu-right');
const btnTheme       = $('#btn-theme');
const btnUserToggle  = $('#btn-user-toggle');
const userSub        = $('#user-sub');
const toast          = $('#toast');
const keysLeftEl     = $('#keys-left');
const keysRightEl    = $('#keys-right');
const fileInputImage = $('#file-input-image');
const fileInputFile  = $('#file-input-file');

let isSending = false;
let toastTimer = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentConversationId = null;
let authMode = 'login';

/* ═══ GUEST TOKEN ═══ */
function getGuestToken() { return localStorage.getItem('rongthan_guest_token'); }
function setGuestToken(t) {
  if (t) localStorage.setItem('rongthan_guest_token', t);
  else localStorage.removeItem('rongthan_guest_token');
}

/* ═══ FETCH HELPER ═══ */
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const guestToken = getGuestToken();
  if (guestToken) headers['X-Guest-Token'] = guestToken;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers, credentials: 'include' });
}

/* ═══ VIEWPORT ═══ */
function setupViewportHeight() {
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty('--vvh', vv.height + 'px');
      scrollToBottom();
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }
}

/* ═══ AUTO-RESIZE ═══ */
function autoResize() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 132) + 'px';
}

msgInput.addEventListener('input', autoResize);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* ═══ CHAT ═══ */
function scrollToBottom() {
  requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; });
}

function appendMessage(role, text, opts = {}) {
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  if (opts.pending) msg.classList.add('pending');
  if (opts.error) msg.classList.add('error');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'ai' ? '🐲' : '🦖';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatMessages.appendChild(msg);
  scrollToBottom();
  return msg;
}

function clearChat() { chatMessages.innerHTML = ''; }

async function sendMessage(overrideText, metadata = null) {
  if (isSending) return;

  const text = (overrideText != null ? overrideText : msgInput.value).trim();
  if (!text) return;

  appendMessage('user', text);
  if (overrideText == null) {
    msgInput.value = '';
    autoResize();
  }

  const pendingMsg = appendMessage('ai', 'Đang suy nghĩ', { pending: true });
  isSending = true;
  btnSend.disabled = true;

  try {
    const body = { message: text, conversationId: currentConversationId };
    if (metadata) {
      if (metadata.hasImage) {
        body.hasImage = true;
        body.imageDescription = metadata.imageDescription || '';
      }
      if (metadata.hasVoice) body.hasVoice = true;
      if (metadata.hasFile) {
        body.hasFile = true;
        body.fileName = metadata.fileName || '';
        body.fileType = metadata.fileType || '';
        body.fileText = metadata.fileText || '';
      }
    }

    const res = await apiFetch(API.chatSend, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    currentConversationId = data.conversationId;

    pendingMsg.remove();
    appendMessage('ai', data.reply || '(không có nội dung)');
    loadRecent();
  } catch (err) {
    pendingMsg.remove();
    appendMessage('ai', '⚠️ Lỗi: ' + (err.message || 'không xác định'), { error: true });
  } finally {
    isSending = false;
    btnSend.disabled = false;
  }
}

btnSend.addEventListener('click', () => sendMessage());

/* ═══ MENU ═══ */
function openMenu(side) {
  const menu = side === 'left' ? menuLeft : menuRight;
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeMenu(side) {
  const menu = side === 'left' ? menuLeft : menuRight;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  if (!menuLeft.classList.contains('open') && !menuRight.classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

btnLeft.addEventListener('click', () => openMenu('left'));
btnRight.addEventListener('click', () => openMenu('right'));

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeMenu(btn.dataset.close));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (menuLeft.classList.contains('open')) closeMenu('left');
    if (menuRight.classList.contains('open')) closeMenu('right');
  }
});

/* ═══ THEME ═══ */
function applyTheme(theme) {
  if (theme === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');
  localStorage.setItem('rongthan_theme', theme);
}

btnTheme.addEventListener('click', () => {
  const cur = document.body.classList.contains('light') ? 'light' : 'dark';
  applyTheme(cur === 'light' ? 'dark' : 'light');
});

applyTheme(localStorage.getItem('rongthan_theme') || 'dark');

/* ═══ USER MENU ═══ */
btnUserToggle.addEventListener('click', () => {
  userSub.classList.toggle('hidden');
  btnUserToggle.classList.toggle('active');
});

/* ═══ BRAIN KEYS ═══ */
function renderKeys(containerEl, keys) {
  containerEl.innerHTML = '';
  if (!keys || keys.length === 0) {
    containerEl.innerHTML = '<div class="menu-empty">Chưa có key</div>';
    return;
  }

  keys.forEach((key, i) => {
    const row = document.createElement('div');
    row.className = 'key-row';

    const top = document.createElement('div');
    top.className = 'key-row-top';

    const status = document.createElement('span');
    status.className = 'key-status';
    status.textContent = '🔥🐉';

    const provider = document.createElement('span');
    provider.className = 'key-provider';
    provider.textContent = key.provider || 'unknown';

    const index = document.createElement('span');
    index.className = 'key-index';
    index.textContent = '#' + (i + 1);

    const del = document.createElement('button');
    del.className = 'key-del';
    del.textContent = '✖️';
    del.addEventListener('click', () => deleteBrainKey(key.id));

    top.append(status, provider, index, del);

    const bottom = document.createElement('div');
    bottom.className = 'key-row-bottom';

    const bar = document.createElement('div');
    bar.className = 'key-bar';
    const fill = document.createElement('div');
    fill.className = 'key-fill';
    const pct = Math.max(0, Math.min(100, Number(key.quotaPercent) || 0));
    fill.style.width = pct + '%';
    bar.appendChild(fill);

    const pctEl = document.createElement('span');
    pctEl.className = 'key-pct';
    pctEl.textContent = pct + '%';

    bottom.append(bar, pctEl);
    row.append(top, bottom);
    containerEl.appendChild(row);
  });
}

async function loadKeys() {
  try {
    const res = await apiFetch(API.brainGetKeys);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderKeys(keysLeftEl, data.left || []);
    renderKeys(keysRightEl, data.right || []);
  } catch {
    renderKeys(keysLeftEl, []);
    renderKeys(keysRightEl, []);
  }
}

async function addBrainKey(side) {
  const inputEl = side === 'left' ? $('#input-left-key') : $('#input-right-key');
  const runBtn = side === 'left' ? $('#btn-run-left') : $('#btn-run-right');
  const key = inputEl.value.trim();
  if (!key) return showToast('Chưa dán key');

  runBtn.disabled = true;
  runBtn.textContent = '...';

  try {
    const res = await apiFetch(API.brainAddKey, {
      method: 'POST',
      body: JSON.stringify({ side, key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    inputEl.value = '';
    await loadKeys();
    showToast(`Đã thêm key ${side === 'left' ? 'Não trái' : 'Não phải'}`);
    if (data.warning) showToast(data.warning);
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = 'Run';
  }
}

async function deleteBrainKey(id) {
  if (!id) return;
  try {
    const res = await apiFetch(API.brainDelKey(id), { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadKeys();
    showToast('Đã xóa key');
  } catch (err) {
    showToast('Lỗi xóa: ' + err.message);
  }
}

$('#btn-run-left').addEventListener('click', () => addBrainKey('left'));
$('#btn-run-right').addEventListener('click', () => addBrainKey('right'));

/* ═══ RECENT + PROJECT ═══ */
async function loadRecent() {
  const list = $('#recent-list');
  try {
    const res = await apiFetch(API.recentList);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = data.items || [];

    list.innerHTML = '';
    if (items.length === 0) {
      list.innerHTML = '<div class="menu-empty">Chưa có cuộc trò chuyện</div>';
      return;
    }

    items.slice(0, 10).forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'menu-item sub';
      btn.textContent = item.title || 'Cuộc trò chuyện';
      btn.dataset.id = item.id;
      btn.addEventListener('click', () => openConversation(item.id));
      list.appendChild(btn);
    });
  } catch {
    list.innerHTML = '<div class="menu-empty">Không tải được</div>';
  }
}

async function loadProjects() {
  const list = $('#project-list');
  try {
    const res = await apiFetch(API.projectList);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = data.items || [];

    list.innerHTML = '';
    if (items.length === 0) {
      list.innerHTML = '<div class="menu-empty">Chưa có dự án</div>';
      return;
    }

    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'menu-item sub';
      btn.textContent = item.name || 'Dự án';
      btn.dataset.id = item.id;
      list.appendChild(btn);
    });
  } catch {
    list.innerHTML = '<div class="menu-empty">Không tải được</div>';
  }
}

async function openConversation(id) {
  try {
    const res = await apiFetch(API.chatHistory(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    currentConversationId = id;
    clearChat();

    (data.messages || []).forEach((m) => {
      appendMessage(m.role === 'user' ? 'user' : 'ai', m.text || '');
    });

    closeMenu('left');
  } catch (err) {
    showToast('Không mở được: ' + err.message);
  }
}

/* ═══ NEW CHAT ═══ */
$('#btn-new-chat').addEventListener('click', () => {
  currentConversationId = null;
  clearChat();
  appendMessage('ai', 'Xin chào! Ta là Rồng Thần. Ngươi cần gì?');
  closeMenu('left');
});

/* ═══ PROJECT MODAL ═══ */
const modalProject = $('#modal-project');
const projectNameInput = $('#project-name');
const projectDescInput = $('#project-desc');
const projectError = $('#project-error');

$('#btn-new-project').addEventListener('click', () => {
  modalProject.classList.remove('hidden');
  projectNameInput.value = '';
  projectDescInput.value = '';
  projectError.classList.add('hidden');
  projectNameInput.focus();
});

$('#project-close').addEventListener('click', () => modalProject.classList.add('hidden'));

$('#project-submit').addEventListener('click', async () => {
  const name = projectNameInput.value.trim();
  const description = projectDescInput.value.trim();

  if (!name) {
    projectError.textContent = 'Nhập tên dự án';
    projectError.classList.remove('hidden');
    return;
  }

  try {
    const res = await apiFetch(API.projectCreate, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    modalProject.classList.add('hidden');
    await loadProjects();
    showToast('Đã tạo dự án');
  } catch (err) {
    projectError.textContent = err.message;
    projectError.classList.remove('hidden');
  }
});

/* ═══ SHARE MODAL ═══ */
const modalShare = $('#modal-share');
const shareResult = $('#share-result');
const shareUrlInput = $('#share-url');

$('#btn-share').addEventListener('click', () => {
  if (!currentConversationId) {
    showToast('Chưa có cuộc trò chuyện để share');
    return;
  }
  modalShare.classList.remove('hidden');
  shareResult.classList.add('hidden');
  $('#share-submit').disabled = false;
  $('#share-submit').textContent = 'Tạo link';
});

$('#share-close').addEventListener('click', () => modalShare.classList.add('hidden'));

$('#share-submit').addEventListener('click', async () => {
  if (!currentConversationId) return;

  const btn = $('#share-submit');
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await apiFetch(API.shareCreate, {
      method: 'POST',
      body: JSON.stringify({ conversationId: currentConversationId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const fullUrl = window.location.origin + data.url;
    shareUrlInput.value = fullUrl;
    shareResult.classList.remove('hidden');
    btn.textContent = 'Đã tạo';
  } catch (err) {
    showToast('Lỗi: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Tạo link';
  }
});

$('#share-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrlInput.value);
    showToast('Đã copy link');
  } catch {
    shareUrlInput.select();
    showToast('Chọn và copy thủ công');
  }
});

/* ═══ SETTINGS MODAL ═══ */
const modalSettings = $('#modal-settings');

$('#btn-settings').addEventListener('click', async () => {
  try {
    const res = await apiFetch(API.authMe);
    if (!res.ok) {
      showToast('Cần đăng nhập để vào cài đặt');
      return;
    }
    modalSettings.classList.remove('hidden');
  } catch {
    showToast('Cần đăng nhập');
  }
});

$('#settings-close').addEventListener('click', () => modalSettings.classList.add('hidden'));

$('#settings-change-pw').addEventListener('click', async () => {
  const oldPassword = prompt('Mật khẩu cũ:');
  if (!oldPassword) return;
  const newPassword = prompt('Mật khẩu mới (6-128 ký tự):');
  if (!newPassword) return;

  try {
    const res = await apiFetch(API.settingsPw, {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    showToast('Đã đổi mật khẩu — vui lòng đăng nhập lại');
    modalSettings.classList.add('hidden');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
});

$('#settings-delete-account').addEventListener('click', async () => {
  if (!confirm('Xóa tài khoản vĩnh viễn? Không thể hoàn tác!')) return;

  try {
    const res = await apiFetch(API.settingsDel, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    showToast('Đã xóa tài khoản');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
});

/* ═══ AUTH MODAL ═══ */
const modalAuth = $('#modal-auth');
const authTitle = $('#auth-title');
const authUsername = $('#auth-username');
const authPassword = $('#auth-password');
const authError = $('#auth-error');
const authSubmit = $('#auth-submit');
const authSwitchText = $('#auth-switch');

function openAuthModal() {
  authTitle.textContent = authMode === 'login' ? 'Đăng nhập' : 'Đăng ký';
  authSubmit.textContent = authMode === 'login' ? 'Đăng nhập' : 'Đăng ký';
  authSwitchText.innerHTML = authMode === 'login'
    ? 'Chưa có tài khoản? <a href="#" id="auth-switch-link">Đăng ký</a>'
    : 'Đã có tài khoản? <a href="#" id="auth-switch-link">Đăng nhập</a>';
  document.getElementById('auth-switch-link').addEventListener('click', (e) => {
    e.preventDefault();
    authMode = authMode === 'login' ? 'register' : 'login';
    openAuthModal();
  });
  authUsername.value = '';
  authPassword.value = '';
  authError.classList.add('hidden');
  modalAuth.classList.remove('hidden');
  authUsername.focus();
}

$('#btn-login').addEventListener('click', () => {
  authMode = 'login';
  openAuthModal();
});

$('#auth-close').addEventListener('click', () => modalAuth.classList.add('hidden'));

authSubmit.addEventListener('click', async () => {
  const username = authUsername.value.trim();
  const password = authPassword.value;

  if (!username || !password) {
    authError.textContent = 'Nhập đủ username và password';
    authError.classList.remove('hidden');
    return;
  }

  authSubmit.disabled = true;
  authSubmit.textContent = '...';

  try {
    const url = authMode === 'login' ? API.authLogin : API.authRegister;
    const res = await apiFetch(url, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (authMode === 'register') {
      // Register thành công — KHÔNG auto login
      showToast(data.message || 'Đăng ký thành công — vui lòng đăng nhập');
      authMode = 'login';
      openAuthModal();
    } else {
      // Login thành công
      modalAuth.classList.add('hidden');
      showToast('Đã đăng nhập');
      closeMenu('left');
      loadKeys();
      loadRecent();
      loadProjects();
    }
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove('hidden');
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === 'login' ? 'Đăng nhập' : 'Đăng ký';
  }
});

/* ═══ LOGOUT ═══ */
$('#btn-logout').addEventListener('click', async () => {
  try {
    await apiFetch(API.authLogout, { method: 'POST' });
    showToast('Đã đăng xuất');
    closeMenu('left');
    setTimeout(() => location.reload(), 500);
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
});

/* ═══ GUEST MODE ═══ */
$('#btn-guest').addEventListener('click', async () => {
  if (getGuestToken()) {
    showToast('Đã ở chế độ khách');
    closeMenu('left');
    return;
  }

  try {
    const res = await apiFetch(API.guestCreate, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    setGuestToken(data.sessionToken);
    showToast('Đã vào chế độ khách');
    closeMenu('left');
    loadKeys();
    loadRecent();
    loadProjects();
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
});

/* ═══ ATTACH MODAL ═══ */
const modalAttach = $('#modal-attach');

btnAttach.addEventListener('click', () => modalAttach.classList.remove('hidden'));

$('#attach-close').addEventListener('click', () => modalAttach.classList.add('hidden'));

$('#attach-choose-image').addEventListener('click', () => {
  modalAttach.classList.add('hidden');
  fileInputImage.click();
});

$('#attach-choose-file').addEventListener('click', () => {
  modalAttach.classList.add('hidden');
  fileInputFile.click();
});

fileInputImage.addEventListener('change', () => {
  const file = fileInputImage.files[0];
  if (file) handleUpload(file, 'image');
  fileInputImage.value = '';
});

fileInputFile.addEventListener('change', () => {
  const file = fileInputFile.files[0];
  if (file) handleUpload(file, 'file');
  fileInputFile.value = '';
});

async function handleUpload(file, type) {
  const endpoint = type === 'image' ? API.imageSend : API.fileSend;
  const formData = new FormData();
  formData.append('file', file);

  const pendingMsg = appendMessage('ai', 'Đang xử lý', { pending: true });

  try {
    const res = await apiFetch(endpoint, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    pendingMsg.remove();

    const caption = msgInput.value.trim();
    const displayText = caption || (type === 'image' ? '[Ảnh]' : `[File: ${file.name}]`);
    msgInput.value = '';
    autoResize();

    const metadata = type === 'image'
      ? { hasImage: true, imageDescription: data.imageDescription || data.text }
      : { hasFile: true, fileName: data.fileName, fileType: data.fileType, fileText: data.fileText || data.text };

    await sendMessage(displayText, metadata);
  } catch (err) {
    pendingMsg.remove();
    appendMessage('ai', '⚠️ Lỗi: ' + err.message, { error: true });
  }
}

/* ═══ VOICE ═══ */
btnMic.addEventListener('click', toggleRecording);

async function toggleRecording() {
  if (isRecording) { stopRecording(); return; }

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('Trình duyệt không hỗ trợ ghi âm');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      await handleVoice(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;
    btnMic.classList.add('recording');

    setTimeout(() => {
      if (isRecording) {
        stopRecording();
        showToast('Đã đạt 60 giây tối đa — tự dừng');
      }
    }, 60000);
  } catch (err) {
    showToast('Không truy cập được mic: ' + err.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  isRecording = false;
  btnMic.classList.remove('recording');
}

async function handleVoice(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice.webm');

  const pendingMsg = appendMessage('ai', 'Đang nghe', { pending: true });

  try {
    const res = await apiFetch(API.voiceSend, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    pendingMsg.remove();

    if (data.text) {
      await sendMessage(data.text, { hasVoice: true });
    } else {
      appendMessage('ai', 'Không nhận diện được', { error: true });
    }
  } catch (err) {
    pendingMsg.remove();
    appendMessage('ai', '⚠️ Lỗi voice: ' + err.message, { error: true });
  }
}

/* ═══ DELETE CONVERSATION ═══ */
const modalDeleteConv = $('#modal-delete-conv');

$('#delete-conv-cancel').addEventListener('click', () => modalDeleteConv.classList.add('hidden'));

$('#delete-conv-confirm').addEventListener('click', async () => {
  if (!currentConversationId) return;

  try {
    const res = await apiFetch(API.chatDelete(currentConversationId), { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    modalDeleteConv.classList.add('hidden');
    currentConversationId = null;
    clearChat();
    appendMessage('ai', 'Xin chào! Ta là Rồng Thần. Ngươi cần gì?');
    showToast('Đã xóa cuộc trò chuyện');
    loadRecent();
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
});

/* ═══ TOAST ═══ */
function showToast(text) {
  toast.textContent = text;
  toast.classList.remove('hidden');
  void toast.offsetWidth;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 220);
  }, 2500);
}

/* ═══ INIT ═══ */
function init() {
  setupViewportHeight();
  autoResize();
  loadKeys();
  loadRecent();
  loadProjects();
}

init();