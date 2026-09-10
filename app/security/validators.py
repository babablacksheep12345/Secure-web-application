import re

from email_validator import EmailNotValidError, validate_email

PASSWORD_MIN_LENGTH = 8
PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]")


def validate_email_address(email: str) -> tuple[bool, str]:
    try:
        result = validate_email(email.strip().lower(), check_deliverability=False)
        return True, result.normalized
    except EmailNotValidError as exc:
        return False, str(exc)


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
    if not PASSWORD_PATTERN.match(password):
        return (
            False,
            "Password must include uppercase, lowercase, number, and special character (@$!%*?&)",
        )
    return True, ""


def sanitize_input(text: str, max_length: int = 500) -> str:
    if not text:
        return ""
    cleaned = text.strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned
