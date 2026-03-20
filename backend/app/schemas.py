from typing import Optional
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, ConfigDict


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
    creator: Optional[UserBase] = None

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

    model_config = ConfigDict(from_attributes=True)


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


class TaskAssignRequest(BaseModel):
    assigned_to: int
    assigned_by: Optional[int] = None
    source: str = "manual"
    strategy: Optional[str] = None
    recommendation_score: Optional[float] = None
    risk_level: Optional[str] = None
    reason: Optional[str] = None


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
    experience_level: Optional[float] = None
    active_task_items: list[MemberTaskItem]
    completed_task_items: list[MemberTaskItem]


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
    matching_skills: list[str] = []


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


class TaskSimulationResponse(BaseModel):
    task_id: int
    task_title: str
    strategy: str
    simulations: list[TaskSimulationItem]