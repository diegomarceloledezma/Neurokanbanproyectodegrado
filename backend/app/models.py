from sqlalchemy import Column, BigInteger, String, Text, Boolean, DateTime, ForeignKey, Date
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