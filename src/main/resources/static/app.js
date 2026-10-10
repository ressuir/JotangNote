"use strict";

// The page is served by Spring Boot itself; existing session-cookie APIs are preserved.
const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  notes: [],
  activeNote: null,
  authMode: "login",
  sort: "recent",
  hasConfirmedSave: false,
  dirty: false,
  busy: false,
  requestSerial: 0,
  baseline: { title: "", content: "" },
  pendingOperation: null
};
const els = {
  toast: $("toast"), authOverlay: $("authOverlay"), authForm: $("authForm"),
  loginTab: $("loginTab"), registerTab: $("registerTab"), authSubmit: $("authSubmit"),
  authHint: $("authHint"), usernameInput: $("usernameInput"), passwordInput: $("passwordInput"),
  userBadge: $("userBadge"), logoutButton: $("logoutButton"), menuButton: $("menuButton"),
  notesPanel: $("notesPanel"), sidebarBackdrop: $("sidebarBackdrop"),
  newNoteButton: $("newNoteButton"), allNotesNav: $("allNotesNav"), sortOrder: $("sortOrder"),
  notesList: $("notesList"), noteSearch: $("noteSearch"), sidebarSearch: $("sidebarSearch"), closeSearchButton: $("closeSearchButton"),
  searchButton: $("searchButton"), notesLoadError: $("notesLoadError"), retryNotesButton: $("retryNotesButton"), retryStatusButton: $("retryStatusButton"),
  noteDate: $("noteDate"), noteTitle: $("noteTitle"),
  noteContent: $("noteContent"), saveNoteButton: $("saveNoteButton"),
  deleteNoteButton: $("deleteNoteButton"), saveStatus: $("saveStatus"), charCount: $("charCount"),
  aiButton: $("aiButton"), chatPanel: $("chatPanel"), chatBackdrop: $("chatBackdrop"),
  closeChatButton: $("closeChatButton"), chatMessages: $("chatMessages"),
  chatForm: $("chatForm"), chatInput: $("chatInput"), sendChatButton: $("sendChatButton"),
  newChatButton: $("newChatButton"), accountMenuButton: $("accountMenuButton"), accountMenu: $("accountMenu")
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    const error = new Error(body && typeof body.message === "string"
      ? body.message : `请求失败（HTTP ${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3000);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function setAuthMode(mode) {
  state.authMode = mode;
  const login = mode === "login";
  els.loginTab.classList.toggle("active", login);
  els.registerTab.classList.toggle("active", !login);
  els.authSubmit.textContent = login ? "登录" : "注册";
  els.authHint.textContent = login ? "登录后查看和编辑你的笔记。" : "用户名 2–32 字符；密码 8–72 字节。";
  els.passwordInput.autocomplete = login ? "current-password" : "new-password";
}
function setUser(user) {
  state.user = user;
  els.authOverlay.classList.toggle("hidden", Boolean(user));
  els.userBadge.textContent = user ? user.username : "未登录";
}
async function restoreSession() {
  try {
    const user = await api("/api/auth/me");
    setUser(user);
    await loadNotes();
  } catch (error) {
    if (error.status === 401) setUser(null);
    else { setUser(null); showToast("无法连接服务器，请检查应用是否已启动"); }
  }
}
async function submitAuth(event) {
  event.preventDefault();
  const username = els.usernameInput.value.trim();
  const password = els.passwordInput.value;
  if (!username || !password) { showToast("请输入用户名和密码"); return; }
  if (state.authMode === "register") {
    if (username.length < 2 || username.length > 32 || /\s/.test(username)
      || new TextEncoder().encode(password).length < 8
      || new TextEncoder().encode(password).length > 72) {
      showToast("用户名需为 2–32 个非空白字符，密码为 8–72 字节"); return;
    }
  }
  els.authSubmit.disabled = true;
  try {
    if (state.authMode === "register") {
      await api("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
      setAuthMode("login");
      els.passwordInput.value = "";
      els.passwordInput.focus();
      showToast("注册成功，请登录");
    } else {
      const user = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      setUser(user);
      els.passwordInput.value = "";
      clearEditor({ force: true });
      showToast("登录成功");
      await loadNotes();
    }
  } catch (error) { showToast(error.message); }
  finally { els.authSubmit.disabled = false; }
}

function setSidebar(open) {
  const isOpen = Boolean(open);
  els.notesPanel.classList.toggle("open", isOpen);
  els.sidebarBackdrop.hidden = !isOpen;
  els.menuButton.setAttribute("aria-expanded", String(isOpen));
  els.menuButton.setAttribute("aria-label", isOpen ? "关闭导航栏" : "打开导航栏");
}
function setChat(open) {
  const isOpen = Boolean(open);
  els.chatPanel.classList.toggle("open", isOpen);
  document.body.classList.toggle("ai-open", isOpen);
  els.chatBackdrop.hidden = true;
  els.chatPanel.setAttribute("aria-hidden", String(!isOpen));
  els.aiButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) els.chatInput.focus();
  else els.aiButton.focus();
}
function focusSearch() {
  els.sidebarSearch.hidden = false;
  setSidebar(true);
  els.noteSearch.focus();
  els.noteSearch.select();
}
function setSort(sort) {
  state.sort = sort === "created" ? "created" : "recent";
  els.sortOrder.value = state.sort;
  renderNotes();
}

async function logout() {
  if (!canLeaveEditor()) return;
  try { await api("/api/auth/logout", { method: "POST" }); }
  catch (error) {
    if (error.status !== 401) { showToast(`退出失败：${error.message}`); return; }
  }
  state.requestSerial++;
  state.notes = [];
  state.pendingOperation = null;
  state.busy = false;
  clearEditor({ force: true });
  setSidebar(false);
  setChat(false);
  setUser(null);
  renderNotes();
}

async function loadNotes({ silent = false } = {}) {
  const userId = state.user?.id;
  if (!userId) return false;
  try {
    const notes = await api("/api/notes");
    if (state.user?.id !== userId) return false;
    if (!Array.isArray(notes)) throw new Error("笔记列表响应格式不正确");
    state.notes = notes;
    els.notesLoadError.hidden = true;
    reconcilePendingOperation();
    renderNotes();
    return true;
  } catch (error) {
    if (!silent) {
      showToast(`加载笔记失败：${error.message}`);
      if (error.status !== 401) els.notesLoadError.hidden = false;
    }
    if (error.status === 401) { setUser(null); }
    return false;
  }
}
function reconcilePendingOperation() {
  const pending = state.pendingOperation;
  if (!pending) return;
  let found = null;
  if (pending.type === "create") {
    found = state.notes.find((note) => !pending.previousIds.has(note.id)
      && note.title === pending.title && note.content === pending.content);
  } else if (pending.type === "update") {
    found = state.notes.find((note) => note.id === pending.id
      && note.title === pending.title && note.content === pending.content);
  } else if (pending.type === "delete") {
    found = !state.notes.some((note) => note.id === pending.id);
  }
  if (!found) return;
  state.pendingOperation = null;
  if (pending.type === "create" && state.activeNote === null && !state.dirty) {
    state.activeNote = found;
    fillEditor(found);
  } else if (pending.type === "delete" && state.activeNote?.id === pending.id) {
    clearEditor({ force: true });
  } else if (pending.type === "update" && state.activeNote?.id === pending.id && !state.dirty) {
    state.activeNote = found;
    fillEditor(found);
  }
  if (pending.type !== "delete") {
    state.hasConfirmedSave = true;
    setSaveStatus("已保存", "saved");
  }
  updateActions();
}
function sortedNotes() {
  const list = [...state.notes];
  if (state.sort === "recent") {
    list.sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
      return bTime - aTime || Number(b.id) - Number(a.id);
    });
  } else list.sort((a, b) => Number(b.id) - Number(a.id));
  return list;
}
function renderNotes() {
  const keyword = els.noteSearch.value.trim().toLocaleLowerCase();
  const filtered = sortedNotes().filter((note) => !keyword ||
    String(note.title || "").toLocaleLowerCase().includes(keyword)
    || String(note.content || "").toLocaleLowerCase().includes(keyword));
  if (!filtered.length) {
    els.notesList.innerHTML = `<div class="empty-state">${keyword ? "没有找到匹配的笔记" : "还没有笔记，点击「新建笔记」开始"}</div>`;
    return;
  }
  els.notesList.innerHTML = filtered.map((note) => {
    const active = state.activeNote?.id === note.id;
    return `<button type="button" class="note-item${active ? " active" : ""}" data-note-id="${Number(note.id)}" aria-current="${active ? "true" : "false"}" title="${escapeHtml(note.title || "无标题笔记")}">`
      + `<svg class="note-item-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h8l3 3V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z"/><path d="M15 3.5v4h3"/></svg>`
      + `<span class="note-item-title">${escapeHtml(note.title || "无标题笔记")}</span>`
      + `</button>`;
  }).join("");
}

function setSaveStatus(text, kind = "") {
  const mode = kind || (/失败/.test(text) ? "error"
    : /正在/.test(text) ? "busy"
    : /待确认|已入队/.test(text) ? "pending"
    : /尚未保存|未保存/.test(text) ? "dirty"
    : text === "已保存" ? "saved" : "idle");
  els.saveStatus.textContent = text;
  els.saveStatus.dataset.status = mode;
  els.retryStatusButton.hidden = mode !== "pending";
}
function updateActions() {
  const pending = Boolean(state.pendingOperation);
  els.saveNoteButton.disabled = state.busy || pending || !state.user;
  els.saveNoteButton.classList.toggle("is-dirty", state.dirty && !pending);
  els.saveNoteButton.setAttribute("aria-label", state.activeNote ? "保存笔记" : "创建笔记");
  els.saveNoteButton.title = pending ? "等待后台确认写入" : state.activeNote ? "保存笔记 (Ctrl+S)" : "创建笔记 (Ctrl+S)";
  els.noteTitle.disabled = state.busy;
  els.noteContent.disabled = state.busy;
  els.deleteNoteButton.hidden = !state.activeNote;
  els.deleteNoteButton.disabled = state.busy || pending || !state.activeNote || !state.user
    || state.activeNote.authorId !== state.user.id;
}
function updateCharCount() { els.charCount.textContent = `${els.noteContent.value.length} 字符`; }
function markEdited() {
  state.dirty = els.noteTitle.value !== state.baseline.title
    || els.noteContent.value !== state.baseline.content;
  if (!state.pendingOperation) setSaveStatus(
    state.dirty ? (state.hasConfirmedSave ? "尚未保存" : "尚未保存 · 需手动保存")
      : state.activeNote ? "已保存" : "未保存",
    state.dirty ? "dirty" : state.activeNote ? "saved" : "idle"
  );
  updateCharCount();
  updateActions();
}
function canLeaveEditor() {
  if (state.busy) { showToast("当前操作尚未结束，请稍候"); return false; }
  if (state.pendingOperation) {
    showToast("操作仍在后台处理，请使用状态旁的「重新检查」");
    return false;
  }
  return !state.dirty || confirm("这篇笔记的修改尚未保存，确定放弃修改吗？");
}
function fillEditor(note) {
  els.noteTitle.value = note.title || "";
  els.noteContent.value = note.content || "";
  state.baseline = { title: els.noteTitle.value, content: els.noteContent.value };
  state.dirty = false;
  els.noteDate.textContent = `更新于 ${formatDate(note.updatedAt || note.createdAt) || "未知日期"}`;
  setSaveStatus("已保存", "saved");
  updateActions();
  updateCharCount();
  renderNotes();
}
function clearEditor({ force = false } = {}) {
  if (!force && !canLeaveEditor()) return false;
  state.requestSerial++;
  state.activeNote = null;
  state.dirty = false;
  state.baseline = { title: "", content: "" };
  els.noteDate.textContent = "开始记录你的想法";
  els.noteTitle.value = "";
  els.noteContent.value = "";
  setSaveStatus("未保存", "idle");
  updateActions();
  updateCharCount();
  renderNotes();
  setSidebar(false);
  return true;
}
async function openNote(id) {
  if (state.activeNote?.id === id) { setSidebar(false); return; }
  if (!canLeaveEditor()) return;
  const serial = ++state.requestSerial;
  try {
    const note = await api(`/api/notes/${id}`);
    if (serial !== state.requestSerial || !state.user) return;
    state.activeNote = note;
    fillEditor(note);
    setSidebar(false);
  } catch (error) {
    if (serial === state.requestSerial) showToast(`打开笔记失败：${error.message}`);
  }
}
function setBusy(busy) { state.busy = busy; updateActions(); }
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function pollNotes(predicate, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    await pause(260 + i * 100);
    const loaded = await loadNotes({ silent: true });
    if (loaded) {
      const result = predicate(state.notes);
      if (result) return result;
    }
  }
  return null;
}
async function saveNote() {
  if (state.busy || state.pendingOperation || !state.user) return;
  const title = els.noteTitle.value.trim();
  const content = els.noteContent.value;
  if (!title) { showToast("请输入笔记标题"); els.noteTitle.focus(); return; }
  if (title.length > 200 || content.length > 100000) { showToast("笔记长度超过限制"); return; }
  if (state.activeNote && state.activeNote.authorId !== state.user.id) {
    showToast("只能修改自己的笔记"); return;
  }
  const id = state.activeNote?.id;
  const pending = id ? { type: "update", id, title, content }
    : { type: "create", title, content, previousIds: new Set(state.notes.map((note) => note.id)) };
  setBusy(true);
  setSaveStatus("正在提交…");
  try {
    await api(id ? `/api/notes/${id}` : "/api/notes", {
      method: id ? "PUT" : "POST", body: JSON.stringify({ title, content })
    });
    state.pendingOperation = pending;
    state.baseline = { title: els.noteTitle.value, content };
    state.dirty = false;
    setSaveStatus("正在确认…");
    const match = await pollNotes((notes) => pending.type === "create"
      ? notes.find((note) => !pending.previousIds.has(note.id) && note.title === title && note.content === content)
      : notes.find((note) => note.id === id && note.title === title && note.content === content));
    if (match) {
      // reconcilePendingOperation() already cleared the pending flag on the confirming GET.
      if (pending.type === "create") {
        state.activeNote = match;
        fillEditor(match);
      } else if (state.activeNote?.id === id) {
        state.activeNote = match;
        fillEditor(match);
      }
      state.hasConfirmedSave = true;
      setSaveStatus("已保存", "saved");
      showToast(id ? "笔记已更新" : "笔记已创建");
    } else {
      setSaveStatus("已入队，待确认", "pending");
      showToast("请求已提交，稍后可在保存状态旁重新检查");
    }
  } catch (error) { setSaveStatus("保存失败", "error"); showToast(error.message); }
  finally { setBusy(false); }
}
async function deleteNote() {
  if (!state.activeNote || state.busy || state.pendingOperation || !state.user) return;
  if (!confirm("确定删除这篇笔记吗？删除后无法恢复。")) return;
  const id = state.activeNote.id;
  setBusy(true);
  try {
    await api(`/api/notes/${id}`, { method: "DELETE" });
    state.pendingOperation = { type: "delete", id };
    setSaveStatus("正在删除…");
    const deleted = await pollNotes((notes) => !notes.some((note) => note.id === id));
    if (deleted) {
      state.pendingOperation = null;
      clearEditor({ force: true });
      showToast("笔记已删除");
    } else {
      setSaveStatus("删除已入队，待确认", "pending");
      showToast("删除请求已提交，稍后可重新检查");
    }
  } catch (error) { setSaveStatus("删除失败", "error"); showToast(error.message); }
  finally { setBusy(false); }
}
function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "user" ? "你" : "Jotang AI";
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = text;
  message.append(label, body);
  els.chatMessages.append(message);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return body;
}
async function sendChat(event) {
  event.preventDefault();
  const message = els.chatInput.value.trim();
  if (!message || els.sendChatButton.disabled) return;
  addMessage("user", message);
  els.chatInput.value = "";
  els.sendChatButton.disabled = true;
  const reply = addMessage("assistant", "正在思考…");
  try {
    const result = await api("/chat", { method: "POST", body: JSON.stringify({ message }) });
    reply.textContent = result?.reply || "没有收到回复";
  } catch (error) { reply.textContent = `请求失败：${error.message}`; }
  finally { els.sendChatButton.disabled = false; els.chatInput.focus(); }
}
async function newChat() {
  if (els.sendChatButton.disabled) { showToast("请等待当前回复完成"); return; }
  try {
    await api("/chat", { method: "DELETE" });
    els.chatMessages.replaceChildren();
    addMessage("assistant", "新会话已开始。可以继续提问，或让我读取某篇笔记。");
    showToast("已开始新会话");
  } catch (error) { showToast(error.message); }
}

els.loginTab.addEventListener("click", () => setAuthMode("login"));
els.registerTab.addEventListener("click", () => setAuthMode("register"));
els.authForm.addEventListener("submit", submitAuth);
function closeMenus() {
  els.accountMenu.hidden = true;
  els.accountMenuButton.setAttribute("aria-expanded", "false");
}
function toggleMenu(button, menu) {
  const open = menu.hidden;
  closeMenus();
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}
els.accountMenuButton.addEventListener("click", () => toggleMenu(els.accountMenuButton, els.accountMenu));
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".popover-anchor")) closeMenus();
});
els.logoutButton.addEventListener("click", () => { closeMenus(); logout(); });
els.menuButton.addEventListener("click", () => setSidebar(!els.notesPanel.classList.contains("open")));
els.sidebarBackdrop.addEventListener("click", () => setSidebar(false));
els.searchButton.addEventListener("click", focusSearch);
els.closeSearchButton.addEventListener("click", () => {
  els.noteSearch.value = "";
  els.sidebarSearch.hidden = true;
  renderNotes();
  els.searchButton.focus();
});
els.newNoteButton.addEventListener("click", () => { if (clearEditor()) els.noteTitle.focus(); });
els.allNotesNav.addEventListener("click", () => { els.noteSearch.value = ""; renderNotes(); });
els.sortOrder.addEventListener("change", (event) => setSort(event.target.value));
els.retryNotesButton.addEventListener("click", () => loadNotes());
els.retryStatusButton.addEventListener("click", async () => {
  if (!state.pendingOperation) return;
  const loaded = await loadNotes();
  if (loaded && state.pendingOperation) showToast("操作仍在处理中，请稍后再检查");
});
els.noteSearch.addEventListener("input", renderNotes);
els.notesList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-note-id]");
  if (target) openNote(Number(target.dataset.noteId));
});
els.noteTitle.addEventListener("input", markEdited);
els.noteContent.addEventListener("input", markEdited);
els.saveNoteButton.addEventListener("click", saveNote);
els.deleteNoteButton.addEventListener("click", deleteNote);
els.aiButton.addEventListener("click", () => setChat(!els.chatPanel.classList.contains("open")));
els.closeChatButton.addEventListener("click", () => setChat(false));
els.chatBackdrop.addEventListener("click", () => setChat(false));
els.chatForm.addEventListener("submit", sendChat);
els.newChatButton.addEventListener("click", newChat);
els.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault(); els.chatForm.requestSubmit();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault(); if (state.user) saveNote();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault(); if (state.user) focusSearch();
  }
  if (event.key === "Escape") { closeMenus(); setSidebar(false); if (els.chatPanel.classList.contains("open")) setChat(false); }
});
window.addEventListener("beforeunload", (event) => {
  if (state.dirty || state.busy || state.pendingOperation) { event.preventDefault(); event.returnValue = ""; }
});

setAuthMode("login");
clearEditor({ force: true });
restoreSession();