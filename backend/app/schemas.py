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