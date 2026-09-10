# SecureVault — Secure Web Application

A Flask-based secure notes application demonstrating **authentication**, **authorization**, **encrypted data storage**, and **OWASP Top 10** protections.

## Features

| Security Measure | Implementation |
|---|---|
| **Authentication** | JWT access + refresh tokens |
| **OAuth 2.0** | Google sign-in (Authlib) |
| **Authorization** | Role-based access control (user / admin) |
| **SQL Injection Prevention** | SQLAlchemy ORM (parameterized queries) |
| **Secure Data Storage** | Fernet symmetric encryption at rest |
| **Password Security** | bcrypt hashing with strength validation |
| **Rate Limiting** | Flask-Limiter on auth endpoints |
| **Security Headers** | CSP, X-Frame-Options, HSTS, nosniff |
| **Input Validation** | Email validation, sanitization, length limits |
| **CSRF Protection** | Flask-WTF CSRF (exempt for JSON API) |

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment (optional)
copy .env.example .env

# 4. Run the app
python run.py
```

Open **http://localhost:5000** in your browser.

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@secureapp.local` | `Admin@12345` |

Register a new account to test the user role.

## API Endpoints

### Auth
- `POST /api/auth/register` — Register with email/password
- `POST /api/auth/login` — Login, receive JWT tokens
- `POST /api/auth/refresh` — Refresh access token
- `GET  /api/auth/me` — Get current user (requires JWT)
- `GET  /api/auth/oauth/google` — Google OAuth login

### Notes (requires JWT)
- `GET    /api/notes` — List your notes
- `POST   /api/notes` — Create encrypted note
- `GET    /api/notes/:id` — Get single note
- `PUT    /api/notes/:id` — Update note
- `DELETE /api/notes/:id` — Delete note
- `GET    /api/notes/admin/all` — Admin only: list all notes metadata

## Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web application)
3. Add redirect URI: `http://localhost:5000/api/auth/oauth/google/callback`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

## OWASP Top 10 Coverage

1. **Broken Access Control** — JWT + RBAC; users can only access their own notes
2. **Cryptographic Failures** — bcrypt passwords, Fernet encryption for note content
3. **Injection** — SQLAlchemy ORM prevents SQL injection
4. **Insecure Design** — Short-lived access tokens, refresh token rotation
5. **Security Misconfiguration** — Security headers, secure cookie flags
6. **Vulnerable Components** — Pinned dependency versions
7. **Authentication Failures** — Rate limiting, password policy, account lockout ready
8. **Software/Data Integrity** — Input validation and sanitization
9. **Logging/Monitoring** — Flask logger for admin seed; extend as needed
10. **SSRF** — No outbound user-controlled requests

## Project Structure

```
Project_2/
├── app/
│   ├── auth/          # JWT, OAuth, login/register routes
│   ├── notes/         # CRUD with authorization checks
│   ├── security/      # Encryption, validators, middleware
│   ├── static/        # CSS & JavaScript frontend
│   └── templates/     # HTML templates
├── run.py
├── requirements.txt
└── README.md
```

## Tech Stack

- **Backend:** Python 3, Flask
- **Database:** SQLite (SQLAlchemy ORM)
- **Auth:** JWT (PyJWT), OAuth 2.0 (Authlib)
- **Encryption:** cryptography (Fernet), bcrypt
