from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

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

    teams = relationship("Team", back_populates="area")
    projects = relationship("Project", back_populates="area")
    skills = relationship("Skill", back_populates="area")


class Team(Base):
    __tablename__ = "teams"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    area_id = Column(BigInteger, ForeignKey("areas.id"))
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    area = relationship("Area", back_populates="teams")
    creator = relationship("User", back_populates="created_teams")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="team", cascade="all, delete-orphan")


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
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    global_role = relationship("Role", back_populates="users")

    created_teams = relationship("Team", back_populates="creator")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")

    created_projects = relationship("Project", back_populates="creator")
    project_memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")

    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assigned_to")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.created_by")

    user_skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    work_logs = relationship("WorkLog", back_populates="user", cascade="all, delete-orphan")

    recommendation_records = relationship(
        "Recommendation",
        back_populates="member",
        foreign_keys="Recommendation.recommended_user_id",
        cascade="all, delete-orphan",
    )
    assignment_history_received = relationship(
        "TaskAssignmentHistory",
        back_populates="assigned_user",
        foreign_keys="TaskAssignmentHistory.assigned_to",
    )
    assignment_history_made = relationship(
        "TaskAssignmentHistory",
        back_populates="assigned_by_user",
        foreign_keys="TaskAssignmentHistory.assigned_by",
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(BigInteger, primary_key=True, index=True)
    team_id = Column(BigInteger, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_in_team = Column(String(50), nullable=False)
    joined_at = Column(DateTime, nullable=False, server_default=func.now())

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")


class Project(Base):
    __tablename__ = "projects"

    id = Column(BigInteger, primary_key=True, index=True)
    team_id = Column(BigInteger, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    area_id = Column(BigInteger, ForeignKey("areas.id"))
    name = Column(String(150), nullable=False)
    description = Column(Text)
    status = Column(String(30), nullable=False, default="active")
    start_date = Column(Date)
    end_date = Column(Date)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    team = relationship("Team", back_populates="projects")
    area = relationship("Area", back_populates="projects")
    creator = relationship("User", back_populates="created_projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_role = Column(String(80), nullable=False)
    weekly_capacity_hours = Column(Numeric(5, 2), nullable=False, default=40)
    availability_percentage = Column(Numeric(5, 2), nullable=False, default=100)
    joined_at = Column(DateTime, nullable=False, server_default=func.now())

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


class Skill(Base):
    __tablename__ = "skills"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    category = Column(String(100))
    area_id = Column(BigInteger, ForeignKey("areas.id"))
    description = Column(Text)

    area = relationship("Area", back_populates="skills")
    user_skills = relationship("UserSkill", back_populates="skill", cascade="all, delete-orphan")
    task_required_skills = relationship(
        "TaskRequiredSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class UserSkill(Base):
    __tablename__ = "user_skills"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(BigInteger, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    level = Column(Integer, nullable=False)
    years_experience = Column(Numeric(4, 1), nullable=False, default=0)
    verified_by_leader = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", back_populates="user_skills")
    skill = relationship("Skill", back_populates="user_skills")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
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
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigned_to])
    creator = relationship("User", back_populates="created_tasks", foreign_keys=[created_by])
    required_skills = relationship(
        "TaskRequiredSkill",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    status_history = relationship(
        "TaskStatusHistory",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    work_logs = relationship("WorkLog", back_populates="task", cascade="all, delete-orphan")
    recommendations = relationship(
        "Recommendation",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    assignment_history = relationship(
        "TaskAssignmentHistory",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    outcome = relationship(
        "TaskOutcome",
        back_populates="task",
        uselist=False,
        cascade="all, delete-orphan",
    )


class TaskRequiredSkill(Base):
    __tablename__ = "task_required_skills"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(BigInteger, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    required_level = Column(Integer, nullable=False)

    task = relationship("Task", back_populates="required_skills")
    skill = relationship("Skill", back_populates="task_required_skills")


class TaskStatusHistory(Base):
    __tablename__ = "task_status_history"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    old_status = Column(String(30))
    new_status = Column(String(30), nullable=False)
    changed_by = Column(BigInteger, ForeignKey("users.id"))
    changed_at = Column(DateTime, nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="status_history")


class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    hours_logged = Column(Numeric(6, 2), nullable=False)
    notes = Column(Text)
    logged_at = Column(DateTime, nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="work_logs")
    user = relationship("User", back_populates="work_logs")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    recommended_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(6, 2), nullable=False)
    rank_position = Column(Integer, nullable=False)
    reason_summary = Column(Text)
    workload_score = Column(Numeric(6, 2))
    skill_match_score = Column(Numeric(6, 2))
    availability_score = Column(Numeric(6, 2))
    performance_score = Column(Numeric(6, 2))
    risk_level = Column(String(20))
    strategy = Column(String(30), nullable=False, default="balance")
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="recommendations")
    member = relationship(
        "User",
        back_populates="recommendation_records",
        foreign_keys=[recommended_user_id],
    )


class TaskAssignmentHistory(Base):
    __tablename__ = "assignment_decisions"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    assigned_to = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_by = Column(BigInteger, ForeignKey("users.id"))
    source = Column(String(30), nullable=False, default="manual")
    strategy = Column(String(30))
    recommendation_score = Column(Numeric(6, 2))
    risk_level = Column(String(20))
    reason = Column(Text)
    recommendation_used = Column(Boolean, nullable=False, default=True)

    workload_score = Column(Numeric(6, 2))
    skill_match_score = Column(Numeric(6, 2))
    availability_score = Column(Numeric(6, 2))
    performance_score = Column(Numeric(6, 2))
    current_load_snapshot = Column(Numeric(6, 2))
    availability_snapshot = Column(Numeric(6, 2))
    active_tasks_snapshot = Column(Integer)
    required_skills_count = Column(Integer)
    matching_skills_count = Column(Integer)
    estimated_hours_snapshot = Column(Numeric(6, 2))
    priority_snapshot = Column(String(20))
    complexity_snapshot = Column(Integer)

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="assignment_history")
    assigned_user = relationship(
        "User",
        back_populates="assignment_history_received",
        foreign_keys=[assigned_to],
    )
    assigned_by_user = relationship(
        "User",
        back_populates="assignment_history_made",
        foreign_keys=[assigned_by],
    )


class TaskOutcome(Base):
    __tablename__ = "task_outcomes"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, unique=True)
    finished_on_time = Column(Boolean)
    delay_hours = Column(Numeric(6, 2), nullable=False, default=0)
    quality_score = Column(Integer)
    had_rework = Column(Boolean, nullable=False, default=False)
    outcome_notes = Column(Text)
    recorded_at = Column(DateTime, nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="outcome")