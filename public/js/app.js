/* CampusRent Frontend App */
'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let ME = null;
let allBrowseItems = [];
let currentCat = 'all';
let currentChatKey = null;
let mediaRecorder = null;
let isRecording = false;
let audioChunks = [];
let currentRentItem = null;
let pollTimer = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
window.onload = async () => {
  try {
    const r = await api('GET', '/api/auth/me');
    ME = r.user;
  } catch {
    window.location.href = '/';
    return;
  }
  document.getElementById('sb-name').textContent = ME.name;
  document.getElementById('greet').textContent = ME.name.split(' ')[0];

  startClock();
  await loadHome();
  startPolling();

  // Set default rent dates
  const today = new Date();
  const tom = new Date(); tom.setDate(today.getDate() + 1);
  document.getElementById('rm-start').value = fmt(today);
  document.getElementById('rm-end').value = fmt(tom);
  document.getElementById('rm-start').addEventListener('change', calcCost);
  document.getElementById('rm-end').addEventListener('change', calcCost);
};

function fmt(d) { return d.toISOString().split('T')[0]; }

// ─── API helper ───────────────────────────────────────────────────────────────
async function api(method, url, body, isForm = false) {
  const opts = { method, credentials: 'include' };
  if (body) {
    if (isForm) { opts.body = body; }
    else { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  }
  const r = await fetch(url, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function startClock() {
  const tick = () => {
    const n = new Date();
    document.getElementById('clk').textContent = n.toLocaleTimeString();
    document.getElementById('clk-date').textContent = n.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('clk-day').textContent = n.toLocaleDateString('en-IN', { weekday: 'long' });
  };
  tick(); setInterval(tick, 1000);
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function nav(page) {
  document.querySelectorAll('.pv').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  document.getElementById('pv-' + page).classList.add('on');
  document.querySelector(`[data-page="${page}"]`).classList.add('on');
  if (page === 'home') loadHome();
  if (page === 'browse') loadBrowse();
  if (page === 'my-items') loadMyItems();
  if (page === 'requests') loadRequests();
  if (page === 'messages') loadMessages();
  if (page === 'notifications') loadNotifications();
}

// ─── Polling (for real-time feel) ─────────────────────────────────────────────
function startPolling() {
  pollTimer = setInterval(async () => {
    await updateBadge();
    const active = document.querySelector('.pv.on')?.id?.replace('pv-', '');
    if (active === 'messages' && currentChatKey) await loadChatMessages(currentChatKey);
    if (active === 'notifications') await loadNotifications();
  }, 4000);
}

async function updateBadge() {
  try {
    const d = await api('GET', '/api/requests');
    const n = d.incoming.filter(r => r.status === 'pending').length;
    const b = document.getElementById('req-badge');
    b.textContent = n; b.style.display = n > 0 ? '' : 'none';
    document.getElementById('st-pending').textContent = n;
  } catch {}
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
async function loadHome() {
  try {
    const [itemsD, reqsD] = await Promise.all([
      api('GET', '/api/items?mine=1'),
      api('GET', '/api/requests')
    ]);
    const listed = itemsD.items.length;
    const active = reqsD.outgoing.filter(r => r.status === 'approved').length;
    const earned = reqsD.incoming.filter(r => r.status !== 'pending').reduce((s, r) => s + r.totalCost, 0);
    document.getElementById('st-listed').textContent = listed;
    document.getElementById('st-active').textContent = active;
    document.getElementById('st-earned').textContent = '₹' + earned;

    // Recent requests — correct isIncoming per request
    const incomingIds = new Set(reqsD.incoming.map(r => r.id));
    const allReqs = [...reqsD.incoming, ...reqsD.outgoing].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
    document.getElementById('home-reqs').innerHTML = allReqs.length ? allReqs.map(r => reqRow(r, incomingIds.has(r.id))).join('') : '<div class="empty">No requests yet</div>';

    // My items preview
    const myI = itemsD.items.slice(0, 3);
    document.getElementById('home-items').innerHTML = myI.length ? myI.map(i => `
      <div class="rr">
        <div class="rr-ic">${i.photo ? `<img src="${i.photo}" style="width:40px;height:40px;object-fit:cover;border-radius:8px">` : '📦'}</div>
        <div class="rr-info"><div class="rr-name">${i.name}</div><div class="rr-meta">₹${i.price}/day · ${i.category}</div></div>
      </div>`).join('') : '<div class="empty">No items yet. <a onclick="nav(\'my-items\')">Add one!</a></div>';

    // Featured items
    const featD = await api('GET', '/api/items');
    document.getElementById('home-featured').innerHTML = featD.items.slice(0, 3).map(itemCard).join('') || '<div class="empty" style="grid-column:span 3">No items yet from other students</div>';
  } catch (e) { console.error(e); }
}

// ─── BROWSE ───────────────────────────────────────────────────────────────────
async function loadBrowse() {
  try {
    const d = await api('GET', '/api/items');
    allBrowseItems = d.items;
    filterBrowse();
  } catch (e) { toast('Error loading items'); }
}

function filterBrowse() {
  const q = document.getElementById('s-q').value.toLowerCase();
  let items = allBrowseItems;
  if (currentCat !== 'all') items = items.filter(i => i.category === currentCat);
  if (q) items = items.filter(i => i.name.toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q));
  document.getElementById('browse-grid').innerHTML = items.length ? items.map(itemCard).join('') : '<div class="empty" style="grid-column:span 3">No items found</div>';
}

function setCat(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('.fb').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  filterBrowse();
}

// ─── MY ITEMS ─────────────────────────────────────────────────────────────────
async function loadMyItems() {
  try {
    const d = await api('GET', '/api/items?mine=1');
    document.getElementById('my-items-grid').innerHTML = d.items.length
      ? d.items.map(i => itemCard(i, true)).join('')
      : '<div class="empty" style="grid-column:span 3">No items listed yet. Click "+ List New Item" to get started!</div>';
  } catch {}
}

// ─── ITEM CARD ────────────────────────────────────────────────────────────────
function itemCard(item, isOwner = false) {
  // Always block owner from renting own item
  const isMine = ME && item.ownerId === ME.id;
  const thumb = item.photo
    ? `<img src="${item.photo}" alt="${item.name}">`
    : `<span>${catEmoji(item.category)}</span>`;
  return `<div class="ic">
    <div class="ic-img">${thumb}</div>
    <div class="ic-body">
      <div class="ic-name">${escHtml(item.name)}</div>
      <div class="ic-own">by ${escHtml(item.ownerName)}${isMine ? ' <span style=\"color:var(--accent);font-size:0.7rem\">(you)</span>' : ''}</div>
      <div class="ic-foot"><span class="ic-price">₹${item.price}/day</span><span class="ic-cat">${item.category}</span></div>
      ${isMine
        ? `<button class="btn-del" onclick="delItem('${item.id}')">🗑 Remove Listing</button>`
        : `<button class="btn-rent" onclick="openRent('${item.id}')">Request to Rent</button>`}
    </div>
  </div>`;
}

function catEmoji(cat) {
  return { Clothes:'👗', Electronics:'📱', Accessories:'👜', Sports:'🏀', Other:'📦' }[cat] || '📦';
}

// ─── LIST ITEM ────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('on'); }
function closeModal(id) { document.getElementById(id).classList.remove('on'); }

function previewPhoto(e) {
  const file = e.target.files[0]; if (!file) return;
  const img = document.getElementById('prev-img');
  img.src = URL.createObjectURL(file); img.style.display = 'block';
}

async function listItem() {
  const name = document.getElementById('i-name').value.trim();
  const price = document.getElementById('i-price').value;
  if (!name || !price) { toast('⚠️ Name and price are required'); return; }

  const fd = new FormData();
  fd.append('name', name);
  fd.append('category', document.getElementById('i-cat').value);
  fd.append('description', document.getElementById('i-desc').value.trim());
  fd.append('price', price);
  fd.append('fine', document.getElementById('i-fine').value || '0');
  const photoFile = document.getElementById('item-photo').files[0];
  if (photoFile) fd.append('photo', photoFile);

  try {
    await api('POST', '/api/items', fd, true);
    closeModal('m-upload');
    clearUploadForm();
    toast('🎉 Item listed successfully!');
    await loadMyItems();
    await loadHome();
  } catch (e) { toast('Error: ' + e.message); }
}

function clearUploadForm() {
  ['i-name','i-desc','i-price','i-fine'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('prev-img').style.display = 'none';
  document.getElementById('item-photo').value = '';
}

async function delItem(id) {
  if (!confirm('Remove this item?')) return;
  try {
    await api('DELETE', '/api/items/' + id);
    toast('🗑 Item removed');
    await loadMyItems();
    await loadHome();
  } catch (e) { toast('Error: ' + e.message); }
}

// ─── REQUESTS ─────────────────────────────────────────────────────────────────
async function loadRequests() {
  try {
    const d = await api('GET', '/api/requests');
    document.getElementById('inc-reqs').innerHTML = d.incoming.length ? d.incoming.map(r => reqRow(r, true)).join('') : '<div class="empty">No incoming requests</div>';
    document.getElementById('out-reqs').innerHTML = d.outgoing.length ? d.outgoing.map(r => reqRow(r, false)).join('') : '<div class="empty">No sent requests</div>';
    await updateBadge();
  } catch {}
}

function reqRow(r, isIncoming) {
  const pillClass = { pending:'sp-pend', approved:'sp-appr', rejected:'sp-rej', returned:'sp-ret' }[r.status] || 'sp-pend';
  const other = isIncoming ? r.renterName : r.ownerName;
  const label = isIncoming ? 'From: ' + other : 'To: ' + other;

  let actions = '';
  // Owner sees Accept/Reject on pending requests
  if (isIncoming && r.status === 'pending') {
    actions = `<div class="rr-acts">
      <button class="rbtn acc" onclick="respond('${r.id}','approved')">✓ Accept</button>
      <button class="rbtn rej" onclick="respond('${r.id}','rejected')">✗ Reject</button>
    </div>`;
  }
  // Renter sees Return button on approved requests
  if (!isIncoming && r.status === 'approved') {
    actions = `<div class="rr-acts">
      <button class="rbtn ret" onclick="returnItem('${r.id}')">📦 Return Item</button>
      <button class="rbtn acc" onclick="goToChat('${r.ownerId}','${escAttr(r.ownerName)}')">💬 Chat with Owner</button>
    </div>`;
  }
  // Owner sees Chat button on approved requests
  if (isIncoming && r.status === 'approved') {
    actions = `<div class="rr-acts">
      <button class="rbtn acc" onclick="goToChat('${r.renterId}','${escAttr(r.renterName)}')">💬 Chat with Renter</button>
    </div>`;
  }

  const msg = r.message ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:6px;background:var(--bg);padding:7px 10px;border-radius:8px;">"${escHtml(r.message)}"</div>` : '';
  return `<div class="rr" style="flex-direction:column;align-items:flex-start;border-bottom:1px solid var(--border);padding:14px 0;gap:0">
    <div style="display:flex;align-items:flex-start;gap:12px;width:100%">
      <div class="rr-ic">📋</div>
      <div class="rr-info" style="flex:1">
        <div class="rr-name">${escHtml(r.itemName)}</div>
        <div class="rr-meta">${label}</div>
        <div class="rr-meta">${r.startDate} → ${r.endDate} &nbsp;·&nbsp; ₹${r.totalCost} &nbsp;·&nbsp; Fine ₹${r.finePerDay}/day late</div>
        ${msg}
        ${actions}
      </div>
      <span class="sb-pill ${pillClass}" style="flex-shrink:0;margin-top:2px">${r.status}</span>
    </div>
  </div>`;
}

// Navigate to Messages tab and open the right conversation
async function goToChat(otherUserId, otherName) {
  nav('messages');
  try {
    const d = await api('GET', '/api/messages');
    const convo = d.conversations.find(c => c.other && c.other.id === otherUserId);
    if (convo) {
      await openChat(convo.key, otherName);
    } else {
      toast('💬 Chat opens automatically once a request is approved.');
    }
  } catch {}
}

async function respond(id, action) {
  try {
    await api('PUT', `/api/requests/${id}/respond`, { action });
    toast(action === 'approved' ? '✅ Request approved! Chat is now open.' : '❌ Request rejected.');
    await loadRequests();
  } catch (e) { toast('Error: ' + e.message); }
}

async function returnItem(id) {
  if (!confirm('Mark this item as returned?')) return;
  try {
    const d = await api('PUT', `/api/requests/${id}/return`, {});
    if (d.lateDays > 0) toast(`⚠️ ${d.lateDays} day(s) late! Fine: ₹${d.fine}`);
    else toast('✅ Item returned on time!');
    await loadRequests();
  } catch (e) { toast('Error: ' + e.message); }
}

// ─── RENT REQUEST ─────────────────────────────────────────────────────────────
async function openRent(itemId) {
  // Try from cached list first, else fetch all
  let item = allBrowseItems.find(i => i.id === itemId);
  if (!item) {
    try { const d = await api('GET', '/api/items'); allBrowseItems = d.items; item = d.items.find(i => i.id === itemId); } catch {}
  }
  if (!item) { toast('Item not found'); return; }
  // Prevent owner renting own item
  if (item.ownerId === ME.id) { toast('⚠️ You cannot rent your own item!'); return; }
  currentRentItem = item;
  document.getElementById('rm-name').textContent = currentRentItem.name;
  document.getElementById('rm-info').innerHTML = `<b>${escHtml(currentRentItem.name)}</b><br>${escHtml(currentRentItem.description || '')}<br><br>Owner: ${escHtml(currentRentItem.ownerName)} &nbsp;·&nbsp; ₹${currentRentItem.price}/day`;
  document.getElementById('rm-fine').textContent = currentRentItem.fine || 0;
  calcCost();
  openModal('m-rent');
}

function calcCost() {
  if (!currentRentItem) return;
  const s = document.getElementById('rm-start').value;
  const e = document.getElementById('rm-end').value;
  if (!s || !e) return;
  const days = Math.max(1, Math.ceil((new Date(e) - new Date(s)) / 86400000));
  document.getElementById('rm-cost').textContent = `₹${days * currentRentItem.price} for ${days} day${days > 1 ? 's' : ''}`;
}

async function sendRequest() {
  if (!currentRentItem) return;
  const startDate = document.getElementById('rm-start').value;
  const endDate = document.getElementById('rm-end').value;
  const message = document.getElementById('rm-msg').value.trim();
  if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) { toast('⚠️ Select valid dates'); return; }
  try {
    await api('POST', '/api/requests', { itemId: currentRentItem.id, startDate, endDate, message });
    closeModal('m-rent');
    document.getElementById('rm-msg').value = '';
    toast('📩 Request sent! Waiting for owner\'s response.');
  } catch (e) { toast('Error: ' + e.message); }
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
async function loadMessages() {
  try {
    const d = await api('GET', '/api/messages');
    const el = document.getElementById('chat-contacts');
    if (!d.conversations.length) {
      el.innerHTML = '<div class="empty">No conversations yet.<br>Accept a rental request to start chatting.</div>';
      return;
    }
    el.innerHTML = d.conversations.map(c => `
      <div class="cc ${c.key === currentChatKey ? 'on' : ''}" onclick="openChat('${c.key}','${escAttr(c.other?.name || 'Unknown')}')">
        <div class="cc-av">👤</div>
        <div><div class="cc-n">${escHtml(c.other?.name || 'Unknown')}</div><div class="cc-l">${escHtml(c.lastMessage)}</div></div>
        ${c.unread > 0 ? `<span class="badge">${c.unread}</span>` : ''}
      </div>`).join('');
  } catch {}
}

async function openChat(key, name) {
  currentChatKey = key;
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-av').textContent = name.charAt(0).toUpperCase();
  await loadChatMessages(key);
  await loadMessages(); // refresh contacts to clear unread
}

async function loadChatMessages(key) {
  try {
    const d = await api('GET', '/api/messages/' + key);
    const el = document.getElementById('msgs-area');
    if (!d.convo.messages.length) {
      el.innerHTML = '<div class="empty" style="margin-top:50px">Say hello! 👋</div>';
      return;
    }
    // Use server-confirmed currentUserId for 100% reliable sent/received
    const myId = String(d.currentUserId || ME.id);
    el.innerHTML = d.convo.messages.map(m => {
      if (m.type === 'system') {
        return `<div class="msg msg-sys"><div class="sys-bub">${escHtml(m.text)}</div></div>`;
      }
      const sent = String(m.senderId) === myId;
      const cls = sent ? 's' : 'r';
      const time = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nameLabel = sent
        ? `<div class="msg-name msg-name-s">You</div>`
        : `<div class="msg-name msg-name-r">${escHtml(m.senderName || 'Other')}</div>`;
      if (m.type === 'voice') {
        return `<div class="msg ${cls}">
          ${nameLabel}
          <div class="bub"><div class="voice-bub">
            <button class="vp" onclick="playVoice('${m.audioUrl}')">▶</button>
            <div class="vwave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
            <span class="vdur">${m.duration}</span>
          </div></div>
          <div class="mt">${time}</div>
        </div>`;
      }
      return `<div class="msg ${cls}">${nameLabel}<div class="bub">${escHtml(m.text)}</div><div class="mt">${time}</div></div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  } catch(e) { console.error('loadChatMessages error:', e); }
}

async function sendMsg() {
  if (!currentChatKey) { toast('⚠️ Select a conversation first'); return; }
  const input = document.getElementById('msg-in');
  const text = input.value.trim();
  if (!text) return;
  try {
    await api('POST', `/api/messages/${currentChatKey}/send`, { text });
    input.value = '';
    await loadChatMessages(currentChatKey);
  } catch (e) { toast('Error: ' + e.message); }
}

function playVoice(url) {
  const a = new Audio(url); a.play().catch(() => toast('⚠️ Cannot play audio'));
}

// ─── VOICE RECORDING ─────────────────────────────────────────────────────────
async function toggleMic() {
  const btn = document.getElementById('mic-btn');
  const hint = document.getElementById('rec-hint');
  if (!currentChatKey) { toast('⚠️ Select a conversation first'); return; }

  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      const startTime = Date.now();
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const seconds = Math.round((Date.now() - startTime) / 1000);
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        const duration = `${min}:${sec.toString().padStart(2, '0')}`;
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        fd.append('duration', duration);
        try {
          await api('POST', `/api/messages/${currentChatKey}/voice`, fd, true);
          await loadChatMessages(currentChatKey);
          toast('🎤 Voice message sent!');
        } catch (e) { toast('Error sending voice: ' + e.message); }
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      isRecording = true;
      btn.classList.add('rec');
      btn.textContent = '⏹';
      hint.classList.add('on');
    } catch { toast('⚠️ Microphone access denied. Please allow microphone.'); }
  } else {
    if (mediaRecorder) mediaRecorder.stop();
    isRecording = false;
    btn.classList.remove('rec');
    btn.textContent = '🎤';
    hint.classList.remove('on');
  }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
async function loadNotifications() {
  try {
    const d = await api('GET', '/api/notifications');
    const el = document.getElementById('notif-list');
    el.innerHTML = d.notifications.length
      ? d.notifications.map(n => `<div class="ni-item">
          <div class="ni-ic2">${n.icon}</div>
          <div><div class="ni-text">${escHtml(n.msg)}</div><div class="ni-time">${new Date(n.time).toLocaleString()}</div></div>
        </div>`).join('')
      : '<div class="empty">No notifications yet</div>';
    await api('PUT', '/api/notifications/read', {});
  } catch {}
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.style.opacity = '0', 3500);
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
async function logout() {
  await api('POST', '/api/auth/logout', {});
  clearInterval(pollTimer);
  window.location.href = '/';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}
