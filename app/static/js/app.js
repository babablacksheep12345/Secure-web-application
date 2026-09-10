const API = '/api';

const state = {
    accessToken: localStorage.getItem('access_token') || '',
    refreshToken: localStorage.getItem('refresh_token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    notes: [],
    currentView: 'overview',
};

const VIEW_META = {
    overview: { title: 'Overview', breadcrumb: 'Dashboard / Overview' },
    documents: { title: 'Documents', breadcrumb: 'Dashboard / Documents' },
    security: { title: 'Security', breadcrumb: 'Dashboard / Security' },
    admin: { title: 'Administration', breadcrumb: 'Dashboard / Administration' },
};

const params = new URLSearchParams(window.location.search);
if (params.get('access_token')) {
    state.accessToken = params.get('access_token');
    state.refreshToken = params.get('refresh_token') || '';
    localStorage.setItem('access_token', state.accessToken);
    localStorage.setItem('refresh_token', state.refreshToken);
    window.history.replaceState({}, '', '/');
    fetchMe();
}

async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (state.accessToken) headers['Authorization'] = `Bearer ${state.accessToken}`;

    let res = await fetch(`${API}${path}`, { ...options, headers });
    if (res.status === 401 && state.refreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${state.accessToken}`;
            res = await fetch(`${API}${path}`, { ...options, headers });
        }
    }
    return res;
}

async function refreshAccessToken() {
    const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: state.refreshToken }),
    });
    if (!res.ok) { logout(); return false; }
    const data = await res.json();
    state.accessToken = data.access_token;
    state.refreshToken = data.refresh_token;
    localStorage.setItem('access_token', state.accessToken);
    localStorage.setItem('refresh_token', state.refreshToken);
    return true;
}

function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function showAlert(elId, msg, isSuccess = false) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.className = `alert ${isSuccess ? 'alert-success' : 'alert-error'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 6000);
}

function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.querySelector('.btn-text')?.classList.toggle('hidden', loading);
    btn.querySelector('.btn-spinner')?.classList.toggle('hidden', !loading);
}

function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');

    const meta = VIEW_META[view];
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('breadcrumb').textContent = meta.breadcrumb;
    document.getElementById('topbar-new-note').classList.toggle('hidden', view !== 'documents');

    if (view === 'documents') loadNotes();
    if (view === 'admin') loadAdminRecords();
}

