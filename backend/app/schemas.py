from datetime import date, datetime
from typing import Optional, List

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
    area_id: Optional[int] = None
    description: Optional[str] = None
    canonical_name: Optional[str] = None
    source_name: Optional[str] = None
    source_code: Optional[str] = None
    source_version: Optional[str] = None
    source_url: Optional[str] = None
    is_active: bool = True
    area: Optional[AreaBase] = None

    model_config = ConfigDict(from_attributes=True)


class SkillResponse(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    area_id: Optional[int] = None
    description: Optional[str] = None
    canonical_name: Optional[str] = None
    source_name: Optional[str] = None
    source_code: Optional[str] = None
    source_version: Optional[str] = None
    source_url: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class SkillCatalogSeedResponse(BaseModel):
    message: str
    created: int
    updated: int
    total_seed_items: int


class SkillAliasResponse(BaseModel):
    id: int
    skill_id: int
    skill_name: str
    alias_name: str
    normalized_alias: str
    source_name: Optional[str] = None
    source_note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SkillAliasSeedResponse(BaseModel):
    message: str
    created: int
    updated: int
    skipped: int
    total_seed_items: int


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


class ProjectCreate(BaseModel):
    team_id: int
    area_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    status: str = "active"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_by: Optional[int] = None


class AvailableUserItem(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    role_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectMemberCreateRequest(BaseModel):
    user_id: int
    project_role: str
    weekly_capacity_hours: Optional[float] = None
    availability_percentage: Optional[float] = None


class ProjectMemberResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    project_role: str
    weekly_capacity_hours: Optional[float] = None
    availability_percentage: Optional[float] = None
    joined_at: datetime
    user: UserBase

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


class AssignmentHistoryUserSummary(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    global_role: Optional[RoleBase] = None

    model_config = ConfigDict(from_attributes=True)


class AssignmentHistoryTaskSummary(BaseModel):
    id: int
    project_id: int
    title: str
    priority: str
    status: str
    complexity: int
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    due_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class AssignmentHistoryDetailedItem(BaseModel):
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
    workload_score: Optional[float] = None
    skill_match_score: Optional[float] = None
    availability_score: Optional[float] = None
    performance_score: Optional[float] = None
    current_load_snapshot: Optional[float] = None
    availability_snapshot: Optional[float] = None
    active_tasks_snapshot: Optional[int] = None
    required_skills_count: Optional[int] = None
    matching_skills_count: Optional[int] = None
    matching_ratio: Optional[float] = None
    estimated_hours_snapshot: Optional[float] = None
    priority_snapshot: Optional[str] = None
    complexity_snapshot: Optional[int] = None
    created_at: datetime
    task: AssignmentHistoryTaskSummary
    assigned_user: AssignmentHistoryUserSummary
    assigned_by_user: Optional[AssignmentHistoryUserSummary] = None

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


class MemberSkillManageItem(BaseModel):
    id: int
    skill_id: int
    skill_name: str
    category: Optional[str] = None
    level: int
    years_experience: float = 0
    verified_by_leader: bool = False

    model_config = ConfigDict(from_attributes=True)


class MemberSkillCreateRequest(BaseModel):
    skill_id: int
    level: int = Field(ge=1, le=5)
    years_experience: float = Field(default=0, ge=0)
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
    heuristic_score: Optional[float] = None
    ml_success_probability: Optional[float] = None
    hybrid_score: Optional[float] = None
    model_used: bool = False


class TaskRecommendationResponse(BaseModel):
    task_id: int
    task_title: str
    strategy: str
    mode: str
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
    heuristic_score: Optional[float] = None
    ml_success_probability: Optional[float] = None
    hybrid_score: Optional[float] = None
    model_used: bool = False


class TaskSimulationResponse(BaseModel):
    task_id: int
    task_title: str
    strategy: str
    mode: str
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


class TaskOutcomeCreate(BaseModel):
    completed_at: Optional[datetime] = None
    finished_on_time: Optional[bool] = None
    delay_hours: float = 0
    quality_score: Optional[int] = Field(default=None, ge=1, le=5)
    had_rework: bool = False
    rework_count: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class TaskOutcomeResponse(BaseModel):
    id: int
    task_id: int
    completed_at: Optional[datetime] = None
    finished_on_time: Optional[bool] = None
    delay_hours: float = 0
    quality_score: Optional[int] = None
    had_rework: bool = False
    rework_count: int = 0
    success_score: float
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TrainingDatasetRow(BaseModel):
    assignment_decision_id: int
    task_id: int
    project_id: int
    assigned_to: int
    source: str
    strategy: Optional[str] = None
    recommendation_used: bool
    recommendation_score: Optional[float] = None
    workload_score: Optional[float] = None
    skill_match_score: Optional[float] = None
    availability_score: Optional[float] = None
    performance_score: Optional[float] = None
    current_load_snapshot: Optional[float] = None
    availability_snapshot: Optional[float] = None
    active_tasks_snapshot: Optional[int] = None
    required_skills_count: Optional[int] = None
    matching_skills_count: Optional[int] = None
    matching_ratio: Optional[float] = None
    estimated_hours_snapshot: Optional[float] = None
    priority_snapshot: Optional[str] = None
    complexity_snapshot: Optional[int] = None
    finished_on_time: Optional[bool] = None
    delay_hours: Optional[float] = None
    quality_score: Optional[int] = None
    had_rework: Optional[bool] = None
    success_score: float
    success_label: int


class DashboardProjectItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    members_count: int


class DashboardRecommendationItem(BaseModel):
    id: int
    task_id: int
    task_title: str
    assigned_user_name: str
    recommendation_score: float = 0
    strategy: Optional[str] = None
    source: str
    created_at: datetime


class DashboardOverviewResponse(BaseModel):
    total_projects: int
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    overdue_tasks: int
    team_load_average: float
    average_completion_rate: float
    recent_projects: List[DashboardProjectItem]
    recent_recommendations: List[DashboardRecommendationItem]


class DashboardValuePoint(BaseModel):
    id: int
    name: str
    primary_value: float
    secondary_value: Optional[float] = None


class DashboardStatusDistributionItem(BaseModel):
    id: str
    name: str
    value: int


class DashboardTeamMemberMetricItem(BaseModel):
    id: int
    name: str
    role_name: str
    active_tasks: int
    current_load: float
    completion_rate: float


class DashboardTeamMetricsResponse(BaseModel):
    completed_tasks: int
    delayed_tasks: int
    average_completion_rate: float
    total_tasks: int
    tasks_by_status: List[DashboardStatusDistributionItem]
    workload_data: List[DashboardValuePoint]
    performance_data: List[DashboardValuePoint]
    time_comparison_data: List[DashboardValuePoint]
    team_members: List[DashboardTeamMemberMetricItem]


class DecisionHistoryItem(BaseModel):
    id: int
    task_id: int
    task_title: str
    project_id: int
    task_status: str
    assigned_user_id: int
    assigned_user_name: str
    assigned_user_role: str
    source: str
    strategy: Optional[str] = None
    recommendation_score: float = 0
    risk_level: Optional[str] = None
    reason: Optional[str] = None
    recommendation_used: Optional[bool] = None
    created_at: datetime


class DecisionHistoryResponse(BaseModel):
    total_records: int
    items: List[DecisionHistoryItem]