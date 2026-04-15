from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Skill
from app.schemas import SkillBase

router = APIRouter(prefix="/skills", tags=["Skills"])


@router.get("/", response_model=List[SkillBase])
def get_skills(db: Session = Depends(get_db)):
    skills = (
        db.query(Skill)
        .options(joinedload(Skill.area))
        .order_by(Skill.name.asc())
        .all()
    )
    return skills