function showDashboard() {
    document.getElementById('public-app').classList.add('hidden');
    document.getElementById('dashboard-app').classList.remove('hidden');
    document.body.classList.add('logged-in');

    const { email, role, created_at, oauth_provider } = state.user;
    const initial = email[0].toUpperCase();
    const name = email.split('@')[0];

    document.getElementById('sidebar-avatar').textContent = initial;
    document.getElementById('sidebar-email').textContent = email;
    document.getElementById('sidebar-role').textContent = role;
    document.getElementById('sidebar-role').classList.toggle('admin', role === 'admin');
    document.getElementById('welcome-msg').textContent = `Welcome back, ${name}`;
    document.getElementById('stat-role').textContent = role;
    document.getElementById('account-email').textContent = email;
    document.getElementById('account-role').textContent = role.charAt(0).toUpperCase() + role.slice(1);
    document.getElementById('account-since').textContent = created_at
        ? new Date(created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—';
    document.getElementById('account-auth').textContent = oauth_provider
        ? `${oauth_provider.charAt(0).toUpperCase() + oauth_provider.slice(1)} OAuth`
        : 'Email & Password';

    document.getElementById('nav-admin').classList.toggle('hidden', role !== 'admin');

    switchView('overview');
    refreshNotesData();
}

function showAuth() {
    document.getElementById('public-app').classList.remove('hidden');
    document.getElementById('dashboard-app').classList.add('hidden');
    document.body.classList.remove('logged-in');
}

async function fetchMe() {
    const res = await api('/auth/me');
    if (!res.ok) { logout(); return; }
    state.user = (await res.json()).user;
    localStorage.setItem('user', JSON.stringify(state.user));
    showDashboard();
}

function logout() {
    state.accessToken = '';
    state.refreshToken = '';
    state.user = null;
    state.notes = [];
    localStorage.clear();
    showAuth();
    toast('Signed out successfully');
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function refreshNotesData() {
    const res = await api('/notes');
    if (!res.ok) return;
    state.notes = (await res.json()).notes;
    updateStats();
    renderRecentNotes();
    if (state.currentView === 'documents') renderAllNotes();
}

function updateStats() {
    const count = state.notes.length;
    document.getElementById('stat-notes').textContent = count;
    const countEl = document.getElementById('notes-count');
    if (countEl) {
        countEl.textContent = count === 0
            ? 'No documents yet'
            : `${count} encrypted document${count > 1 ? 's' : ''}`;
    }
}

function renderRecentNotes() {
    const el = document.getElementById('recent-notes');
    if (!state.notes.length) {
        el.innerHTML = `
            <div class="recent-empty">
                <p>No documents yet</p>
                <button class="link-btn" id="recent-create-btn">Create your first document</button>
            </div>`;
        document.getElementById('recent-create-btn')?.addEventListener('click', openNewNoteForm);
        return;
    }
    el.innerHTML = state.notes.slice(0, 5).map(n => `
        <div class="recent-item">
            <div class="recent-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
            <div class="recent-item-body">
                <strong>${escapeHtml(n.title)}</strong>
                <span>${formatDate(n.updated_at)}</span>
            </div>
        </div>`).join('');
}

function renderAllNotes() {
    const list = document.getElementById('notes-list');
    updateStats();
    if (!state.notes.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <h3>No documents</h3>
                <p>Create your first encrypted document to get started.</p>
                <button class="btn btn-primary btn-sm" id="empty-create-btn">Create Document</button>
            </div>`;
        document.getElementById('empty-create-btn')?.addEventListener('click', openNewNoteForm);
        return;
    }
    list.innerHTML = state.notes.map((note, i) => `
        <div class="note-card" style="animation-delay:${i * 0.04}s">
            <div class="note-card-header">
                <h4>${escapeHtml(note.title)}</h4>
                <span class="note-date">${formatDate(note.updated_at)}</span>
            </div>
            <p>${escapeHtml(note.content)}</p>
            <div class="note-actions">
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${note.id}">Edit</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${note.id}">Delete</button>
            </div>
        </div>`).join('');

    list.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', () => editNote(btn.dataset.id)));
    list.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', () => deleteNote(btn.dataset.id)));
}

async function loadNotes() { renderAllNotes(); }

function openNewNoteForm() {
    switchView('documents');
    document.getElementById('note-form-card').classList.remove('hidden');
    document.getElementById('note-form-title').textContent = 'New Document';
    document.getElementById('note-id').value = '';
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-title').focus();
}

function editNote(id) {
    const note = state.notes.find(n => n.id == id);
    if (!note) return;
    switchView('documents');
    document.getElementById('note-form-card').classList.remove('hidden');
    document.getElementById('note-form-title').textContent = 'Edit Document';
    document.getElementById('note-id').value = id;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
}

async function loadAdminRecords() {
    const res = await api('/notes/admin/all');
    const el = document.getElementById('admin-results');
    if (!res.ok) {
        el.innerHTML = '<p class="subtitle">Access denied.</p>';
        return;
    }
    const data = await res.json();
    el.innerHTML = data.notes.length
        ? `<table class="admin-table"><thead><tr><th>Document</th><th>Owner</th><th>Last Updated</th></tr></thead><tbody>
            ${data.notes.map(n => `<tr><td>${escapeHtml(n.title)}</td><td>${escapeHtml(n.owner_email)}</td><td>${formatDate(n.updated_at)}</td></tr>`).join('')}
           </tbody></table>`
        : '<p class="subtitle">No records found.</p>';
}

// ── Event listeners ──
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
        document.getElementById('auth-error').classList.add('hidden');
        document.getElementById('auth-success').classList.add('hidden');
    });
});

document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
    });
});

document.getElementById('reg-password')?.addEventListener('input', (e) => {
    const pw = e.target.value;
    const fill = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[@$!%*?&]/.test(pw)) score++;
    const widths = ['0%', '25%', '50%', '75%', '100%'];
    const colors = ['transparent', '#dc2626', '#d97706', '#1e40af', '#059669'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    fill.style.width = widths[score];
    fill.style.background = colors[score];
    label.textContent = pw.length === 0
        ? 'Uppercase, lowercase, number & special character required'
        : `${labels[score]} password`;
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    setLoading(btn, true);
    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value,
            }),
        });
        const data = await res.json();
        if (!res.ok) return showAlert('auth-error', data.error);
        state.accessToken = data.access_token;
        state.refreshToken = data.refresh_token;
        state.user = data.user;
        localStorage.setItem('access_token', state.accessToken);
        localStorage.setItem('refresh_token', state.refreshToken);
        localStorage.setItem('user', JSON.stringify(state.user));
        toast('Signed in — loading dashboard...');
        showDashboard();
    } finally {
        setLoading(btn, false);
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    setLoading(btn, true);
    try {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value,
            }),
        });
        const data = await res.json();
        if (!res.ok) return showAlert('auth-error', data.error);
        state.accessToken = data.access_token;
        state.refreshToken = data.refresh_token;
        state.user = data.user;
        localStorage.setItem('access_token', state.accessToken);
        localStorage.setItem('refresh_token', state.refreshToken);
        localStorage.setItem('user', JSON.stringify(state.user));
        toast('Account created — opening dashboard...');
        showDashboard();
    } finally {
        setLoading(btn, false);
    }
});

document.getElementById('logout-btn').addEventListener('click', logout);

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
});

document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.goto));
});

['new-note-btn', 'topbar-new-note', 'overview-new-note'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', openNewNoteForm);
});

document.getElementById('cancel-note-btn').addEventListener('click', () => {
    document.getElementById('note-form-card').classList.add('hidden');
});

document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('note-id').value;
    const body = {
        title: document.getElementById('note-title').value,
        content: document.getElementById('note-content').value,
    };
    const res = id
        ? await api(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api('/notes', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) return showAlert('dashboard-error', 'Failed to save document');
    document.getElementById('note-form-card').classList.add('hidden');
    toast(id ? 'Document updated' : 'Document created');
    await refreshNotesData();
    if (state.currentView === 'documents') renderAllNotes();
});

async function deleteNote(id) {
    if (!confirm('Permanently delete this document?')) return;
    const res = await api(`/notes/${id}`, { method: 'DELETE' });
    if (!res.ok) return showAlert('dashboard-error', 'Failed to delete document');
    toast('Document deleted');
    await refreshNotesData();
    renderAllNotes();
}

document.getElementById('admin-fetch-btn')?.addEventListener('click', loadAdminRecords);

if (state.accessToken) fetchMe();
