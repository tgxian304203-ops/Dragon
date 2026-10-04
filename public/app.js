/* ═══════════════════════════════════════════════════════════════
   🐉 RỒNG THẦN — FRONTEND LOGIC
   - Code block tách riêng (text + code + output)
   - Logo SVG cho nút Copy + Output
   - Voice press-and-hold + project
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
  projectDel:    (id) => `/api/project/${id}`,
  projectConvs:  (id) => `/api/project/${id}/conversations`,
  shareCreate:   '/api/share',
  settingsPw:    '/api/settings/password',
  settingsDel:   '/api/settings/account',
  voiceSend:     '/api/voice',
  fileSend:      '/api/file',
  imageSend:     '/api/upload',
};

const CHAO_AI = 'Nói điều ước đi 🔥🐉';

/* ═══ SVG LOGO ═══ */
const SVG_MOON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

const SVG_SUN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2"/>
  <path d="M12 20v2"/>
  <path d="m4.93 4.93 1.41 1.41"/>
  <path d="m17.66 17.66 1.41 1.41"/>
  <path d="M2 12h2"/>
  <path d="M20 12h2"/>
  <path d="m6.34 17.66-1.41 1.41"/>
  <path d="m19.07 4.93-1.41 1.41"/>
</svg>`;

const SVG_CLIPBOARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="2" width="6" height="4" rx="1"/>
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
</svg>`;

const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

const SVG_TERMINAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="4 17 10 11 4 5"/>
  <line x1="12" y1="19" x2="20" y2="19"/>
