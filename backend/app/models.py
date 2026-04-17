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
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Role(Base):
    __tablename__ = "roles"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)

    users = relationship("User", back_populates="global_role")


class Area(Base):
    __tablename__ = "areas"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)

    teams = relationship("Team", back_populates="area")
    projects = relationship("Project", back_populates="area")
    skills = relationship("Skill", back_populates="area")


class Team(Base):
    __tablename__ = "teams"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    area_id = Column(BigInteger, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True)

    area = relationship("Area", back_populates="teams")
    projects = relationship("Project", back_populates="team")


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(Text, nullable=True)
    global_role_id = Column(BigInteger, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    global_role = relationship("Role", back_populates="users")
    created_projects = relationship("Project", back_populates="creator")
    project_memberships = relationship("ProjectMember", back_populates="user")
    created_tasks = relationship("Task", foreign_keys="Task.created_by", back_populates="creator")
    assigned_tasks = relationship("Task", foreign_keys="Task.assigned_to", back_populates="assignee")
    user_skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(BigInteger, primary_key=True, index=True)
    team_id = Column(BigInteger, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False)
    area_id = Column(BigInteger, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="active", server_default="active")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    team = relationship("Team", back_populates="projects")
    area = relationship("Area", back_populates="projects")
    creator = relationship("User", back_populates="created_projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_role = Column(String(100), nullable=False)
    weekly_capacity_hours = Column(Numeric(5, 2), nullable=True)
    availability_percentage = Column(Numeric(5, 2), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


class Skill(Base):
    __tablename__ = "skills"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    category = Column(String(100), nullable=True)
    area_id = Column(BigInteger, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)

    area = relationship("Area", back_populates="skills")
    user_skills = relationship("UserSkill", back_populates="skill", cascade="all, delete-orphan")
    task_required_skills = relationship(
        "TaskRequiredSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class UserSkill(Base):
    __tablename__ = "user_skills"
    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_user_skills_user_skill"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(BigInteger, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    level = Column(Integer, nullable=False)
    years_experience = Column(Numeric(5, 2), nullable=True, default=0)
    verified_by_leader = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="user_skills")
    skill = relationship("Skill", back_populates="user_skills")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), nullable=False)
    priority = Column(String(20), nullable=False, default="medium", server_default="medium")
    complexity = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending", server_default="pending")
    estimated_hours = Column(Numeric(7, 2), nullable=True)
    actual_hours = Column(Numeric(7, 2), nullable=True)
    due_date = Column(Date, nullable=True)
    created_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    project = relationship("Project", back_populates="tasks")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_tasks")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_tasks")
    required_skills = relationship(
        "TaskRequiredSkill",
        back_populates="task",
        cascade="all, delete-orphan",
    )
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
    __table_args__ = (
        UniqueConstraint("task_id", "skill_id", name="uq_task_required_skills_task_skill"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(BigInteger, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    required_level = Column(Integer, nullable=False)

    task = relationship("Task", back_populates="required_skills")
    skill = relationship("Skill", back_populates="task_required_skills")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    recommended_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(5, 2), nullable=False)
    rank_position = Column(Integer, nullable=False)
    reason_summary = Column(Text, nullable=True)

    workload_score = Column(Numeric(5, 2), nullable=True)
    skill_match_score = Column(Numeric(5, 2), nullable=True)
    availability_score = Column(Numeric(5, 2), nullable=True)
    performance_score = Column(Numeric(5, 2), nullable=True)

    risk_level = Column(String(20), nullable=True)
    strategy = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="recommendations")
    recommended_user = relationship("User")


class TaskAssignmentHistory(Base):
    __tablename__ = "assignment_decisions"

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    assigned_to = Column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    assigned_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    source = Column(String(20), nullable=False, default="manual", server_default="manual")
    strategy = Column(String(30), nullable=True)
    recommendation_score = Column(Numeric(5, 2), nullable=True)
    risk_level = Column(String(20), nullable=True)
    reason = Column(Text, nullable=True)
    recommendation_used = Column(Boolean, nullable=False, default=True, server_default="true")

    workload_score = Column(Numeric(5, 2), nullable=True)
    skill_match_score = Column(Numeric(5, 2), nullable=True)
    availability_score = Column(Numeric(5, 2), nullable=True)
    performance_score = Column(Numeric(5, 2), nullable=True)

    current_load_snapshot = Column(Numeric(5, 2), nullable=True)
    availability_snapshot = Column(Numeric(5, 2), nullable=True)
    active_tasks_snapshot = Column(Integer, nullable=True)
    required_skills_count = Column(Integer, nullable=True)
    matching_skills_count = Column(Integer, nullable=True)
    matching_ratio = Column(Numeric(5, 2), nullable=True)
    estimated_hours_snapshot = Column(Numeric(7, 2), nullable=True)
    priority_snapshot = Column(String(20), nullable=True)
    complexity_snapshot = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="assignment_history")
    assigned_user = relationship("User", foreign_keys=[assigned_to])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])


class TaskOutcome(Base):
    __tablename__ = "task_outcomes"
    __table_args__ = (
        UniqueConstraint("task_id", name="uq_task_outcomes_task"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    task_id = Column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    finished_on_time = Column(Boolean, nullable=True)
    delay_hours = Column(Numeric(7, 2), nullable=True)
    quality_score = Column(Integer, nullable=True)
    had_rework = Column(Boolean, nullable=False, default=False, server_default="false")
    rework_count = Column(Integer, nullable=True, default=0)
    success_score = Column(Numeric(5, 2), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column("recorded_at", DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="outcome")