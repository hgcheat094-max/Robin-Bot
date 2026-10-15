/* Gemini Chat: browser app. No framework, no build step. */
(function () {
  'use strict';

  /* ================================================================== */
  /* Helpers                                                             */
  /* ================================================================== */

  const $ = (sel, root = document) => root.querySelector(sel);
  const uid = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  const ICONS = {
    logo: '<path d="M12 3c.5 4.4 2.3 7.2 8.5 8.5-6.2 1.5-8 4.2-8.5 8.5-.5-4.3-2.3-7-8.5-8.5C9.7 10.2 11.5 7.4 12 3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    newchat: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z"/>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    arrowdown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    up: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    down: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>'
  };

  const icon = (name, size = 20) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  function hydrateIcons(root) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20);
    });
  }

  // Minimal element builder. Text children are always added as text nodes.
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const LS = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    }
  };

  const dataUrl = (img) => `data:${img.mime};base64,${img.data}`;
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall back below */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  /* ================================================================== */
  /* State                                                               */
  /* ================================================================== */

  const MAX_IMAGES = 4;
  const MAX_HISTORY = 40;
  const IMAGE_BUDGET = 4200000; // total base64 characters of images per request (Netlify allows ~6 MB bodies)
  const TITLE_MAX = 48;

  const state = {
    config: {
      app: 'Gemini Chat',
      models: [{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', description: '' }],
      defaultModel: 'gemini-3.8-flash',
      requiresAccessCode: false,
      smartTitles: true
    },
    conversations: [],
    draft: null,
    currentId: null,
    model: null,
    streaming: null, // { convId, msgId, abort }
    pending: [], // attached images waiting to be sent: { id, mime, data }
    preparing: 0,
    stick: true,
    persistOK: true
  };

  const settings = {
    theme: LS.get('theme', 'system'),
    customInstructions: LS.get('customInstructions', ''),
    accessCode: LS.get('accessCode', '')
  };

  const root = document.documentElement;
  const el = {
    sidebar: $('#sidebar'),
    chatList: $('#chat-list'),
    main: $('#main'),
    thread: $('#thread'),
    threadInner: $('#thread-inner'),
    prompt: $('#prompt'),
    composer: $('#composer'),
    sendBtn: $('#send-btn'),
    attachBtn: $('#attach-btn'),
    fileInput: $('#file-input'),
    attachments: $('#attachments'),
    modelBtn: $('#model-btn'),
    modelLabel: $('#model-label'),
    scrollBtn: $('#scroll-btn'),
    banner: $('#banner'),
    chips: $('#chips'),
    disclaimer: $('#disclaimer'),
    overlayRoot: $('#overlay-root'),
    toastRoot: $('#toast-root'),
    dropOverlay: $('#drop-overlay')
  };

  const currentConv = () => state.conversations.find((c) => c.id === state.currentId) || state.draft;
  const modelInfo = (id) => state.config.models.find((m) => m.id === id);
  const modelLabel = (id) => (modelInfo(id) ? modelInfo(id).label : id || 'Gemini');

  function newConversation() {
    return { id: uid(), title: 'New chat', titleAuto: true, createdAt: Date.now(), updatedAt: Date.now(), model: state.model, messages: [] };
  }

  /* ================================================================== */
  /* Persistence (IndexedDB)                                             */
  /* ================================================================== */

  const DB = (() => {
    let dbPromise = null;
    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open('gemini-chat', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('conversations', { keyPath: 'id' });
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch { resolve(null); }
      });
      return dbPromise;
    }
    async function run(mode, fn) {
      const db = await open();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('conversations', mode);
          const request = fn(tx.objectStore('conversations'));
          tx.oncomplete = () => resolve(request && request.result !== undefined ? request.result : true);
          tx.onerror = tx.onabort = () => resolve(null);
        } catch { resolve(null); }
      });
    }
    return {
      all: () => run('readonly', (s) => s.getAll()),
      put: (c) => run('readwrite', (s) => s.put(c)),
      del: (id) => run('readwrite', (s) => s.delete(id)),
      clear: () => run('readwrite', (s) => s.clear())
    };
  })();

  function persist(conv) {
    if (!state.persistOK || !state.conversations.includes(conv)) return;
    DB.put(conv).then((ok) => {
      if (ok === null && state.persistOK) {
        state.persistOK = false;
        toast('Chats can’t be saved in this browser (private mode?). They will be lost when you close the tab.', 6000);
      }
    });
  }

  /* ================================================================== */
  /* Toasts, menus, modals                                               */
  /* ================================================================== */

  function toast(message, ms = 3200) {
    const t = h('div', { class: 'toast' }, message);
    el.toastRoot.append(t);
    setTimeout(() => t.remove(), ms);
  }

  let menuState = null;
  function closeMenu() {
    if (!menuState) return;
    const s = menuState;
    menuState = null;
    s.menu.remove();
    s.anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', s.outside, true);
    document.removeEventListener('keydown', s.key, true);
    window.removeEventListener('resize', closeMenu);
    if (s.onClose) s.onClose();
  }

  function toggleMenu(anchor, items, opts = {}) {
    if (menuState && menuState.anchor === anchor) { closeMenu(); return; }
    closeMenu();
    const menu = h('div', { class: 'menu', role: 'menu' });
    for (const it of items) {
      if (it.separator) { menu.append(h('div', { class: 'menu-sep' })); continue; }
      menu.append(
        h('button', {
          class: 'menu-item' + (it.danger ? ' danger' : ''), type: 'button', role: 'menuitem',
          onclick: () => { closeMenu(); if (it.onClick) it.onClick(); }
        },
        it.icon ? h('span', { html: icon(it.icon, 18) }) : null,
        h('span', { class: 'grow' }, it.label, it.description ? h('span', { class: 'desc' }, it.description) : null),
        it.checked ? h('span', { html: icon('check', 18) }) : null)
      );
    }
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = opts.align === 'right' ? r.right - mw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    anchor.setAttribute('aria-expanded', 'true');

    const outside = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) closeMenu(); };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); anchor.focus(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items2 = Array.from(menu.querySelectorAll('.menu-item'));
        const i = items2.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items2.length : (i - 1 + items2.length) % items2.length;
        items2[next].focus();
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', closeMenu);
    menuState = { menu, anchor, outside, key, onClose: opts.onClose };
    const first = menu.querySelector('.menu-item');
    if (first) first.focus();
  }

  const modalStack = [];
  function openModal({ title, body, wide = false, top = false, bare = false, onClose }) {
    closeMenu();
    const previous = document.activeElement;
    const backdrop = h('div', { class: 'modal-backdrop' + (top ? ' top' : '') });
    const modal = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog', tabindex: '-1' });
    const api = { el: modal, close };
    function close() {
      const i = modalStack.indexOf(api);
      if (i === -1) return;
      modalStack.splice(i, 1);
      backdrop.remove();
      if (previous && document.contains(previous)) previous.focus();
      if (onClose) onClose();
    }
    if (title) {
      modal.append(h('div', { class: 'modal-head' },
        h('h2', null, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', html: icon('x', 20), onclick: close })));
    }
    modal.append(bare ? body : h('div', { class: 'modal-body' }, body));
    backdrop.append(modal);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    el.overlayRoot.append(backdrop);
    modalStack.push(api);
    const focusTarget = modal.querySelector('[autofocus], input, textarea') || modal.querySelector('button.btn') || modal;
    focusTarget.focus();
    return api;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) {
      e.preventDefault();
      modalStack[modalStack.length - 1].close();
    }
  });

  function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const body = h('div', null,
        h('p', null, message),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => { done(false); m.close(); } }, 'Cancel'),
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', autofocus: true, onclick: () => { done(true); m.close(); } }, confirmLabel)));
      const m = openModal({ title, body, onClose: () => done(false) });
    });
  }

  function askAccessCode(message) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const input = h('input', { class: 'input', type: 'password', placeholder: 'Access code', autocomplete: 'current-password', 'aria-label': 'Access code', autofocus: true });
      const form = h('form', {
        onsubmit: (e) => {
          e.preventDefault();
          const v = input.value.trim();
          if (v) { done(v); m.close(); }
        }
      },
      h('p', null, message || 'This site is protected. Enter the access code to continue.'),
      h('div', { class: 'field' }, input),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { done(null); m.close(); } }, 'Cancel'),
        h('button', { class: 'btn primary', type: 'submit' }, 'Continue')));
      const m = openModal({ title: 'Access code', body: form, onClose: () => done(null) });
    });
  }

  function openLightbox(src) {
    const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Image preview' }, h('img', { src, alt: 'Image preview' }));
    const close = () => { box.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    box.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    document.body.append(box);
  }

  /* ================================================================== */
  /* Theme and sidebar                                                   */
  /* ================================================================== */

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const dark = settings.theme === 'dark' || (settings.theme !== 'light' && darkQuery.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#212121' : '#ffffff');
  }
  darkQuery.addEventListener('change', () => { if (settings.theme === 'system') applyTheme(); });

  function openSidebar() {
    if (isMobile()) root.classList.add('sidebar-open');
    else { root.classList.remove('sidebar-collapsed'); LS.set('sidebarCollapsed', false); }
  }
  function closeSidebar() {
    if (isMobile()) root.classList.remove('sidebar-open');
    else { root.classList.add('sidebar-collapsed'); LS.set('sidebarCollapsed', true); }
  }

  /* ================================================================== */
  /* Sidebar rendering                                                   */
  /* ================================================================== */

  function groupLabel(ts) {
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(ts))) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days <= 7) return 'Previous 7 days';
    if (days <= 30) return 'Previous 30 days';
    return new Date(ts).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  function sortConversations() {
    state.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function renderSidebar() {
    el.chatList.textContent = '';
    if (!state.conversations.length) {
      el.chatList.append(h('div', { class: 'empty-note' }, 'No chats yet'));
      return;
    }
    let last = null;
    for (const conv of state.conversations) {
      const label = groupLabel(conv.updatedAt);
      if (label !== last) { el.chatList.append(h('div', { class: 'group-label' }, label)); last = label; }
      el.chatList.append(chatItem(conv));
    }
  }

  function chatItem(conv) {
    const active = conv.id === state.currentId;
    const item = h('div', { class: 'chat-item' + (active ? ' active' : ''), dataset: { id: conv.id } });
    const title = h('button', {
      class: 'title', type: 'button', title: conv.title, 'aria-current': active ? 'page' : null,
      onclick: () => showConversation(conv.id)
    }, conv.title);
    const more = h('button', {
      class: 'more', type: 'button', 'aria-label': 'Conversation options', 'aria-haspopup': 'menu', html: icon('more', 18),
      onclick: (e) => {
        e.stopPropagation();
        item.classList.add('menu-open');
        toggleMenu(more, [
          { label: 'Rename', icon: 'edit', onClick: () => startRename(conv, item) },
          { label: 'Delete', icon: 'trash', danger: true, onClick: () => deleteConversation(conv) }
        ], { align: 'right', onClose: () => item.classList.remove('menu-open') });
      }
    });
    item.append(title, more);
    return item;
  }

  function startRename(conv, item) {
    const titleEl = $('.title', item);
    if (!titleEl) return;
    const input = h('input', { class: 'rename', value: conv.title, maxlength: '100', 'aria-label': 'Rename chat' });
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    let finished = false;
    const finish = (save) => {
      if (finished) return;
      finished = true;
      const v = input.value.trim();
      if (save && v && v !== conv.title) { conv.title = v.slice(0, 100); conv.titleAuto = false; persist(conv); }
      renderSidebar();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  async function deleteConversation(conv) {
    const ok = await confirmDialog({
      title: 'Delete chat?',
      message: `This will permanently delete “${conv.title}” from this browser.`,
      confirmLabel: 'Delete',
      danger: true
    });
    if (!ok) return;
    if (state.streaming && state.streaming.convId === conv.id) stopStreaming();
    state.conversations = state.conversations.filter((c) => c.id !== conv.id);
    await DB.del(conv.id);
    if (state.currentId === conv.id) newChat();
    else renderSidebar();
  }

  /* ================================================================== */
  /* Thread rendering                                                    */
  /* ================================================================== */

  const isStreamingMsg = (m) => Boolean(state.streaming && state.streaming.msgId === m.id);

  function actionBtn(label, iconName, onClick, on = false) {
    return h('button', { class: 'act' + (on ? ' on' : ''), type: 'button', 'aria-label': label, title: label, html: icon(iconName, 18), onclick: onClick });
  }

  function flashCopied(btn, text) {
    copyText(text).then((ok) => {
      if (!ok) { toast('Couldn’t copy to the clipboard.'); return; }
      btn.innerHTML = icon('check', 18);
      setTimeout(() => { btn.innerHTML = icon('copy', 18); }, 1500);
    });
  }

  function userMessageEl(conv, m) {
    const node = h('article', { class: 'msg user', dataset: { id: m.id } });
    if (m.images && m.images.length) {
      node.append(h('div', { class: 'msg-images' },
        m.images.map((img) => h('img', { src: dataUrl(img), alt: 'Attached image', onclick: () => openLightbox(dataUrl(img)) }))));
    }
    if (m.text) node.append(h('div', { class: 'bubble' }, m.text));
    const copyBtn = actionBtn('Copy message', 'copy', () => flashCopied(copyBtn, m.text || ''));
    node.append(h('div', { class: 'msg-actions' }, copyBtn, actionBtn('Edit message', 'edit', () => startEdit(conv, m))));
    return node;
  }

  function appendDot(prose) {
    const dot = h('span', { class: 'stream-dot', 'aria-hidden': 'true' });
    let target = prose;
    for (;;) {
      const last = target.lastElementChild;
      if (last && /^(UL|OL|LI|BLOCKQUOTE|P|H[1-6])$/.test(last.tagName)) target = last;
      else break;
    }
    target.append(dot);
  }

  function finishNote(m) {
    const f = m.finish;
    if (m.stopped || !f || f === 'STOP') return null;
    if (f === 'MAX_TOKENS') return 'The response reached the length limit and was cut off.';
    if (f === 'INTERRUPTED') return 'The response was interrupted. Use Regenerate to try again.';
    if (f === 'SAFETY') return 'Part of this response was stopped by Gemini’s safety filters.';
    if (f === 'RECITATION') return 'The response was stopped because it closely matched existing material.';
    return `The response stopped early (${f}).`;
  }

  function assistantMessageEl(conv, m, isLast) {
    const node = h('article', { class: 'msg assistant' + (isLast ? ' is-last' : ''), dataset: { id: m.id } });
    const prose = h('div', { class: 'prose' });
    prose.innerHTML = MD.render(m.text || '');
    node.append(prose);

    if (isStreamingMsg(m)) {
      appendDot(prose);
      return node;
    }

    if (m.error) {
      node.append(h('div', { class: 'msg-error', role: 'alert' },
        h('span', { html: icon('alert', 18) }),
        h('div', { class: 'grow' }, m.error),
        isLast ? h('button', { type: 'button', onclick: () => regenerate(m.id) }, 'Retry') : null));
    }
    const note = finishNote(m);
    if (note) node.append(h('div', { class: 'msg-note' }, note));
    if (m.stopped && !m.text) node.append(h('div', { class: 'msg-note' }, 'Response stopped.'));

    if (m.text || m.error || m.stopped) {
      const copyBtn = actionBtn('Copy response', 'copy', () => flashCopied(copyBtn, m.text || ''));
      const actions = h('div', { class: 'msg-actions' }, copyBtn);
      const fb = (value, iconName, label) =>
        actionBtn(label, iconName, () => {
          m.feedback = m.feedback === value ? null : value;
          persist(conv);
          replaceMessage(conv, m);
          if (m.feedback) toast('Thanks for the feedback.', 1800);
        }, m.feedback === value);
      actions.append(fb('up', 'up', 'Good response'), fb('down', 'down', 'Bad response'));
      if (isLast) actions.append(actionBtn('Regenerate', 'refresh', () => regenerate(m.id)));
      if (m.model) actions.append(h('span', { class: 'msg-model' }, modelLabel(m.model)));
      node.append(actions);
    }
    return node;
  }

  function messageEl(conv, m, isLast) {
    return m.role === 'user' ? userMessageEl(conv, m) : assistantMessageEl(conv, m, isLast);
  }

  function renderThread(conv) {
    el.threadInner.textContent = '';
    const lastIndex = conv.messages.length - 1;
    conv.messages.forEach((m, i) => el.threadInner.append(messageEl(conv, m, i === lastIndex)));
    updateMainState();
  }

  function findMessageEl(id) {
    return el.threadInner.querySelector(`[data-id="${CSS.escape(id)}"]`);
  }

  function replaceMessage(conv, m) {
    const node = findMessageEl(m.id);
    if (!node) return;
    const isLast = conv.messages[conv.messages.length - 1] === m;
    node.replaceWith(messageEl(conv, m, isLast));
  }

  // When a new reply is added, the previous last reply loses its "Regenerate" button.
  function refreshLastAssistant(conv) {
    const prev = conv.messages[conv.messages.length - 1];
    if (prev && prev.role === 'assistant') {
      const node = findMessageEl(prev.id);
      if (node) node.replaceWith(assistantMessageEl(conv, prev, false));
    }
  }

  function updateMainState() {
    const conv = currentConv();
    const empty = !conv || conv.messages.length === 0;
    el.main.classList.toggle('is-empty', empty);
    if (empty) el.scrollBtn.hidden = true;
  }

  function maybeScroll() {
    if (state.stick) el.thread.scrollTop = el.thread.scrollHeight;
  }
  function forceScroll() {
    state.stick = true;
    el.thread.scrollTop = el.thread.scrollHeight;
    el.scrollBtn.hidden = true;
  }

  el.thread.addEventListener('scroll', () => {
    const gap = el.thread.scrollHeight - el.thread.scrollTop - el.thread.clientHeight;
    state.stick = gap < 80;
    el.scrollBtn.hidden = state.stick || el.main.classList.contains('is-empty');
  }, { passive: true });
  el.scrollBtn.addEventListener('click', forceScroll);

  el.threadInner.addEventListener('click', (e) => {
    const btn = e.target.closest('.copy-code');
    if (!btn) return;
    const code = btn.closest('.code-block').querySelector('code').textContent;
    copyText(code).then((ok) => {
      const label = btn.querySelector('.copy-label');
      label.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => { label.textContent = 'Copy code'; }, 1600);
    });
  });

  /* ================================================================== */
  /* Conversations: open / new                                           */
  /* ================================================================== */

  function setHash(id) {
    try { history.replaceState(null, '', id ? '#/c/' + id : location.pathname + location.search); } catch { /* ignore */ }
  }

  function updateModelLabel() {
    el.modelLabel.textContent = modelLabel(state.model);
  }

  function newChat() {
    stopStreaming();
    if (!state.draft) state.draft = newConversation();
    state.draft.model = state.model;
    state.currentId = state.draft.id;
    renderThread(state.draft);
    renderSidebar();
    setHash(null);
    if (isMobile()) root.classList.remove('sidebar-open');
    el.prompt.focus();
  }

  function showConversation(id) {
    const conv = state.conversations.find((c) => c.id === id);
    if (!conv) { newChat(); return; }
    if (state.currentId !== id) stopStreaming();
    state.currentId = id;
    if (conv.model && modelInfo(conv.model)) { state.model = conv.model; updateModelLabel(); }
    renderThread(conv);
    renderSidebar();
    forceScroll();
    setHash(id);
    if (isMobile()) root.classList.remove('sidebar-open');
  }

  function addToList(conv) {
    if (!state.conversations.includes(conv)) {
      state.conversations.unshift(conv);
      if (state.draft === conv) state.draft = null;
    }
  }

  function deriveTitle(text, images) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (clean) return clean.length > TITLE_MAX ? clean.slice(0, TITLE_MAX).trimEnd() + '…' : clean;
    return images && images.length ? 'Image chat' : 'New chat';
  }

  /* ================================================================== */
  /* Talking to the API                                                  */
  /* ================================================================== */

  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  const apiHeaders = () => {
    const headers = { 'content-type': 'application/json' };
    if (settings.accessCode) headers['x-access-code'] = settings.accessCode;
    return headers;
  };

  async function streamChat(payload, onEvent, signal) {
    const res = await fetch('/api/chat', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(payload), signal });
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch { /* not JSON */ }
      throw new ApiError((body && body.error) || '', res.status, body && body.code);
    }
    if (!res.body) throw new ApiError('Streaming is not supported by this browser.', 0, 'no_stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const handleLine = (line) => {
      line = line.trim();
      if (!line) return;
      let evt;
      try { evt = JSON.parse(line); } catch { return; }
      onEvent(evt);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
      }
    }
    buffer += decoder.decode();
    handleLine(buffer);
  }

  function friendlyError(err) {
    if (err instanceof ApiError) {
      if (err.message) return err.message;
      if (err.status === 413) return 'Your message or images are too large. Try fewer or smaller images.';
      if (err.status === 429) return 'Too many requests. Please wait a moment and try again.';
      if (err.status >= 500) return 'The server had a problem or timed out. Please try again.';
      return `The request failed (HTTP ${err.status}).`;
    }
    if (!navigator.onLine) return 'You appear to be offline.';
    return 'Could not reach the server. Check your connection and try again.';
  }

  // Builds the message list for the API: recent history, with the oldest images
  // dropped first if the request would get too large for a serverless function.
  function buildPayload(conv, upTo) {
    const end = conv.messages.indexOf(upTo);
    const usable = conv.messages
      .slice(0, end)
      .filter((m) => (m.text && m.text.trim()) || (m.images && m.images.length))
      .slice(-MAX_HISTORY);

    let budget = IMAGE_BUDGET;
    const out = [];
    for (let i = usable.length - 1; i >= 0; i--) {
      const m = usable[i];
      const kept = [];
      for (const img of m.images || []) {
        if (img.data.length <= budget) { kept.push({ mime: img.mime, data: img.data }); budget -= img.data.length; }
      }
      const dropped = (m.images || []).length - kept.length;
      let text = m.text || '';
      if (dropped) text = (text ? text + '\n\n' : '') + `[${dropped} earlier image${dropped > 1 ? 's were' : ' was'} omitted to keep the request small]`;
      out.unshift({ role: m.role, text, images: kept });
    }
    return { model: state.model, messages: out, system: settings.customInstructions.trim() || undefined };
  }

  function stopStreaming() {
    if (state.streaming) state.streaming.abort.abort();
  }

  async function runAssistant(conv, attempt = 0) {
    const msg = { id: uid(), role: 'assistant', text: '', ts: Date.now(), model: state.model };
    refreshLastAssistant(conv);
    conv.messages.push(msg);
    conv.model = state.model;
    const controller = new AbortController();
    state.streaming = { convId: conv.id, msgId: msg.id, abort: controller };
    updateMainState();
    el.threadInner.append(assistantMessageEl(conv, msg, true));
    renderSidebar();
    setComposerState();
    forceScroll();

    let queued = false;
    const paint = () => {
      queued = false;
      if (!isStreamingMsg(msg)) return;
      const node = findMessageEl(msg.id);
      if (!node) return;
      const prose = $('.prose', node);
      prose.innerHTML = MD.render(msg.text);
      appendDot(prose);
      maybeScroll();
    };
    const saver = setInterval(() => persist(conv), 4000);

    let needCode = false;
    try {
      await streamChat(buildPayload(conv, msg), (evt) => {
        if (evt.type === 'delta') {
          msg.text += evt.text;
          if (!queued) { queued = true; requestAnimationFrame(paint); }
        } else if (evt.type === 'finish') {
          msg.finish = evt.reason || null;
        } else if (evt.type === 'error') {
          msg.error = evt.message || 'Something went wrong.';
        }
      }, controller.signal);
      if (!msg.error && !msg.finish && msg.text) msg.finish = 'INTERRUPTED';
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) msg.stopped = true;
      else if (err instanceof ApiError && err.code === 'access_code_required' && attempt < 3) needCode = true;
      else if (msg.text) msg.finish = 'INTERRUPTED';
      else msg.error = friendlyError(err);
    }
    clearInterval(saver);
    if (state.streaming && state.streaming.msgId === msg.id) state.streaming = null;

    if (needCode) {
      conv.messages.pop();
      const node = findMessageEl(msg.id);
      if (node) node.remove();
      setComposerState();
      const code = await askAccessCode(attempt ? 'That code was not accepted. Please try again.' : undefined);
      if (code) {
        settings.accessCode = code;
        LS.set('accessCode', code);
        return runAssistant(conv, attempt + 1);
      }
      persist(conv);
      return undefined;
    }

    if (!msg.text && !msg.error && !msg.stopped) msg.error = 'The model returned an empty response.';
    conv.updatedAt = Date.now();
    sortConversations();
    persist(conv);
    replaceMessage(conv, msg);
    renderSidebar();
    setComposerState();
    maybeScroll();
    if (!msg.error && !msg.stopped && conv.titleAuto && state.config.smartTitles) generateTitle(conv);
    return undefined;
  }

  async function generateTitle(conv) {
    const first = conv.messages.find((m) => m.role === 'user');
    const reply = conv.messages.find((m) => m.role === 'assistant');
    const text = first && first.text ? first.text.trim() : '';
    if (!text) return;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ action: 'title', text: text.slice(0, 600), reply: reply ? reply.text.slice(0, 300) : '' })
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.title && conv.titleAuto) {
        conv.title = data.title;
        conv.titleAuto = false;
        persist(conv);
        renderSidebar();
      }
    } catch { /* titles are optional */ }
  }

  async function sendUserMessage(conv, text, images) {
    addToList(conv);
    refreshLastAssistant(conv);
    const msg = { id: uid(), role: 'user', text, images, ts: Date.now() };
    conv.messages.push(msg);
    if (conv.messages.length === 1) { conv.title = deriveTitle(text, images); conv.titleAuto = true; }
    conv.updatedAt = Date.now();
    sortConversations();
    updateMainState();
    el.threadInner.append(userMessageEl(conv, msg));
    persist(conv);
    await runAssistant(conv);
  }

  async function regenerate(msgId) {
    if (state.streaming) return;
    const conv = currentConv();
    const idx = conv.messages.findIndex((m) => m.id === msgId);
    if (idx < 1) return;
    conv.messages.length = idx; // drop this reply (and anything after it)
    renderThread(conv);
    await runAssistant(conv);
  }

  function startEdit(conv, msg) {
    if (state.streaming) { toast('Stop the current response before editing.'); return; }
    const node = findMessageEl(msg.id);
    if (!node || node.classList.contains('editing')) return;
    node.classList.add('editing');
    const ta = h('textarea', { rows: '1', 'aria-label': 'Edit message' });
    ta.value = msg.text || '';
    const cancel = () => { box.remove(); node.classList.remove('editing'); };
    const save = async () => {
      const text = ta.value.trim();
      if (!text && !(msg.images && msg.images.length)) return;
      const idx = conv.messages.indexOf(msg);
      msg.text = text;
      conv.messages.length = idx + 1;
      if (idx === 0) { conv.title = deriveTitle(text, msg.images); conv.titleAuto = true; }
      renderThread(conv);
      renderSidebar();
      await runAssistant(conv);
    };
    const box = h('div', { class: 'edit-box' }, ta,
      h('div', { class: 'edit-actions' },
        h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Cancel'),
        h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Send')));
    ta.addEventListener('input', () => autosize(ta, 320));
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
    });
    node.append(box);
    autosize(ta, 320);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  /* ================================================================== */
  /* Composer                                                            */
  /* ================================================================== */

  function autosize(ta, max = 200) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
  }

  function updateSendState() {
    const hasInput = el.prompt.value.trim().length > 0 || state.pending.length > 0;
    el.sendBtn.disabled = state.streaming ? false : !hasInput || state.preparing > 0;
  }

  function setComposerState() {
    const streaming = Boolean(state.streaming);
    el.sendBtn.innerHTML = icon(streaming ? 'stop' : 'send', 20);
    el.sendBtn.setAttribute('aria-label', streaming ? 'Stop generating' : 'Send message');
    el.sendBtn.title = streaming ? 'Stop generating' : 'Send message';
    updateSendState();
  }

  async function submitComposer() {
    if (state.streaming) { stopStreaming(); return; }
    if (state.preparing) { toast('Still processing your images…'); return; }
    const text = el.prompt.value.trim();
    if (!text && !state.pending.length) return;

    if (state.config.requiresAccessCode && !settings.accessCode) {
      const code = await askAccessCode();
      if (!code) return;
      settings.accessCode = code;
      LS.set('accessCode', code);
    }

    const conv = currentConv();
    const images = state.pending.map((p) => ({ mime: p.mime, data: p.data }));
    el.prompt.value = '';
    autosize(el.prompt);
    state.pending = [];
    renderAttachments();
    updateSendState();
    await sendUserMessage(conv, text, images);
  }

  el.composer.addEventListener('submit', (e) => { e.preventDefault(); submitComposer(); });
  el.prompt.addEventListener('input', () => { autosize(el.prompt); updateSendState(); });
  el.prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch()) {
      e.preventDefault();
      if (!state.streaming) submitComposer();
    }
  });

  /* ---- images ---- */

  function fileToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function loadBitmap(file) {
    if (window.createImageBitmap) return createImageBitmap(file).catch(() => loadViaImg(file));
    return loadViaImg(file);
  }
  function loadViaImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  // Small PNG/JPEG/WebP files are sent as-is; everything else is downscaled and
  // re-encoded as JPEG so a few photos never exceed the serverless request limit.
  async function prepareImage(file) {
    const direct = ['image/png', 'image/jpeg', 'image/webp'];
    if (direct.includes(file.type) && file.size <= 600 * 1024) {
      return { mime: file.type, data: await fileToBase64(file) };
    }
    const bitmap = await loadBitmap(file);
    const attempts = [[1600, 0.85], [1280, 0.7], [1024, 0.55]];
    let blob = null;
    for (const [maxSide, quality] of attempts) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const hgt = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hgt;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, hgt);
      ctx.drawImage(bitmap, 0, 0, w, hgt);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 700 * 1024) break;
    }
    if (!blob) throw new Error('encode');
    return { mime: 'image/jpeg', data: await fileToBase64(blob) };
  }

  function renderAttachments() {
    el.attachments.textContent = '';
    el.attachments.hidden = !state.pending.length && !state.preparing;
    for (const p of state.pending) {
      el.attachments.append(h('div', { class: 'thumb' },
        h('img', { src: dataUrl(p), alt: 'Attachment preview' }),
        h('button', {
          class: 'remove', type: 'button', 'aria-label': 'Remove image', html: icon('x', 12),
          onclick: () => { state.pending = state.pending.filter((x) => x.id !== p.id); renderAttachments(); updateSendState(); }
        })));
    }
    for (let i = 0; i < state.preparing; i++) el.attachments.append(h('div', { class: 'thumb loading' }));
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) { toast('Only image files are supported.'); return; }
    const room = MAX_IMAGES - state.pending.length - state.preparing;
    if (room <= 0) { toast(`You can attach up to ${MAX_IMAGES} images per message.`); return; }
    if (files.length > room) toast(`Only ${MAX_IMAGES} images fit in one message; the extras were skipped.`);
    for (const file of files.slice(0, room)) {
      state.preparing++;
      renderAttachments();
      updateSendState();
      try {
        const img = await prepareImage(file);
        state.pending.push({ id: uid(), mime: img.mime, data: img.data });
      } catch {
        toast(`Couldn’t read “${(file.name || 'image').slice(0, 30)}”. Try a PNG, JPEG or WebP.`);
      } finally {
        state.preparing--;
        renderAttachments();
        updateSendState();
      }
    }
  }

  el.attachBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', () => { addFiles(el.fileInput.files); el.fileInput.value = ''; });

  el.prompt.addEventListener('paste', (e) => {
    const files = Array.from((e.clipboardData && e.clipboardData.items) || [])
      .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter(Boolean);
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; el.dropOverlay.hidden = false; } });
  window.addEventListener('dragleave', (e) => { if (hasFiles(e)) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) el.dropOverlay.hidden = true; } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    el.dropOverlay.hidden = true;
    addFiles(e.dataTransfer.files);
  });

  /* ================================================================== */
  /* Model picker, search, settings                                      */
  /* ================================================================== */

  el.modelBtn.addEventListener('click', () => {
    toggleMenu(el.modelBtn, state.config.models.map((m) => ({
      label: m.label,
      description: m.description,
      checked: m.id === state.model,
      onClick: () => {
        state.model = m.id;
        LS.set('model', m.id);
        const conv = currentConv();
        if (conv) conv.model = m.id;
        updateModelLabel();
      }
    })));
  });

  function snippetNode(text, query) {
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    const start = Math.max(0, i - 30);
    const slice = text.slice(start, start + 110).replace(/\s+/g, ' ');
    const rel = i - start;
    if (i < 0 || rel < 0) return document.createTextNode(slice);
    const frag = document.createDocumentFragment();
    frag.append(document.createTextNode((start > 0 ? '…' : '') + slice.slice(0, rel)));
    frag.append(h('mark', null, slice.slice(rel, rel + query.length)));
    frag.append(document.createTextNode(slice.slice(rel + query.length)));
    return frag;
  }

  function openSearch() {
    const input = h('input', { type: 'text', placeholder: 'Search chats…', 'aria-label': 'Search chats', autocomplete: 'off', autofocus: true });
    const results = h('div', { class: 'search-results', role: 'listbox' });
    const box = h('div', { class: 'search-box', html: icon('search', 18) }, input);
    let rows = [];
    let sel = 0;

    const choose = (row) => { m.close(); row.action(); };
    const paint = () => {
      results.textContent = '';
      rows.forEach((row, i) => {
        const node = h('button', {
          class: 'result' + (i === sel ? ' sel' : ''), type: 'button', role: 'option',
          onclick: () => choose(row), onmousemove: () => { if (sel !== i) { sel = i; paint(); } }
        }, h('div', { class: 'r-title', html: icon(row.icon, 18) }, h('span', null, row.title)));
        if (row.snippet) node.append(h('div', { class: 'r-snip' }, row.snippet));
        results.append(node);
      });
      if (!rows.length) results.append(h('div', { class: 'search-empty' }, 'No chats found'));
      const selected = $('.result.sel', results);
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    };
    const build = () => {
      const q = input.value.trim();
      sel = 0;
      if (!q) {
        rows = [{ icon: 'newchat', title: 'New chat', action: newChat }]
          .concat(state.conversations.slice(0, 20).map((c) => ({ icon: 'chat', title: c.title, action: () => showConversation(c.id) })));
      } else {
        const lower = q.toLowerCase();
        rows = state.conversations
          .map((c) => {
            if (c.title.toLowerCase().includes(lower)) return { c, snippet: null };
            const hit = c.messages.find((msg) => msg.text && msg.text.toLowerCase().includes(lower));
            return hit ? { c, snippet: snippetNode(hit.text, q) } : null;
          })
          .filter(Boolean)
          .slice(0, 30)
          .map(({ c, snippet }) => ({ icon: 'chat', title: c.title, snippet, action: () => showConversation(c.id) }));
      }
      paint();
    };
    input.addEventListener('input', build);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(rows.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); choose(rows[sel]); }
    });
    const m = openModal({ body: h('div', null, box, results), bare: true, wide: true, top: true });
    build();
  }

  function exportChats() {
    const data = {
      exportedAt: new Date().toISOString(),
      note: 'Images are not included in this export.',
      conversations: state.conversations.map((c) => ({
        id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, model: c.model,
        messages: c.messages.map((m) => ({ role: m.role, text: m.text, images: m.images ? m.images.length : 0, ts: m.ts }))
      }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: `chats-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function openSettings() {
    const themeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' });
    for (const value of ['system', 'light', 'dark']) {
      themeSeg.append(h('button', {
        type: 'button', 'aria-pressed': String(settings.theme === value), dataset: { v: value },
        onclick: () => {
          settings.theme = value;
          LS.set('theme', value);
          applyTheme();
          themeSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
        }
      }, value.charAt(0).toUpperCase() + value.slice(1)));
    }

    const instructions = h('textarea', { class: 'textarea', maxlength: '1500', placeholder: 'e.g. Keep answers short. I am a beginner programmer.', 'aria-label': 'Custom instructions' });
    instructions.value = settings.customInstructions;
    instructions.addEventListener('input', () => { settings.customInstructions = instructions.value; LS.set('customInstructions', instructions.value); });

    const body = h('div', null,
      h('div', { class: 'field' }, h('div', { class: 'label' }, 'Theme'), themeSeg),
      h('div', { class: 'field' },
        h('label', null, 'Custom instructions'), instructions,
        h('p', { class: 'hint' }, 'Sent with every message so the assistant can follow your preferences. Stored only in this browser.'))
    );

    if (state.config.requiresAccessCode) {
      const code = h('input', { class: 'input', type: 'password', placeholder: 'Access code', autocomplete: 'off', 'aria-label': 'Access code' });
      code.value = settings.accessCode;
      code.addEventListener('input', () => { settings.accessCode = code.value.trim(); LS.set('accessCode', settings.accessCode); });
      body.append(h('div', { class: 'field' }, h('label', null, 'Access code'), code));
    }

    body.append(h('div', { class: 'field' },
      h('div', { class: 'label' }, 'Data'),
      h('div', { class: 'row' },
        h('span', null, 'Export all chats'),
        h('button', { class: 'btn', type: 'button', onclick: exportChats }, 'Export')),
      h('div', { class: 'row' },
        h('span', null, 'Delete all chats'),
        h('button', {
          class: 'btn danger', type: 'button',
          onclick: async () => {
            const ok = await confirmDialog({ title: 'Delete all chats?', message: 'Every chat stored in this browser will be permanently deleted.', confirmLabel: 'Delete all', danger: true });
            if (!ok) return;
            stopStreaming();
            state.conversations = [];
            state.draft = null;
            await DB.clear();
            newChat();
            toast('All chats deleted.');
          }
        }, 'Delete all'))));

    openModal({ title: 'Settings', body });
  }

  /* ================================================================== */
  /* Boot                                                                */
  /* ================================================================== */

  function showBanner(html) {
    el.banner.innerHTML = html;
    el.banner.hidden = false;
  }

  async function loadConfig() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!res.ok) throw new Error('health ' + res.status);
      const j = await res.json();
      state.config = {
        app: j.app || state.config.app,
        models: Array.isArray(j.models) && j.models.length ? j.models : state.config.models,
        defaultModel: j.defaultModel || state.config.defaultModel,
        requiresAccessCode: Boolean(j.requiresAccessCode),
        smartTitles: j.smartTitles !== false
      };
      if (j.keys === 0) {
        showBanner('No Gemini API keys are configured yet. In Netlify, add <code>GEMINI_API_KEY_1</code> to <code>GEMINI_API_KEY_4</code> under Site configuration → Environment variables, then redeploy.');
      }
    } catch {
      showBanner('Can’t reach the chat API. When developing locally, run <code>netlify dev</code> instead of opening the file directly.');
    }
  }

  function bindEvents() {
    $('#new-chat-btn').addEventListener('click', newChat);
    $('#new-chat-top').addEventListener('click', newChat);
    $('#logo-btn').addEventListener('click', newChat);
    $('#search-btn').addEventListener('click', openSearch);
    $('#settings-btn').addEventListener('click', openSettings);
    $('#collapse-btn').addEventListener('click', closeSidebar);
    $('#open-sidebar-btn').addEventListener('click', openSidebar);
    $('#sidebar-backdrop').addEventListener('click', () => root.classList.remove('sidebar-open'));

    document.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'k') { e.preventDefault(); openSearch(); }
      else if (mod && e.shiftKey && key === 'o') { e.preventDefault(); newChat(); }
      else if (e.key === '/' && !mod && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !modalStack.length) {
        e.preventDefault();
        el.prompt.focus();
      }
    });

    const chips = [
      { label: 'Summarize text', fill: 'Summarize the following text in a few bullet points:\n\n' },
      { label: 'Help me write code', fill: 'Help me write code to ' },
      { label: 'Brainstorm ideas', fill: 'Brainstorm ten ideas for ' },
      { label: 'Analyze an image', attach: true }
    ];
    for (const c of chips) {
      el.chips.append(h('button', {
        class: 'chip', type: 'button',
        onclick: () => {
          if (c.attach) { el.fileInput.click(); return; }
          el.prompt.value = c.fill;
          autosize(el.prompt);
          updateSendState();
          el.prompt.focus();
          el.prompt.setSelectionRange(el.prompt.value.length, el.prompt.value.length);
        }
      }, c.label));
    }
  }

  async function init() {
    hydrateIcons(document);
    applyTheme();
    bindEvents();
    await loadConfig();

    document.title = state.config.app;
    el.disclaimer.textContent = `${state.config.app} can make mistakes. Check important info.`;
    const saved = LS.get('model', null);
    state.model = state.config.models.some((m) => m.id === saved) ? saved : state.config.defaultModel;
    updateModelLabel();

    const stored = await DB.all();
    if (stored === null) {
      state.persistOK = false;
    } else if (Array.isArray(stored)) {
      state.conversations = stored
        .filter((c) => c && c.id && Array.isArray(c.messages))
        .map((c) => {
          c.messages = c.messages.filter((m) => m.role === 'user' || m.text || m.error || m.stopped);
          return c;
        })
        .filter((c) => c.messages.length);
      sortConversations();
    }

    setComposerState();
    const match = /^#\/c\/([\w-]+)$/.exec(location.hash);
    if (match && state.conversations.some((c) => c.id === match[1])) showConversation(match[1]);
    else newChat();
  }

  init();
})();