</svg>`;

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
const themeIcon      = $('#theme-icon');
const btnUserToggle  = $('#btn-user-toggle');
const userSub        = $('#user-sub');
const toast          = $('#toast');
const keysLeftEl     = $('#keys-left');
const keysRightEl    = $('#keys-right');
const fileInputImage = $('#file-input-image');
const fileInputFile  = $('#file-input-file');
const previewArea    = $('#preview-area');
const previewList    = $('#preview-list');

let isSending = false;
let toastTimer = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentConversationId = null;
let currentProjectId = null;
let authMode = 'login';
let isLoggedIn = false;

let pendingAttachments = [];
let attachmentIdCounter = 0;

/* ═══ GUEST TOKEN ═══ */
function getGuestToken() { return localStorage.getItem('rongthan_guest_token'); }
function setGuestToken(t) {
  if (t) localStorage.setItem('rongthan_guest_token', t);
  else localStorage.removeItem('rongthan_guest_token');
}

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

/**
 * [MỚI] Tạo khung code + output tách riêng.
 */
function createCodeBlock({ code, language, output }) {
  const block = document.createElement('div');
  block.className = 'code-block';

  // ─── Header ───
  const header = document.createElement('div');
  header.className = 'code-header';

  const lang = document.createElement('span');
  lang.className = 'code-lang';
  lang.textContent = (language || 'code').toUpperCase();
  header.appendChild(lang);

  // Nút Copy
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'code-copy';
  copyBtn.innerHTML = SVG_CLIPBOARD;

  copyBtn.onclick = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    copyCodeToClipboard(code, copyBtn);
  };

  header.appendChild(copyBtn);
  block.appendChild(header);

  // ─── Code content ───
  const pre = document.createElement('pre');
  pre.className = 'code-content';
  pre.textContent = code || '';
  block.appendChild(pre);

  // ─── Output ───
  if (output && String(output).trim() !== '') {
    const outWrap = document.createElement('div');
    outWrap.className = 'code-output';

    const outHeader = document.createElement('div');
    outHeader.className = 'code-output-header';
    outHeader.innerHTML = SVG_TERMINAL + '<span>Output</span>';

    const outContent = document.createElement('div');
    outContent.textContent = String(output).trim();

    outWrap.appendChild(outHeader);
    outWrap.appendChild(outContent);
    block.appendChild(outWrap);
  }

  return block;
}

/**
 * Copy code vào clipboard + đổi icon tạm thời.
 */
async function copyCodeToClipboard(code, btn) {
  try {
    await navigator.clipboard.writeText(code);
    btn.innerHTML = SVG_CHECK;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = SVG_CLIPBOARD;
      btn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    // Fallback: dùng textarea tạm
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      btn.innerHTML = SVG_CHECK;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = SVG_CLIPBOARD;
        btn.classList.remove('copied');
      }, 2000);
    } catch (e) {
      showToast('Không copy được');
    }
    document.body.removeChild(ta);
  }
}

/**
 * [SỬA] appendMessage — hỗ trợ hiển thị code + output tách riêng.
 */
function appendMessage(role, text, opts = {}) {
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  if (opts.pending) msg.classList.add('pending');
  if (opts.error) msg.classList.add('error');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'ai' ? '🐲' : '🦖';

  msg.appendChild(avatar);

  /* ═══ Nếu có code → tách text + code ═══ */
  const hasCode = opts.code && String(opts.code).trim() !== '';

  // Text bubble (chỉ hiện nếu có text)
  const cleanText = removeMarkdownCodeBlock(text);
  if (cleanText && cleanText.trim() !== '') {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = cleanText.trim();
    msg.appendChild(bubble);
  }

  // Code block (nếu có)
  if (hasCode) {
    const codeBlock = createCodeBlock({
      code: opts.code,
      language: opts.language,
      output: opts.output,
    });
    msg.appendChild(codeBlock);
  }

  chatMessages.appendChild(msg);
  scrollToBottom();
  return msg;
}

/**
 * Xóa phần code block khỏi text — vì đã tách ra khung riêng.
 * VD: "Đây là code:\n```python\n...\n```" → "Đây là code:"
 */
function removeMarkdownCodeBlock(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/```[\s\S]*?```/g, '')         // Bỏ ```...```
    .replace(/\*\*/g, '')                    // Bỏ ** đậm
    .replace(/\n{3,}/g, '\n\n')              // Gộp dòng trống
    .trim();
}

function clearChat() { chatMessages.innerHTML = ''; }

/* ═══ PREVIEW ═══ */
function renderPreview() {
  previewList.innerHTML = '';

  if (pendingAttachments.length === 0) {
    previewArea.classList.add('hidden');
    return;
  }

  previewArea.classList.remove('hidden');

  pendingAttachments.forEach((item) => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-item';

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.className = 'preview-thumb';
      img.src = item.previewUrl;
      img.alt = 'Ảnh';
      img.addEventListener('click', () => openDrawModal(item.id));
      wrap.appendChild(img);
    } else {
      const fileBox = document.createElement('div');
      fileBox.className = 'preview-file';

      const icon = document.createElement('div');
      icon.className = 'preview-file-icon';
      icon.textContent = '📄';

      const name = document.createElement('div');
      name.className = 'preview-file-name';
      name.textContent = item.file.name || 'file';

      fileBox.append(icon, name);
      wrap.appendChild(fileBox);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Xóa');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAttachment(item.id);
    });

    wrap.appendChild(removeBtn);
    previewList.appendChild(wrap);
  });
}

function removeAttachment(id) {
  const idx = pendingAttachments.findIndex((a) => a.id === id);
  if (idx === -1) return;

  const item = pendingAttachments[idx];
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);

  pendingAttachments.splice(idx, 1);
  renderPreview();
}

function clearAttachments() {
  pendingAttachments.forEach((a) => {
    if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
  });
  pendingAttachments = [];
  renderPreview();
}

function addAttachment(file, type) {
  const id = ++attachmentIdCounter;
  const previewUrl = type === 'image' ? URL.createObjectURL(file) : null;

  pendingAttachments.push({ id, file, type, previewUrl });
  renderPreview();
}

/* ═══ SEND MESSAGE ═══ */
async function sendMessage(overrideText, metadata = null) {
  if (isSending) return;

  const text = (overrideText != null ? overrideText : msgInput.value).trim();
  const hasAttachments = pendingAttachments.length > 0;
  if (!text && !hasAttachments && !metadata) return;

  const displayText = text || (hasAttachments ? `[${pendingAttachments.length} tệp]` : '');
  appendMessage('user', displayText);

  if (overrideText == null) {
    msgInput.value = '';
    autoResize();
  }

  const pendingMsg = appendMessage('ai', 'Đang suy nghĩ', { pending: true });
  isSending = true;
  btnSend.disabled = true;

  const attachmentsToSend = [...pendingAttachments];
  clearAttachments();

  try {
    const uploadedItems = [];

    for (const att of attachmentsToSend) {
      try {
        const formData = new FormData();
        formData.append('file', att.file);

        const endpoint = att.type === 'image' ? API.imageSend : API.fileSend;
        const upRes = await apiFetch(endpoint, { method: 'POST', body: formData });

        if (!upRes.ok) {
          const err = await upRes.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${upRes.status}`);
        }

        const upData = await upRes.json();

        if (att.type === 'image') {
          uploadedItems.push({
            type: 'image',
            imageDescription: upData.imageDescription || upData.text || '',
          });
        } else {
          uploadedItems.push({
            type: 'file',
            fileName: upData.fileName || att.file.name,
            fileType: upData.fileType || att.file.type,
            fileText: upData.fileText || upData.text || '',
          });
        }
      } catch (err) {
        console.warn('Upload attachment lỗi:', err.message);
      }
    }

    const body = {
      message: text || (uploadedItems.length > 0 ? `[${uploadedItems.length} tệp]` : ''),
      conversationId: currentConversationId,
    };

    if (currentProjectId && !currentConversationId) {
      body.projectId = currentProjectId;
    }

    const hasImage = uploadedItems.some((u) => u.type === 'image');
    const hasFile = uploadedItems.some((u) => u.type === 'file');

    if (hasImage) {
      const img = uploadedItems.find((u) => u.type === 'image');
      body.hasImage = true;
      body.imageDescription = img.imageDescription;
    }

    if (hasFile) {
      const f = uploadedItems.find((u) => u.type === 'file');
      body.hasFile = true;
      body.fileName = f.fileName;
      body.fileType = f.fileType;
      body.fileText = f.fileText;
    }

    if (metadata) {
      if (metadata.hasVoice) body.hasVoice = true;
      if (metadata.hasImage) {
        body.hasImage = true;
        body.imageDescription = metadata.imageDescription || body.imageDescription || '';
      }
      if (metadata.hasFile) {
        body.hasFile = true;
        body.fileName = metadata.fileName || body.fileName || '';
        body.fileType = metadata.fileType || body.fileType || '';
        body.fileText = metadata.fileText || body.fileText || '';
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

    /* ═══ [MỚI] Hiển thị AI message với code + output tách riêng ═══ */
    appendMessage('ai', data.reply || '', {
      code: data.code || null,
      language: data.language || null,
      output: data.output || null,
    });

    if (currentProjectId) {
      await loadProjectConvs(currentProjectId);
    } else {
      await loadRecent();
    }
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
  if (theme === 'light') {
    document.body.classList.add('light');
    if (themeIcon) themeIcon.innerHTML = SVG_SUN;
  } else {
    document.body.classList.remove('light');
    if (themeIcon) themeIcon.innerHTML = SVG_MOON;
  }
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

function updateUserMenu() {
  const btnLogin = $('#btn-login');
  const btnRegister = $('#btn-register');
  const btnGuest = $('#btn-guest');
  const btnLogout = $('#btn-logout');

  if (isLoggedIn) {
    btnLogin.classList.add('hidden');
    btnRegister.classList.add('hidden');
    btnGuest.classList.add('hidden');
    btnLogout.classList.remove('hidden');
  } else {
    btnLogin.classList.remove('hidden');
    btnRegister.classList.remove('hidden');
    btnGuest.classList.remove('hidden');
    btnLogout.classList.add('hidden');
  }
}

async function checkAuthStatus() {
  try {
    const res = await apiFetch(API.authMe);
    isLoggedIn = res.ok;
  } catch {
    isLoggedIn = false;
  }
  updateUserMenu();
}

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

/* ═══ XÓA PROJECT ═══ */
async function deleteProject(projectId, projectName = '') {
  if (!projectId) return;
  if (!confirm(`Xóa dự án "${projectName || 'này'}"?`)) return;

  try {
    const res = await apiFetch(API.projectDel(projectId), { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    showToast('Đã xóa dự án');

    if (currentProjectId === projectId) {
      currentProjectId = null;
      currentConversationId = null;
      clearChat();
      clearAttachments();
      appendMessage('ai', CHAO_AI);
    }

    await loadProjects();
  } catch (err) {
    showToast('Lỗi xóa dự án: ' + err.message);
  }
}

/* ═══ XÓA CONVERSATION ═══ */
async function deleteConversation(convId, title = '') {
  if (!convId) return;
  if (!confirm(`Xóa cuộc trò chuyện "${title || 'này'}"?`)) return;

  try {
    const res = await apiFetch(API.chatDelete(convId), { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    if (currentConversationId === convId) {
      currentConversationId = null;
      clearChat();
      clearAttachments();
      appendMessage('ai', CHAO_AI);
    }

    showToast('Đã xóa cuộc trò chuyện');

    if (currentProjectId) {
      await loadProjectConvs(currentProjectId);
    } else {
      await loadRecent();
    }
  } catch (err) {
    showToast('Lỗi xóa: ' + err.message);
  }
}

/* ═══ TẠO DÒNG MENU CÓ NÚT X ═══ */
function createMenuRow(label, onClick, onDelete) {
  const row = document.createElement('div');
  row.className = 'menu-row';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-row-btn';
  btn.textContent = label;

  btn.onclick = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof onClick === 'function') onClick();
  };

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'menu-row-del';
  del.textContent = '✕';
  del.setAttribute('aria-label', 'Xóa');

  del.onclick = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof onDelete === 'function') onDelete();
  };

  row.appendChild(btn);
  row.appendChild(del);

  return row;
}

/* ═══ RECENT ═══ */
async function loadRecent() {
  const list = $('#recent-list');
  currentProjectId = null;

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
      const row = createMenuRow(
        item.title || 'Cuộc trò chuyện',
        () => openConversation(item.id),
        () => deleteConversation(item.id, item.title),
      );
      list.appendChild(row);
    });
  } catch {
    list.innerHTML = '<div class="menu-empty">Không tải được</div>';
  }
}

