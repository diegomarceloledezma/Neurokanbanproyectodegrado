from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    BigInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    users = relationship("User", back_populates="global_role")


class Area(Base):
    __tablename__ = "areas"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    teams = relationship("Team", back_populates="area")
    skills = relationship("Skill", back_populates="area")
    projects = relationship("Project", back_populates="area")


class Team(Base):
    __tablename__ = "teams"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    area_id = Column(BigInteger, ForeignKey("areas.id"), nullable=True)

    area = relationship("Area", back_populates="teams")
    projects = relationship("Project", back_populates="team")


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    username = Column(String(100), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(Text, nullable=True)
    global_role_id = Column(BigInteger, ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    global_role = relationship("Role", back_populates="users")

    project_memberships = relationship(
        "ProjectMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    created_projects = relationship(
        "Project",
        back_populates="creator",
        foreign_keys="Project.created_by",
    )

    created_tasks = relationship(
        "Task",
        back_populates="creator",
        foreign_keys="Task.created_by",
    )

    assigned_tasks = relationship(
        "Task",
        back_populates="assignee",
        foreign_keys="Task.assigned_to",
    )

    user_skills = relationship(
        "UserSkill",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    assignment_histories_as_assigned = relationship(
        "TaskAssignmentHistory",
        back_populates="assigned_user",
        foreign_keys="TaskAssignmentHistory.assigned_to",
    )

    assignment_histories_as_assigner = relationship(
        "TaskAssignmentHistory",
        back_populates="assigned_by_user",
        foreign_keys="TaskAssignmentHistory.assigned_by",
    )

    recommendations_received = relationship(
    "Recommendation",
    back_populates="recommended_user",
    foreign_keys="Recommendation.recommended_user_id",
    cascade="all, delete-orphan",
    )


class Skill(Base):
    __tablename__ = "skills"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    category = Column(String(100), nullable=True)
    area_id = Column(BigInteger, ForeignKey("areas.id"), nullable=True)
    description = Column(Text, nullable=True)

    canonical_name = Column(String(255), nullable=True)
    source_name = Column(String(100), nullable=True)
    source_code = Column(String(100), nullable=True)
    source_version = Column(String(50), nullable=True)
    source_url = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    area = relationship("Area", back_populates="skills")

    user_skills = relationship(
        "UserSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )

    task_required_skills = relationship(
        "TaskRequiredSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )

    skill_aliases = relationship(
        "SkillAlias",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class SkillAlias(Base):
    __tablename__ = "skill_aliases"

    id = Column(BigInteger, primary_key=True, index=True)
    skill_id = Column(BigInteger, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    alias_name = Column(String(255), nullable=False)
    normalized_alias = Column(String(255), nullable=False, unique=True)
    source_name = Column(String(100), nullable=True)
    source_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    skill = relationship("Skill", back_populates="skill_aliases")


class UserSkill(Base):
    __tablename__ = "user_skills"
    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_user_skills_user_skill"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(BigInteger, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    level = Column(Integer, nullable=False, default=3)
    years_experience = Column(Float, nullable=False, default=0)
    verified_by_leader = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="user_skills")
    skill = relationship("Skill", back_populates="user_skills")


class Project(Base):
    __tablename__ = "projects"

    id = Column(BigInteger, primary_key=True, index=True)
    team_id = Column(BigInteger, ForeignKey("teams.id"), nullable=False)
    area_id = Column(BigInteger, ForeignKey("areas.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="active")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    team = relationship("Team", back_populates="projects")
    area = relationship("Area", back_populates="projects")
    creator = relationship("User", back_populates="created_projects", foreign_keys=[created_by])

    members = relationship(
        "ProjectMember",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    tasks = relationship(
        "Task",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_role = Column(String(150), nullable=False)
    weekly_capacity_hours = Column(Float, nullable=True)
    availability_percentage = Column(Float, nullable=True)
    joined_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(100), nullable=False)
    priority = Column(String(50), nullable=False, default="medium")
    complexity = Column(Integer, nullable=False, default=3)
    status = Column(String(50), nullable=False, default="pending")
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, nullable=True)
    due_date = Column(Date, nullable=True)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    assigned_to = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")

    creator = relationship(
        "User",
        back_populates="created_tasks",
        foreign_keys=[created_by],
    )

    assignee = relationship(
        "User",
        back_populates="assigned_tasks",
        foreign_keys=[assigned_to],
    )

    required_skills = relationship(
        "TaskRequiredSkill",
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

    recommendations = relationship(
    "Recommendation",
    back_populates="task",
    cascade="all, delete-orphan",
    )


class TaskRequiredSkill(Base):
    __tablename__ = "task_required_skills"
    __table_args__ = (
        UniqueConstraint("task_id", "skill_id", name="uq_task_required_skills_task_skill"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(BigInteger, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    required_level = Column(Integer, nullable=False, default=3)

    task = relationship("Task", back_populates="required_skills")
    skill = relationship("Skill", back_populates="task_required_skills")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    recommended_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    score = Column(Float, nullable=False)
    rank_position = Column(Integer, nullable=False)
    reason_summary = Column(Text, nullable=True)

    workload_score = Column(Float, nullable=True)
    skill_match_score = Column(Float, nullable=True)
    availability_score = Column(Float, nullable=True)
    performance_score = Column(Float, nullable=True)

    risk_level = Column(String(50), nullable=True)
    strategy = Column(String(50), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    task = relationship("Task", back_populates="recommendations")
    recommended_user = relationship(
        "User",
        back_populates="recommendations_received",
        foreign_keys=[recommended_user_id],
    )


class TaskAssignmentHistory(Base):
    __tablename__ = "task_assignment_history"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    assigned_to = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)

    source = Column(String(50), nullable=False, default="manual")
    strategy = Column(String(50), nullable=True)
    recommendation_score = Column(Float, nullable=True)
    risk_level = Column(String(50), nullable=True)
    reason = Column(Text, nullable=True)
    recommendation_used = Column(Boolean, nullable=False, default=True)

    workload_score = Column(Float, nullable=True)
    skill_match_score = Column(Float, nullable=True)
    availability_score = Column(Float, nullable=True)
    performance_score = Column(Float, nullable=True)

    current_load_snapshot = Column(Float, nullable=True)
    availability_snapshot = Column(Float, nullable=True)
    active_tasks_snapshot = Column(Integer, nullable=True)
    required_skills_count = Column(Integer, nullable=True)
    matching_skills_count = Column(Integer, nullable=True)
    matching_ratio = Column(Float, nullable=True)
    estimated_hours_snapshot = Column(Float, nullable=True)
    priority_snapshot = Column(String(50), nullable=True)
    complexity_snapshot = Column(Integer, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    task = relationship("Task", back_populates="assignment_history")

    assigned_user = relationship(
        "User",
        back_populates="assignment_histories_as_assigned",
        foreign_keys=[assigned_to],
    )

    assigned_by_user = relationship(
        "User",
        back_populates="assignment_histories_as_assigner",
        foreign_keys=[assigned_by],
    )


class TaskOutcome(Base):
    __tablename__ = "task_outcomes"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, unique=True)

    completed_at = Column(DateTime, nullable=True)
    finished_on_time = Column(Boolean, nullable=True)
    delay_hours = Column(Float, nullable=False, default=0)
    quality_score = Column(Integer, nullable=True)
    had_rework = Column(Boolean, nullable=False, default=False)
    rework_count = Column(Integer, nullable=False, default=0)
    success_score = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    task = relationship("Task", back_populates="outcome")