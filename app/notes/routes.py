from flask import Blueprint, jsonify, request

from app.auth.jwt_utils import jwt_required
from app.models import SecureNote, User, db
from app.security.encryption import decrypt_data, encrypt_data
from app.security.middleware import role_required
from app.security.validators import sanitize_input

notes_bp = Blueprint("notes", __name__, url_prefix="/api/notes")


@notes_bp.route("", methods=["GET"])
@jwt_required
def list_notes(current_user):
    notes = SecureNote.query.filter_by(user_id=current_user.id).order_by(SecureNote.updated_at.desc()).all()
    result = []
    for note in notes:
        try:
            content = decrypt_data(note.content_encrypted)
        except ValueError:
            content = "[decryption error]"
        result.append(note.to_dict(content))
    return jsonify({"notes": result})


@notes_bp.route("", methods=["POST"])
@jwt_required
def create_note(current_user):
    data = request.get_json(silent=True) or {}
    title = sanitize_input(data.get("title", ""), max_length=200)
    content = sanitize_input(data.get("content", ""), max_length=5000)

    if not title:
        return jsonify({"error": "Title is required"}), 400

    note = SecureNote(
        user_id=current_user.id,
        title=title,
        content_encrypted=encrypt_data(content),
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({"note": note.to_dict(content)}), 201


@notes_bp.route("/<int:note_id>", methods=["GET"])
@jwt_required
def get_note(note_id, current_user):
    note = SecureNote.query.filter_by(id=note_id, user_id=current_user.id).first()
    if not note:
        return jsonify({"error": "Note not found"}), 404
    content = decrypt_data(note.content_encrypted)
    return jsonify({"note": note.to_dict(content)})


@notes_bp.route("/<int:note_id>", methods=["PUT"])
@jwt_required
def update_note(note_id, current_user):
    note = SecureNote.query.filter_by(id=note_id, user_id=current_user.id).first()
    if not note:
        return jsonify({"error": "Note not found"}), 404

    data = request.get_json(silent=True) or {}
    if "title" in data:
        note.title = sanitize_input(data["title"], max_length=200)
    content = None
    if "content" in data:
        content = sanitize_input(data["content"], max_length=5000)
        note.content_encrypted = encrypt_data(content)

    db.session.commit()
    decrypted = content if content is not None else decrypt_data(note.content_encrypted)
    return jsonify({"note": note.to_dict(decrypted)})


@notes_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required
def delete_note(note_id, current_user):
    note = SecureNote.query.filter_by(id=note_id, user_id=current_user.id).first()
    if not note:
        return jsonify({"error": "Note not found"}), 404
    db.session.delete(note)
    db.session.commit()
    return jsonify({"message": "Note deleted"})


@notes_bp.route("/admin/all", methods=["GET"])
@role_required("admin")
def admin_list_all_notes(current_user):
    notes = SecureNote.query.order_by(SecureNote.updated_at.desc()).limit(100).all()
    result = []
    for note in notes:
        owner = db.session.get(User, note.user_id)
        result.append(
            {
                "id": note.id,
                "title": note.title,
                "owner_email": owner.email if owner else "unknown",
                "updated_at": note.updated_at.isoformat() if note.updated_at else "",
            }
        )
    return jsonify({"notes": result, "requested_by": current_user.email})