/* ═══ PROJECTS ═══ */
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
      const row = createMenuRow(
        item.name || 'Dự án',
        () => openProject(item.id, item.name),
        () => deleteProject(item.id, item.name),
      );
      list.appendChild(row);
    });
  } catch {
    list.innerHTML = '<div class="menu-empty">Không tải được</div>';
  }
}

/* ═══ MỞ PROJECT ═══ */
async function openProject(projectId, projectName = '') {
  currentProjectId = projectId;
  currentConversationId = null;
  clearChat();
  clearAttachments();
  appendMessage('ai', CHAO_AI);

  await loadProjectConvs(projectId, projectName);
}

async function loadProjectConvs(projectId, projectName = '') {
  try {
    const res = await apiFetch(API.projectConvs(projectId));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const items = data.items || [];

    const list = $('#recent-list');
    list.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'menu-item sub';
    backBtn.textContent = '← Quay lại gần đây';
    backBtn.onclick = function () { loadRecent(); };
    list.appendChild(backBtn);

    const titleEl = document.createElement('div');
    titleEl.className = 'menu-empty';
    titleEl.style.fontStyle = 'normal';
    titleEl.style.color = 'var(--accent)';
    titleEl.textContent = `📁 ${projectName || data.project?.name || 'Dự án'}`;
    list.appendChild(titleEl);

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'menu-empty';
      empty.textContent = 'Chưa có cuộc trò chuyện — gõ tin nhắn để tạo';
      list.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = createMenuRow(
        item.title || 'Cuộc trò chuyện',
        () => {
          openConversation(item.id);
          closeMenu('left');
        },
        () => deleteConversation(item.id, item.title),
      );
      list.appendChild(row);
    });
  } catch (err) {
    showToast('Không mở được dự án: ' + err.message);
  }
}

async function openConversation(id) {
  try {
    const res = await apiFetch(API.chatHistory(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    currentConversationId = id;

    if (data.conversation && data.conversation.projectId) {
      currentProjectId = data.conversation.projectId;
    }

    clearChat();

    (data.messages || []).forEach((m) => {
      appendMessage(m.role === 'user' ? 'user' : 'ai', m.text || '', {
        code: m.code || null,
        language: m.language || null,
        output: m.output || null,
      });
    });

    closeMenu('left');
  } catch (err) {
    showToast('Không mở được: ' + err.message);
  }
}

/* ═══ NEW CHAT ═══ */
$('#btn-new-chat').addEventListener('click', () => {
  currentConversationId = null;
  currentProjectId = null;
  clearChat();
  clearAttachments();
  appendMessage('ai', CHAO_AI);
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

$('#btn-register').addEventListener('click', () => {
  authMode = 'register';
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
      showToast(data.message || 'Đăng ký thành công — vui lòng đăng nhập');
      authMode = 'login';
      openAuthModal();
    } else {
      modalAuth.classList.add('hidden');
      showToast('Đã đăng nhập');
      closeMenu('left');
      isLoggedIn = true;
      updateUserMenu();
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
    isLoggedIn = false;
    updateUserMenu();
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
  const files = Array.from(fileInputImage.files || []);
  files.forEach((f) => addAttachment(f, 'image'));
  fileInputImage.value = '';
});

fileInputFile.addEventListener('change', () => {
  const files = Array.from(fileInputFile.files || []);
  files.forEach((f) => addAttachment(f, 'file'));
  fileInputFile.value = '';
});

/* ═══════════════════════════════════════════════════════════════
   VOICE — GIỮ MIC ĐỂ GHI, THẢ TAY DỪNG
   ═══════════════════════════════════════════════════════════════ */

let voiceStartTime = 0;
let isVoiceProcessing = false;

function startVoiceRecording(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (isRecording || isVoiceProcessing) return;

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('Trình duyệt không hỗ trợ ghi âm');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunks.push(ev.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await handleVoiceToText(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      voiceStartTime = Date.now();
      btnMic.classList.add('recording');
    })
    .catch((err) => {
      showToast('Không truy cập được mic: ' + err.message);
    });
}

function stopVoiceRecording(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (!isRecording) return;

  const duration = Date.now() - voiceStartTime;
  if (duration < 500) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    btnMic.classList.remove('recording');
    audioChunks = [];
    return;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  btnMic.classList.remove('recording');
}

async function handleVoiceToText(audioBlob) {
  if (!audioBlob || audioBlob.size === 0) return;

  isVoiceProcessing = true;
  btnMic.classList.add('recording');

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');

    const res = await apiFetch(API.voiceSend, { method: 'POST', body: formData });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.text && data.text.trim()) {
      const existing = msgInput.value.trim();
      msgInput.value = existing ? existing + ' ' + data.text.trim() : data.text.trim();
      autoResize();
      msgInput.focus();
    } else {
      showToast('Không nhận diện được giọng nói');
    }
  } catch (err) {
    showToast('Lỗi voice: ' + err.message);
  } finally {
    isVoiceProcessing = false;
    btnMic.classList.remove('recording');
  }
}

btnMic.addEventListener('pointerdown', startVoiceRecording);
btnMic.addEventListener('pointerup', stopVoiceRecording);
btnMic.addEventListener('pointercancel', stopVoiceRecording);
btnMic.addEventListener('pointerleave', stopVoiceRecording);
btnMic.addEventListener('contextmenu', (e) => e.preventDefault());

/* ═══ MODAL VẼ ẢNH ═══ */
const modalDraw = $('#modal-draw');
const drawCanvas = $('#draw-canvas');
const drawUndo = $('#draw-undo');
const drawEraser = $('#draw-eraser');
const drawDone = $('#draw-done');
const drawCancel = $('#draw-cancel');
const drawTools = document.querySelectorAll('.draw-tool');

let canvasCtx = null;
let currentAttachmentId = null;
let currentColor = '#ef4444';
let isEraser = false;
let currentImage = null;
let strokes = [];
let currentStroke = null;
let isDrawing = false;

function openDrawModal(attachmentId) {
  const att = pendingAttachments.find((a) => a.id === attachmentId);
  if (!att || att.type !== 'image') {
    showToast('Không tìm thấy ảnh');
    return;
  }

  currentAttachmentId = attachmentId;
  strokes = [];
  currentStroke = null;
  isEraser = false;
  isDrawing = false;
  drawEraser.classList.remove('active');

  const img = new Image();

  img.onload = () => {
    currentImage = img;

    const wrap = drawCanvas.parentElement;
    const wrapW = wrap.clientWidth || window.innerWidth;
    const wrapH = wrap.clientHeight || (window.innerHeight - 120);
    const ratio = Math.min(wrapW / img.width, wrapH / img.height);

    const w = Math.max(1, Math.floor(img.width * ratio));
    const h = Math.max(1, Math.floor(img.height * ratio));

    drawCanvas.width = w;
    drawCanvas.height = h;
    drawCanvas.style.width = w + 'px';
    drawCanvas.style.height = h + 'px';

    canvasCtx = drawCanvas.getContext('2d');
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';

    redrawAll();
    modalDraw.classList.remove('hidden');
  };

  img.onerror = (e) => {
    console.error('Load ảnh lỗi:', e);
    showToast('Không tải được ảnh');
  };

  img.src = att.previewUrl;
}

function redrawAll() {
  if (!canvasCtx || !currentImage) return;

  canvasCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  canvasCtx.drawImage(currentImage, 0, 0, drawCanvas.width, drawCanvas.height);

  canvasCtx.lineCap = 'round';
  canvasCtx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    canvasCtx.strokeStyle = stroke.color;
    canvasCtx.lineWidth = stroke.width;
    canvasCtx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';

    canvasCtx.beginPath();
    canvasCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      canvasCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    canvasCtx.stroke();
  }

  canvasCtx.globalCompositeOperation = 'source-over';
}

function drawStrokeSegment(stroke, fromIdx) {
  if (!canvasCtx) return;
  const pts = stroke.points;
  if (pts.length < 2) return;

  canvasCtx.strokeStyle = stroke.color;
  canvasCtx.lineWidth = stroke.width;
  canvasCtx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';

  canvasCtx.beginPath();
  const start = Math.max(0, fromIdx);
  canvasCtx.moveTo(pts[start].x, pts[start].y);
  for (let i = start + 1; i < pts.length; i++) {
    canvasCtx.lineTo(pts[i].x, pts[i].y);
  }
  canvasCtx.stroke();

  canvasCtx.globalCompositeOperation = 'source-over';
}

function getCanvasPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (drawCanvas.width / rect.width),
    y: (e.clientY - rect.top) * (drawCanvas.height / rect.height),
  };
}

