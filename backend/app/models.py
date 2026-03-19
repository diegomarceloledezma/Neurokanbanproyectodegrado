from sqlalchemy import Column, BigInteger, String, Text, Boolean, DateTime, ForeignKey, Date, Numeric, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(Text)

    users = relationship("User", back_populates="global_role")


class Area(Base):
    __tablename__ = "areas"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)

    projects = relationship("Project", back_populates="area")


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    username = Column(String(80), nullable=False, unique=True)
    email = Column(String(150), nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    avatar_url = Column(Text)
    global_role_id = Column(BigInteger, ForeignKey("roles.id"))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    global_role = relationship("Role", back_populates="users")
    created_projects = relationship("Project", back_populates="creator")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assigned_to")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.created_by")


class Project(Base):
    __tablename__ = "projects"

    id = Column(BigInteger, primary_key=True, index=True)
    team_id = Column(BigInteger, nullable=False)
    area_id = Column(BigInteger, ForeignKey("areas.id"))
    name = Column(String(150), nullable=False)
    description = Column(Text)
    status = Column(String(30), nullable=False, default="active")
    start_date = Column(Date)
    end_date = Column(Date)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    area = relationship("Area", back_populates="projects")
    creator = relationship("User", back_populates="created_projects")
    tasks = relationship("Task", back_populates="project")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id"), nullable=False)
    title = Column(String(180), nullable=False)
    description = Column(Text)
    task_type = Column(String(50), nullable=False)
    priority = Column(String(20), nullable=False, default="medium")
    complexity = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    estimated_hours = Column(Numeric(6, 2))
    actual_hours = Column(Numeric(6, 2), default=0)
    due_date = Column(Date)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    assigned_to = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigned_to])
    creator = relationship("User", back_populates="created_tasks", foreign_keys=[created_by])


class TaskAssignmentHistory(Base):
    __tablename__ = "task_assignment_history"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    assigned_to = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(BigInteger, ForeignKey("users.id"))
    source = Column(String(30), nullable=False, default="manual")
    strategy = Column(String(30))
    recommendation_score = Column(Numeric(5, 2))
    risk_level = Column(String(20))
    reason = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())