from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Project, User
from app.schemas import ProjectBase

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/", response_model=List[ProjectBase])
def get_projects(db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .options(
            joinedload(Project.area),
            joinedload(Project.creator).joinedload(User.global_role),
        )
        .order_by(Project.id.asc())
        .all()
    )
    return projects


@router.get("/{project_id}", response_model=ProjectBase)
def get_project_by_id(project_id: int, db: Session = Depends(get_db)):
    project = (
        db.query(Project)
        .options(
            joinedload(Project.area),
            joinedload(Project.creator).joinedload(User.global_role),
        )
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return project