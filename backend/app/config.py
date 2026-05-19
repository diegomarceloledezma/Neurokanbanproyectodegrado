from dotenv import load_dotenv
import os

load_dotenv()


def _env_bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_list(name: str, default: str) -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


DATABASE_URL = os.getenv("DATABASE_URL")
APP_NAME = os.getenv("APP_NAME", "NeuroKanban API")
APP_ENV = os.getenv("APP_ENV", "development")

SECRET_KEY = os.getenv("SECRET_KEY", "change_me")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

SQLALCHEMY_ECHO = _env_bool("SQLALCHEMY_ECHO", "true" if APP_ENV == "development" else "false")
DATABASE_STARTUP_MAX_RETRIES = int(os.getenv("DATABASE_STARTUP_MAX_RETRIES", "20"))
DATABASE_STARTUP_RETRY_SECONDS = float(os.getenv("DATABASE_STARTUP_RETRY_SECONDS", "2"))

CORS_ORIGINS = _env_list(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:80,http://127.0.0.1:80",
)

BOOTSTRAP_DEFAULT_ADMIN = _env_bool("BOOTSTRAP_DEFAULT_ADMIN", "false")
BOOTSTRAP_ADMIN_FULL_NAME = os.getenv("BOOTSTRAP_ADMIN_FULL_NAME", "Administrador NeuroKanban")
BOOTSTRAP_ADMIN_USERNAME = os.getenv("BOOTSTRAP_ADMIN_USERNAME", "admin")
BOOTSTRAP_ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "admin@neurokanban.app")
BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "Admin12345")