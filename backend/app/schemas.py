from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleBase(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AreaBase(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TeamBase(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    area: Optional[AreaBase] = None

    model_config = ConfigDict(from_attributes=True)


class SkillBase(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    area: Optional[AreaBase] = None

    model_config = ConfigDict(from_attributes=True)


class UserSkillResponse(BaseModel):
    id: int
    level: int
    years_experience: float = 0
    verified_by_leader: bool = False
    skill: SkillBase

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    global_role: Optional[RoleBase] = None

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    password: str
    avatar_url: Optional[str] = None
    global_role_id: int


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserBase


class ProjectMemberBase(BaseModel):
    id: int
    project_role: str
    weekly_capacity_hours: Optional[float] = None
    availability_percentage: Optional[float] = None
    joined_at: datetime
    user: Optional[UserBase] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectBase(BaseModel):
    id: int
    team_id: int
    name: str
    description: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    area: Optional[AreaBase] = None
    team: Optional[TeamBase] = None
    creator: Optional[UserBase] = None
    members: list[ProjectMemberBase] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TaskRequiredSkillResponse(BaseModel):
    id: int
    skill_id: int
    required_level: int
    skill: Optional[SkillBase] = None

    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    task_type: str
    priority: str
    complexity: int
    status: str
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    due_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    assignee: Optional[UserBase] = None
    creator: Optional[UserBase] = None
    required_skills: list[TaskRequiredSkillResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TaskRequiredSkillCreate(BaseModel):
    skill_id: int
    required_level: int = Field(ge=1, le=5)


class TaskCreate(BaseModel):
    project_id: int
    title: str
    description: Optional[str] = None
    task_type: str
    priority: str
    complexity: int
    status: str = "pending"
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = 0
    due_date: Optional[date] = None
    created_by: Optional[int] = None
    assigned_to: Optional[int] = None
    required_skills: list[TaskRequiredSkillCreate] = Field(default_factory=list)


class TaskAssignRequest(BaseModel):
    assigned_to: int
    assigned_by: Optional[int] = None
    source: str = "manual"
    strategy: Optional[str] = None
    recommendation_score: Optional[float] = None
    risk_level: Optional[str] = None
    reason: Optional[str] = None
    recommendation_used: bool = True


class AssignmentHistoryItem(BaseModel):
    id: int
    task_id: int
    assigned_to: int
    assigned_by: Optional[int] = None
    source: str
    strategy: Optional[str] = None
    recommendation_score: Optional[float] = None
    risk_level: Optional[str] = None
    reason: Optional[str] = None
    recommendation_used: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MemberTaskItem(BaseModel):
    id: int
    title: str
    priority: str
    status: str
    complexity: int
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class MemberSkillItem(BaseModel):
    skill_name: str
    category: Optional[str] = None
    level: int
    years_experience: float = 0
    verified_by_leader: bool = False


class MemberProfileResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    avatar_url: Optional[str] = None
    role_name: str
    active_tasks: int
    completed_tasks: int
    total_tasks: int
    completion_rate: float
    current_load: float
    availability: float
    project_capacity_hours: Optional[float] = None
    experience_level: Optional[float] = None
    skills: list[MemberSkillItem] = Field(default_factory=list)
    active_task_items: list[MemberTaskItem] = Field(default_factory=list)
    completed_task_items: list[MemberTaskItem] = Field(default_factory=list)


class RecommendationMember(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role_name: str

    model_config = ConfigDict(from_attributes=True)


class TaskRecommendationItem(BaseModel):
    member: RecommendationMember
    score: float
    reason: str
    availability: str
    current_load: str
    risk_level: str
    active_tasks: int
    matching_skills: list[str] = Field(default_factory=list)
    workload_score: Optional[float] = None
    skill_match_score: Optional[float] = None
    availability_score: Optional[float] = None
    performance_score: Optional[float] = None


class TaskRecommendationResponse(BaseModel):
    task_id: int
    task_title: str
    strategy: str
    recommendations: list[TaskRecommendationItem]


class TaskSimulationItem(BaseModel):
    rank: int
    member: RecommendationMember
    score: float
    risk_level: str
    reason: str
    current_load: float
    projected_load: float
    current_availability: float
    projected_availability: float
    current_active_tasks: int
    projected_active_tasks: int
    estimated_hours_impact: float
    matching_skills: list[str] = Field(default_factory=list)


class TaskSimulationResponse(BaseModel):
    task_id: int
    task_title: str
    strategy: str
    simulations: list[TaskSimulationItem]


class TaskInsightResponse(BaseModel):
    task_id: int
    task_title: str
    suggested_strategy: str
    suggested_strategy_label: str
    suggested_area: str
    suggested_skills: list[str]
    confidence_level: str
    detected_signals: list[str]
    explanation: str