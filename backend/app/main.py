from pathlib import Path
import time

import app.models  # noqa: F401
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config import (
    APP_NAME,
    CORS_ORIGINS,
    DATABASE_STARTUP_MAX_RETRIES,
    DATABASE_STARTUP_RETRY_SECONDS,
)
from app.db import Base, SessionLocal, engine
from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.data_provenance import router as data_provenance_router
from app.routes.decision_history import router as decision_history_router
from app.routes.demo_setup import router as demo_setup_router
from app.routes.members import router as members_router
from app.routes.ml_baseline import router as ml_baseline_router
from app.routes.projects import router as projects_router
from app.routes.recommendations import router as recommendations_router
from app.routes.skills import router as skills_router
from app.routes.task_resources import router as task_resources_router
from app.routes.tasks import router as tasks_router
from app.routes.training_data import router as training_data_router
from app.routes.users import router as users_router
from app.services.bootstrap_service import bootstrap_application

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
TASK_RESOURCES_DIR = UPLOADS_DIR / "task_resources"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
TASK_RESOURCES_DIR.mkdir(parents=True, exist_ok=True)


def initialize_database() -> None:
    last_error: Exception | None = None

    for attempt in range(1, DATABASE_STARTUP_MAX_RETRIES + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))

            Base.metadata.create_all(bind=engine)

            db = SessionLocal()
            try:
                result = bootstrap_application(db)
                if result.roles_created or result.areas_created or result.skills_created or result.admin_created:
                    print(
                        "NeuroKanban bootstrap: "
                        f"roles={result.roles_created}, "
                        f"areas={result.areas_created}, "
                        f"skills={result.skills_created}, "
                        f"admin_created={result.admin_created}"
                    )
            finally:
                db.close()

            return
        except OperationalError as exc:
            last_error = exc
            print(
                "Esperando conexión con la base de datos "
                f"({attempt}/{DATABASE_STARTUP_MAX_RETRIES})..."
            )
            time.sleep(DATABASE_STARTUP_RETRY_SECONDS)

    raise RuntimeError("No se pudo inicializar la base de datos") from last_error


initialize_database()

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(users_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(task_resources_router)
app.include_router(members_router)
app.include_router(recommendations_router)
app.include_router(skills_router)
app.include_router(analytics_router)
app.include_router(ml_baseline_router)
app.include_router(demo_setup_router)
app.include_router(dashboard_router)
app.include_router(decision_history_router)
app.include_router(data_provenance_router)
app.include_router(training_data_router)


@app.get("/")
def root():
    return {"message": "NeuroKanban backend funcionando"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}