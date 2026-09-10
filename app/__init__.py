from flask import Flask, render_template
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from werkzeug.middleware.proxy_fix import ProxyFix

from app.auth.oauth import init_oauth
from app.auth.routes import auth_bp
from app.config import Config
from app.models import User, db
from app.notes.routes import notes_bp
from app.security.middleware import add_security_headers

login_manager = LoginManager()
csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    if app.config.get("IS_PRODUCTION"):
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    init_oauth(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(notes_bp)

    limiter.limit("5 per minute")(app.view_functions["auth.register"])
    limiter.limit("10 per minute")(app.view_functions["auth.login"])

    csrf.exempt(auth_bp)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @app.after_request
    def apply_security_headers(response):
        return add_security_headers(response)

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/health")
    def health():
        return {"status": "ok", "security": "enabled"}

    with app.app_context():
        db.create_all()
        _seed_admin(app)

    return app


def _seed_admin(app):
    admin_email = "admin@secureapp.local"
    if not User.query.filter_by(email=admin_email).first():
        admin = User(email=admin_email, role="admin")
        admin.set_password("Admin@12345")
        db.session.add(admin)
        db.session.commit()
        app.logger.info("Seeded admin user: %s / Admin@12345", admin_email)
