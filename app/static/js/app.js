const API = '/api';

const state = {
    accessToken: localStorage.getItem('access_token') || '',
    refreshToken: localStorage.getItem('refresh_token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
};

// Handle OAuth redirect tokens
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

function showError(elId, msg) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

function showDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('nav-user').classList.remove('hidden');
    document.getElementById('user-email').textContent = state.user.email;
    document.getElementById('user-role').textContent = state.user.role;

    if (state.user.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
    }
    loadNotes();
}

function showAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('nav-user').classList.add('hidden');
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
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
    });
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
        }),
    });
    const data = await res.json();
    if (!res.ok) return showError('auth-error', data.error);
    state.accessToken = data.access_token;
    state.refreshToken = data.refresh_token;
    state.user = data.user;
    localStorage.setItem('access_token', state.accessToken);
    localStorage.setItem('refresh_token', state.refreshToken);
    localStorage.setItem('user', JSON.stringify(state.user));
    showDashboard();
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: document.getElementById('reg-email').value,
            password: document.getElementById('reg-password').value,
        }),
    });
    const data = await res.json();
    if (!res.ok) return showError('auth-error', data.error);
    state.accessToken = data.access_token;
    state.refreshToken = data.refresh_token;
    state.user = data.user;
    localStorage.setItem('access_token', state.accessToken);
    localStorage.setItem('refresh_token', state.refreshToken);
    localStorage.setItem('user', JSON.stringify(state.user));
    showDashboard();
});

document.getElementById('logout-btn').addEventListener('click', logout);

// Notes
async function loadNotes() {
    const res = await api('/notes');
    if (!res.ok) return showError('dashboard-error', 'Failed to load notes');
    const data = await res.json();
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    if (!data.notes.length) {
        list.innerHTML = '<p style="color:var(--muted)">No notes yet. Create your first secure note!</p>';
        return;
    }
    data.notes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `
            <h4>${escapeHtml(note.title)}</h4>
            <p>${escapeHtml(note.content)}</p>
            <div class="note-actions">
                <button class="btn btn-outline edit-btn" data-id="${note.id}">Edit</button>
                <button class="btn btn-danger delete-btn" data-id="${note.id}">Delete</button>
            </div>`;
        list.appendChild(card);
    });
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editNote(btn.dataset.id, data.notes)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteNote(btn.dataset.id)));
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
    if (!res.ok) return showError('dashboard-error', 'Failed to save note');
    document.getElementById('note-form-card').classList.add('hidden');
    loadNotes();
});

async function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    const res = await api(`/notes/${id}`, { method: 'DELETE' });
    if (!res.ok) return showError('dashboard-error', 'Failed to delete note');
    loadNotes();
}

// Admin
document.getElementById('admin-fetch-btn')?.addEventListener('click', async () => {
    const res = await api('/notes/admin/all');
    const el = document.getElementById('admin-results');
    if (!res.ok) {
        el.textContent = 'Access denied or error.';
        return;
    }
    const data = await res.json();
    el.innerHTML = data.notes.map(n =>
        `<div>📄 ${escapeHtml(n.title)} — owner: ${escapeHtml(n.owner_email)}</div>`
    ).join('') || 'No notes in system.';
});

// Init
if (state.accessToken && state.user) {
    fetchMe();
} else if (state.accessToken) {
    fetchMe();
}
