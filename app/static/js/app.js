const API = '/api';

const state = {
    accessToken: localStorage.getItem('access_token') || '',
    refreshToken: localStorage.getItem('refresh_token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
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
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function showAlert(elId, msg, isSuccess = false) {
    const el = document.getElementById(elId);
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

function showDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('security-info').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('nav-user').classList.remove('hidden');

    const email = state.user.email;
    document.getElementById('user-email').textContent = email;
    document.getElementById('user-avatar').textContent = email[0].toUpperCase();

    const roleEl = document.getElementById('user-role');
    roleEl.textContent = state.user.role;
    roleEl.classList.toggle('admin', state.user.role === 'admin');

    const firstName = email.split('@')[0];
    document.getElementById('welcome-msg').textContent = `Welcome, ${firstName}`;

    if (state.user.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
    }
    loadNotes();
}

function showAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('security-info').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('nav-user').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
}

async function fetchMe() {
    const res = await api('/auth/me');
    if (!res.ok) { logout(); return; }
    const data = await res.json();
    state.user = data.user;
    localStorage.setItem('user', JSON.stringify(state.user));
    showDashboard();
}

function logout() {
    state.accessToken = '';
    state.refreshToken = '';
    state.user = null;
    localStorage.clear();
    showAuth();
    toast('Logged out successfully');
}

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
        btn.textContent = input.type === 'password' ? '👁' : '🙈';
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
    const colors = ['transparent', '#f43f5e', '#f59e0b', '#6366f1', '#10b981'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

    fill.style.width = widths[score];
    fill.style.background = colors[score];
    label.textContent = pw.length === 0
        ? 'Use 8+ chars with upper, lower, number & symbol (@$!%*?&)'
        : labels[score] + ' password';
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
        toast(`Welcome back, ${state.user.email.split('@')[0]}!`);
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
        const email = document.getElementById('reg-email').value;
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
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
        showAlert('auth-success', 'Account created! You can sign in anytime with the same email and password.');
        toast('Account created successfully!');
        setTimeout(showDashboard, 800);
    } finally {
        setLoading(btn, false);
    }
});

document.getElementById('logout-btn').addEventListener('click', logout);

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

async function loadNotes() {
    const res = await api('/notes');
    if (!res.ok) return showAlert('dashboard-error', 'Failed to load notes');
    const data = await res.json();
    const list = document.getElementById('notes-list');
    const countEl = document.getElementById('notes-count');

    countEl.textContent = data.notes.length === 0
        ? 'No notes yet — create your first secure note'
        : `${data.notes.length} encrypted note${data.notes.length > 1 ? 's' : ''}`;

    list.innerHTML = '';
    if (!data.notes.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No notes yet</h3>
                <p>Click "New Note" to create your first encrypted note.</p>
            </div>`;
        return;
    }

    data.notes.forEach((note, i) => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.style.animationDelay = `${i * 0.05}s`;
        card.innerHTML = `
            <div class="note-card-header">
                <h4>${escapeHtml(note.title)}</h4>
                <span class="note-date">${formatDate(note.updated_at)}</span>
            </div>
            <p>${escapeHtml(note.content)}</p>
            <div class="note-actions">
                <button class="btn btn-outline edit-btn" data-id="${note.id}">Edit</button>
                <button class="btn btn-danger delete-btn" data-id="${note.id}">Delete</button>
            </div>`;
        list.appendChild(card);
    });
    document.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', () => editNote(btn.dataset.id, data.notes)));
    document.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', () => deleteNote(btn.dataset.id)));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('new-note-btn').addEventListener('click', () => {
    document.getElementById('note-form-card').classList.remove('hidden');
    document.getElementById('note-form-title').textContent = 'New Note';
    document.getElementById('note-id').value = '';
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-title').focus();
});

document.getElementById('cancel-note-btn').addEventListener('click', () => {
    document.getElementById('note-form-card').classList.add('hidden');
});

function editNote(id, notes) {
    const note = notes.find(n => n.id == id);
    document.getElementById('note-form-card').classList.remove('hidden');
    document.getElementById('note-form-title').textContent = 'Edit Note';
    document.getElementById('note-id').value = id;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
}

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
    if (!res.ok) return showAlert('dashboard-error', 'Failed to save note');
    document.getElementById('note-form-card').classList.add('hidden');
    toast(id ? 'Note updated' : 'Note created');
    loadNotes();
});

async function deleteNote(id) {
    if (!confirm('Delete this note permanently?')) return;
    const res = await api(`/notes/${id}`, { method: 'DELETE' });
    if (!res.ok) return showAlert('dashboard-error', 'Failed to delete note');
    toast('Note deleted');
    loadNotes();
}

document.getElementById('admin-fetch-btn')?.addEventListener('click', async () => {
    const res = await api('/notes/admin/all');
    const el = document.getElementById('admin-results');
    if (!res.ok) {
        el.innerHTML = '<p class="subtitle">Access denied or error.</p>';
        return;
    }
    const data = await res.json();
    el.innerHTML = data.notes.length
        ? data.notes.map(n => `
            <div class="admin-result-item">
                <span>📄 ${escapeHtml(n.title)}</span>
                <span class="owner">${escapeHtml(n.owner_email)}</span>
            </div>`).join('')
        : '<p class="subtitle">No notes in the system.</p>';
});

if (state.accessToken) fetchMe();
