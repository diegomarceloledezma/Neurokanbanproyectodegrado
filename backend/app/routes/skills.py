from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Skill, SkillAlias
from app.schemas import (
    SkillAliasResponse,
    SkillAliasSeedResponse,
    SkillCatalogSeedResponse,
    SkillResponse,
)
from app.services.skill_matching import preview_task_user_skill_match
from app.services.skills_alias_seed import seed_curated_skill_aliases
from app.services.skills_catalog_seed import seed_curated_skills_catalog

router = APIRouter(prefix="/skills", tags=["Skills"])


@router.post("/seed-curated-catalog", response_model=SkillCatalogSeedResponse)
def seed_skills_catalog(db: Session = Depends(get_db)):
    result = seed_curated_skills_catalog(db)
    return SkillCatalogSeedResponse(**result)


@router.post("/aliases/seed-curated", response_model=SkillAliasSeedResponse)
def seed_skill_aliases(db: Session = Depends(get_db)):
    result = seed_curated_skill_aliases(db)
    return SkillAliasSeedResponse(**result)


@router.get("/", response_model=List[SkillResponse])
def get_skills(
    query: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    source_name: Optional[str] = Query(default=None),
    only_active: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    skills_query = db.query(Skill)

    if only_active:
        skills_query = skills_query.filter(Skill.is_active.is_(True))

    if query:
        query_text = f"%{query.strip().lower()}%"
        skills_query = skills_query.filter(
            or_(
                func.lower(Skill.name).like(query_text),
                func.lower(func.coalesce(Skill.canonical_name, "")).like(query_text),
                func.lower(func.coalesce(Skill.description, "")).like(query_text),
            )
        )

    if category:
        skills_query = skills_query.filter(
            func.lower(func.coalesce(Skill.category, "")) == category.strip().lower()
        )

    if source_name:
        skills_query = skills_query.filter(
            func.lower(func.coalesce(Skill.source_name, "")) == source_name.strip().lower()
        )

    skills = (
        skills_query.order_by(
            func.lower(func.coalesce(Skill.category, "")).asc(),
            func.lower(Skill.name).asc(),
        ).all()
    )
    return skills


@router.get("/aliases/", response_model=List[SkillAliasResponse])
def get_skill_aliases(
    query: Optional[str] = Query(default=None),
    skill_id: Optional[int] = Query(default=None),
    source_name: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    aliases_query = db.query(SkillAlias).options(joinedload(SkillAlias.skill))

    if skill_id is not None:
        aliases_query = aliases_query.filter(SkillAlias.skill_id == skill_id)

    if source_name:
        aliases_query = aliases_query.filter(
            func.lower(func.coalesce(SkillAlias.source_name, "")) == source_name.strip().lower()
        )

    if query:
        query_text = f"%{query.strip().lower()}%"
        aliases_query = aliases_query.join(SkillAlias.skill).filter(
            or_(
                func.lower(SkillAlias.alias_name).like(query_text),
                func.lower(func.coalesce(SkillAlias.normalized_alias, "")).like(query_text),
                func.lower(func.coalesce(Skill.name, "")).like(query_text),
                func.lower(func.coalesce(Skill.canonical_name, "")).like(query_text),
            )
        )

    aliases = aliases_query.order_by(func.lower(SkillAlias.alias_name).asc()).all()

    return [
        SkillAliasResponse(
            id=alias.id,
            skill_id=alias.skill_id,
            skill_name=alias.skill.name if alias.skill else "No disponible",
            alias_name=alias.alias_name,
            normalized_alias=alias.normalized_alias,
            source_name=alias.source_name,
            source_note=alias.source_note,
            created_at=alias.created_at,
        )
        for alias in aliases
    ]


@router.get("/match-preview/task/{task_id}/user/{user_id}")
def get_skill_match_preview(task_id: int, user_id: int, db: Session = Depends(get_db)):
    try:
        return preview_task_user_skill_match(db, task_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))