const state = {
    user: null,
    notes: [],
    activeNote: null,
    authMode: "login"
};

const $ = (id) => document.getElementById(id);

const els = {
    authOverlay: $("authOverlay"),
    loginTab: $("loginTab"),
    registerTab: $("registerTab"),
    authForm: $("authForm"),
    authSubmit: $("authSubmit"),
    authHint: $("authHint"),
    usernameInput: $("usernameInput"),
    passwordInput: $("passwordInput"),
    userBadge: $("userBadge"),
    logoutButton: $("logoutButton"),
    notesList: $("notesList"),
    noteSearch: $("noteSearch"),
    refreshNotesButton: $("refreshNotesButton"),
    newNoteButton: $("newNoteButton"),
    noteMeta: $("noteMeta"),
    noteTitle: $("noteTitle"),
    noteContent: $("noteContent"),
    saveNoteButton: $("saveNoteButton"),
    deleteNoteButton: $("deleteNoteButton"),
    saveStatus: $("saveStatus"),
    charCount: $("charCount"),
    chatMessages: $("chatMessages"),
    chatForm: $("chatForm"),
    chatInput: $("chatInput"),
    sendChatButton: $("sendChatButton"),
    newChatButton: $("newChatButton"),
    toast: $("toast")
};

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let body = null;
    const text = await response.text();

    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }

    if (!response.ok) {
        const message = body && body.message
            ? body.message
            : "请求失败：" + response.status;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return body;
}

function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
        els.toast.classList.remove("show");
    }, 2200);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setAuthMode(mode) {
    state.authMode = mode;
    const login = mode === "login";

    els.loginTab.classList.toggle("active", login);
    els.registerTab.classList.toggle("active", !login);
    els.authSubmit.textContent = login ? "登录" : "注册";
    els.authHint.textContent = login
        ? "登录后可以创建笔记、编辑自己的笔记并使用 AI。"
        : "注册完成后会自动切换回登录。";
    els.passwordInput.autocomplete = login ? "current-password" : "new-password";
}

function setUser(user) {
    state.user = user;
    els.userBadge.textContent = user
        ? user.username + " · #" + user.id
        : "未登录";
    els.authOverlay.classList.toggle("hidden", Boolean(user));
}

async function restoreSession() {
    try {
        const user = await api("/api/auth/me");
        setUser(user);
        await loadNotes();
    } catch {
        setUser(null);
    }
}

async function submitAuth(event) {
    event.preventDefault();

    const username = els.usernameInput.value.trim();
    const password = els.passwordInput.value;

    if (!username || !password) {
        showToast("请输入用户名和密码");
        return;
    }

    els.authSubmit.disabled = true;

    try {
        if (state.authMode === "register") {
            await api("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ username, password })
            });

            showToast("注册成功，请登录");
            setAuthMode("login");
            els.passwordInput.value = "";
            els.passwordInput.focus();
            return;
        }

        const user = await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        setUser(user);
        els.passwordInput.value = "";
        showToast("登录成功");
        await loadNotes();
    } catch (error) {
        showToast(error.message);
    } finally {
        els.authSubmit.disabled = false;
    }
}

async function logout() {
    try {
        await api("/api/auth/logout", { method: "POST" });
    } catch {
        // 即使服务端会话已失效，也清理前端状态。
    }

    state.notes = [];
    state.activeNote = null;
    renderNotes();
    clearEditor();
    setUser(null);
}

async function loadNotes() {
    try {
        const notes = await api("/api/notes");
        state.notes = Array.isArray(notes)
            ? notes.sort((a, b) => Number(b.id) - Number(a.id))
            : [];
        renderNotes();

        if (state.activeNote) {
            const updated = state.notes.find((note) => note.id === state.activeNote.id);
            if (updated) {
                state.activeNote = updated;
                fillEditor(updated);
            }
        }
    } catch (error) {
        showToast(error.message);
    }
}

function renderNotes() {
    const keyword = els.noteSearch.value.trim().toLowerCase();
    const filtered = state.notes.filter((note) => {
        if (!keyword) return true;
        return String(note.title || "").toLowerCase().includes(keyword)
            || String(note.content || "").toLowerCase().includes(keyword);
    });

    if (!filtered.length) {
        els.notesList.innerHTML = '<div class="empty-state">没有匹配的笔记</div>';
        return;
    }

    els.notesList.innerHTML = filtered.map((note) => {
        const active = state.activeNote && state.activeNote.id === note.id ? " active" : "";
        const mine = state.user && state.user.id === note.authorId ? "我的笔记" : "作者 #" + note.authorId;
        return '<button class="note-item' + active + '" data-note-id="' + note.id + '">' +
            '<div class="note-item-title">' + escapeHtml(note.title || "无标题") + '</div>' +
            '<div class="note-item-preview">' + escapeHtml(note.content || "暂无正文") + '</div>' +
            '<div class="note-item-meta">#' + note.id + ' · ' + escapeHtml(mine) + '</div>' +
            '</button>';
    }).join("");
}

async function openNote(id) {
    try {
        const note = await api("/api/notes/" + id);
        state.activeNote = note;
        fillEditor(note);
        renderNotes();
    } catch (error) {
        showToast(error.message);
    }
}

