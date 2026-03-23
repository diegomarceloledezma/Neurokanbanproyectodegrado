import os
import sys
from pathlib import Path
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ["DATABASE_URL"] = "sqlite:///./test_neurokanban.db"

from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User, Area, Project, Task  # noqa: E402


TEST_DATABASE_URL = "sqlite:///./test_neurokanban.db"
TEST_DATABASE_FILE = "./test_neurokanban.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


def seed_test_data():
    db = TestingSessionLocal()

    admin_role = Role(id=1, name="admin", description="Administrador")
    leader_role = Role(id=2, name="leader", description="Líder")
    member_role = Role(id=3, name="member", description="Integrante")

    area = Area(id=1, name="Tecnología", description="Área tecnológica")

    leader = User(
        id=1,
        full_name="Diego Ledezma",
        username="diego",
        email="diego@example.com",
        password_hash="hashed",
        global_role_id=2,
        is_active=True,
    )
    maria = User(
        id=4,
        full_name="María Gómez",
        username="maria",
        email="maria@example.com",
        password_hash="hashed",
        global_role_id=3,
        is_active=True,
    )
    luis = User(
        id=3,
        full_name="Luis Rojas",
        username="luis",
        email="luis@example.com",
        password_hash="hashed",
        global_role_id=3,
        is_active=True,
    )
    admin = User(
        id=5,
        full_name="Admin Sistema",
        username="admin",
        email="admin@example.com",
        password_hash="hashed",
        global_role_id=1,
        is_active=True,
    )

    project = Project(
        id=1,
        team_id=1,
        area_id=1,
        name="Proyecto NeuroKanban",
        description="Proyecto de prueba",
        status="active",
        created_by=1,
    )

    task_to_analyze = Task(
        id=1,
        project_id=1,
        title="Diseñar modelo de base de datos",
        description="Crear el modelo relacional y la estructura principal del sistema.",
        task_type="technical",
        priority="high",
        complexity=4,
        status="pending",
        estimated_hours=8,
        due_date=date.today() + timedelta(days=3),
        created_by=1,
        assigned_to=None,
    )

    leader_active_task = Task(
        id=2,
        project_id=1,
        title="Coordinar avance del sprint",
        description="Seguimiento del trabajo del equipo",
        task_type="management",
        priority="medium",
        complexity=2,
        status="in_progress",
        estimated_hours=4,
        due_date=date.today() + timedelta(days=5),
        created_by=1,
        assigned_to=1,
    )

    completed_task_for_leader = Task(
        id=3,
        project_id=1,
        title="Validar backlog inicial",
        description="Revisión inicial del backlog",
        task_type="management",
        priority="medium",
        complexity=2,
        status="done",
        estimated_hours=2,
        due_date=date.today() + timedelta(days=1),
        created_by=1,
        assigned_to=1,
    )

    db.add_all([
        admin_role,
        leader_role,
        member_role,
        area,
        leader,
        maria,
        luis,
        admin,
        project,
        task_to_analyze,
        leader_active_task,
        completed_task_for_leader,
    ])
    db.commit()
    db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_test_data()
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists(TEST_DATABASE_FILE):
        os.remove(TEST_DATABASE_FILE)


@pytest.fixture
def client():
    return TestClient(app)