function onPointerDown(e) {
  if (!canvasCtx) return;
  e.preventDefault();

  try { drawCanvas.setPointerCapture(e.pointerId); } catch (_) {}

  isDrawing = true;
  const pos = getCanvasPos(e);

  const baseWidth = Math.max(3, Math.round(drawCanvas.width / 100));
  const width = isEraser ? baseWidth * 3 : baseWidth;

  currentStroke = {
    color: isEraser ? '#000000' : currentColor,
    width,
    eraser: isEraser,
    points: [pos],
  };
  strokes.push(currentStroke);
}

function onPointerMove(e) {
  if (!isDrawing || !currentStroke) return;
  e.preventDefault();

  const pos = getCanvasPos(e);
  const prevLen = currentStroke.points.length;
  currentStroke.points.push(pos);

  drawStrokeSegment(currentStroke, prevLen - 1);
}

function onPointerUp(e) {
  if (!isDrawing) return;
  e.preventDefault();
  isDrawing = false;
  currentStroke = null;
}

drawCanvas.addEventListener('pointerdown', onPointerDown);
drawCanvas.addEventListener('pointermove', onPointerMove);
drawCanvas.addEventListener('pointerup', onPointerUp);
drawCanvas.addEventListener('pointercancel', onPointerUp);
drawCanvas.addEventListener('pointerleave', onPointerUp);