function fillEditor(note) {
    els.noteMeta.textContent = "NOTE #" + note.id + " · AUTHOR #" + note.authorId;
    els.noteTitle.value = note.title || "";
    els.noteContent.value = note.content || "";
    els.deleteNoteButton.disabled = !state.user || state.user.id !== note.authorId;
    els.saveNoteButton.textContent = "保存修改";
    els.saveStatus.textContent = state.user && state.user.id === note.authorId
        ? "可以编辑"
        : "只读：不是你的笔记";
    updateCharCount();
}

function clearEditor() {
    state.activeNote = null;
    els.noteMeta.textContent = "NEW NOTE";
    els.noteTitle.value = "";
    els.noteContent.value = "";
    els.deleteNoteButton.disabled = true;
    els.saveNoteButton.textContent = "创建笔记";
    els.saveStatus.textContent = "未保存";
    updateCharCount();
    renderNotes();
}

async function saveNote() {
    const title = els.noteTitle.value.trim();
    const content = els.noteContent.value;

    if (!title) {
        showToast("标题不能为空");
        return;
    }

    if (state.activeNote && state.user && state.activeNote.authorId !== state.user.id) {
        showToast("只能修改自己的笔记");
        return;
    }

    els.saveNoteButton.disabled = true;
    els.saveStatus.textContent = "正在提交...";

    try {
        if (state.activeNote) {
            const id = state.activeNote.id;
            await api("/api/notes/" + id, {
                method: "PUT",
                body: JSON.stringify({ title, content })
            });

            showToast("修改已进入 RabbitMQ 队列");
            await waitAndRefresh(id);
        } else {
            await api("/api/notes", {
                method: "POST",
                body: JSON.stringify({ title, content })
            });

            showToast("创建已进入 RabbitMQ 队列");
            await waitAndRefresh(null);
        }
    } catch (error) {
        showToast(error.message);
        els.saveStatus.textContent = "保存失败";
    } finally {
        els.saveNoteButton.disabled = false;
    }
}

async function waitAndRefresh(preferredId) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await loadNotes();

    let next = preferredId
        ? state.notes.find((note) => note.id === preferredId)
        : state.notes.find((note) => state.user && note.authorId === state.user.id);

    if (next) {
        await openNote(next.id);
        els.saveStatus.textContent = "已保存";
    } else {
        clearEditor();
        els.saveStatus.textContent = "已提交";
    }
}

async function deleteNote() {
    if (!state.activeNote) return;

    if (!confirm("确认删除这篇笔记？")) return;

    const id = state.activeNote.id;
    els.deleteNoteButton.disabled = true;

    try {
        await api("/api/notes/" + id, { method: "DELETE" });
        showToast("删除已进入 RabbitMQ 队列");
        clearEditor();
        await new Promise((resolve) => setTimeout(resolve, 450));
        await loadNotes();
    } catch (error) {
        showToast(error.message);
    } finally {
        els.deleteNoteButton.disabled = !state.activeNote;
    }
}

function addMessage(role, content) {
    const wrapper = document.createElement("div");
    wrapper.className = "message " + role;

    const roleEl = document.createElement("div");
    roleEl.className = "message-role";
    roleEl.textContent = role === "user" ? "YOU" : "AI";

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = content;

    wrapper.append(roleEl, body);
    els.chatMessages.appendChild(wrapper);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

    return body;
}

async function sendChat(event) {
    event.preventDefault();

    const message = els.chatInput.value.trim();
    if (!message) return;

    addMessage("user", message);
    els.chatInput.value = "";
    els.sendChatButton.disabled = true;

    const loading = addMessage("assistant", "正在思考...");

    try {
        const result = await api("/chat", {
            method: "POST",
            body: JSON.stringify({ message })
        });

        loading.textContent = result.reply || "模型没有返回文本";
    } catch (error) {
        loading.textContent = "请求失败：" + error.message;
    } finally {
        els.sendChatButton.disabled = false;
        els.chatInput.focus();
    }
}

async function newChat() {
    try {
        await api("/chat", { method: "DELETE" });
        els.chatMessages.innerHTML =
            '<div class="message assistant">' +
            '<div class="message-role">AI</div>' +
            '<div class="message-body">新会话已开始。可以继续聊天，或让我读取某篇笔记。</div>' +
            '</div>';
        showToast("已新建 AI 会话");
    } catch (error) {
        showToast(error.message);
    }
}

function updateCharCount() {
    els.charCount.textContent = els.noteContent.value.length + " 字符";
}

els.loginTab.addEventListener("click", () => setAuthMode("login"));
els.registerTab.addEventListener("click", () => setAuthMode("register"));
els.authForm.addEventListener("submit", submitAuth);
els.logoutButton.addEventListener("click", logout);
els.refreshNotesButton.addEventListener("click", loadNotes);
els.newNoteButton.addEventListener("click", clearEditor);
els.noteSearch.addEventListener("input", renderNotes);
els.saveNoteButton.addEventListener("click", saveNote);
els.deleteNoteButton.addEventListener("click", deleteNote);
els.noteContent.addEventListener("input", updateCharCount);
els.chatForm.addEventListener("submit", sendChat);
els.newChatButton.addEventListener("click", newChat);

els.notesList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-note-id]");
    if (item) {
        openNote(Number(item.dataset.noteId));
    }
});

els.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.chatForm.requestSubmit();
    }
});

setAuthMode("login");
clearEditor();
restoreSession();