drawTools.forEach((tool) => {
  tool.addEventListener('click', () => {
    drawTools.forEach((t) => t.classList.remove('active'));
    tool.classList.add('active');
    currentColor = tool.dataset.color || '#ef4444';
    isEraser = false;
    drawEraser.classList.remove('active');
  });
});

drawEraser.addEventListener('click', () => {
  isEraser = !isEraser;
  drawEraser.classList.toggle('active', isEraser);
  if (isEraser) {
    drawTools.forEach((t) => t.classList.remove('active'));
  } else {
    const firstTool = document.querySelector('.draw-tool');
    if (firstTool) {
      firstTool.classList.add('active');
      currentColor = firstTool.dataset.color || '#ef4444';
    }
  }
});

drawUndo.addEventListener('click', () => {
  if (strokes.length === 0) return;
  strokes.pop();
  redrawAll();
});

drawCancel.addEventListener('click', () => {
  modalDraw.classList.add('hidden');
  currentAttachmentId = null;
  strokes = [];
  currentStroke = null;
  isDrawing = false;
  currentImage = null;
});

drawDone.addEventListener('click', () => {
  if (!currentAttachmentId || !canvasCtx) return;

  drawCanvas.toBlob((blob) => {
    if (!blob) {
      showToast('Không xuất được ảnh');
      return;
    }

    const idx = pendingAttachments.findIndex((a) => a.id === currentAttachmentId);
    if (idx === -1) {
      showToast('Không tìm thấy ảnh');
      return;
    }

    const oldItem = pendingAttachments[idx];
    const newFileName = (oldItem.file.name || 'image').replace(/\.[^.]+$/, '') + '-edited.png';
    const newFile = new File([blob], newFileName, { type: 'image/png' });

    if (oldItem.previewUrl) URL.revokeObjectURL(oldItem.previewUrl);

    const newPreviewUrl = URL.createObjectURL(blob);

    pendingAttachments[idx] = {
      id: oldItem.id,
      file: newFile,
      type: 'image',
      previewUrl: newPreviewUrl,
    };

    renderPreview();
    modalDraw.classList.add('hidden');
    currentAttachmentId = null;
    strokes = [];
    currentStroke = null;
    currentImage = null;
    isDrawing = false;
    showToast('Đã lưu ảnh vẽ');
  }, 'image/png');
});

/* ═══ DELETE CONVERSATION MODAL ═══ */
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
    clearAttachments();
    appendMessage('ai', CHAO_AI);
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
async function init() {
  setupViewportHeight();
  autoResize();
  await checkAuthStatus();
  loadKeys();
  loadRecent();
  loadProjects();
}

init();