import unicodedata
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models import Skill, SkillAlias, Task, TaskRequiredSkill, User, UserSkill


def normalize_text(value: str | None) -> str:
    if not value:
        return ""

    normalized = unicodedata.normalize("NFKD", value)
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_accents.strip().lower().split())


def _collect_skill_terms(skill: Skill) -> set[str]:
    terms: set[str] = set()

    name_key = normalize_text(skill.name)
    canonical_key = normalize_text(skill.canonical_name)

    if name_key:
        terms.add(name_key)

    if canonical_key:
        terms.add(canonical_key)

    for alias in getattr(skill, "skill_aliases", []) or []:
        alias_key = normalize_text(alias.alias_name)
        normalized_alias = normalize_text(alias.normalized_alias)

        if alias_key:
            terms.add(alias_key)

        if normalized_alias:
            terms.add(normalized_alias)

    return terms


def _load_task_with_skill_data(db: Session, task_id: int) -> Task | None:
    return (
        db.query(Task)
        .options(
            joinedload(Task.required_skills)
            .joinedload(TaskRequiredSkill.skill)
            .joinedload(Skill.skill_aliases)
        )
        .filter(Task.id == task_id)
        .first()
    )


def _load_user_with_skill_data(db: Session, user_id: int) -> User | None:
    return (
        db.query(User)
        .options(
            joinedload(User.user_skills)
            .joinedload(UserSkill.skill)
            .joinedload(Skill.skill_aliases),
            joinedload(User.global_role),
        )
        .filter(User.id == user_id, User.is_active.is_(True))
        .first()
    )


def preview_task_user_skill_match(db: Session, task_id: int, user_id: int) -> dict[str, Any]:
    task = _load_task_with_skill_data(db, task_id)
    if not task:
        raise ValueError("Tarea no encontrada")

    user = _load_user_with_skill_data(db, user_id)
    if not user:
        raise ValueError("Integrante no encontrado o inactivo")

    required_results: list[dict[str, Any]] = []
    user_skill_items = user.user_skills or []

    exact_matches = 0
    alias_matches = 0
    category_matches = 0

    for required in task.required_skills or []:
        required_skill = required.skill

        if not required_skill:
            required_results.append(
                {
                    "required_skill_id": required.skill_id,
                    "required_skill_name": f"Skill #{required.skill_id}",
                    "required_level": required.required_level,
                    "match_type": "none",
                    "matched_user_skill": None,
                    "matched_user_level": None,
                    "matched_user_years_experience": None,
                    "matched_by": None,
                }
            )
            continue

        required_terms = _collect_skill_terms(required_skill)
        required_category = normalize_text(required_skill.category)

        best_match: dict[str, Any] | None = None

        for user_skill in user_skill_items:
            candidate_skill = user_skill.skill
            if not candidate_skill:
                continue

            candidate_terms = _collect_skill_terms(candidate_skill)
            candidate_category = normalize_text(candidate_skill.category)

            match_type = None
            matched_by = None

            if required_skill.id == candidate_skill.id:
                match_type = "exact"
                matched_by = "skill_id"
            elif required_terms.intersection(candidate_terms):
                match_type = "alias"
                matched_by = sorted(required_terms.intersection(candidate_terms))[0]
            elif required_category and candidate_category and required_category == candidate_category:
                match_type = "category"
                matched_by = required_skill.category

            if not match_type:
                continue

            candidate_data = {
                "required_skill_id": required_skill.id,
                "required_skill_name": required_skill.name,
                "required_level": required.required_level,
                "match_type": match_type,
                "matched_user_skill": candidate_skill.name,
                "matched_user_level": user_skill.level,
                "matched_user_years_experience": user_skill.years_experience,
                "matched_by": matched_by,
            }

            priority = {"exact": 3, "alias": 2, "category": 1}

            if best_match is None:
                best_match = candidate_data
            else:
                current_priority = priority.get(best_match["match_type"], 0)
                new_priority = priority.get(candidate_data["match_type"], 0)

                if new_priority > current_priority:
                    best_match = candidate_data
                elif new_priority == current_priority:
                    current_level = best_match.get("matched_user_level") or 0
                    new_level = candidate_data.get("matched_user_level") or 0

                    if new_level > current_level:
                        best_match = candidate_data

        if best_match is None:
            required_results.append(
                {
                    "required_skill_id": required_skill.id,
                    "required_skill_name": required_skill.name,
                    "required_level": required.required_level,
                    "match_type": "none",
                    "matched_user_skill": None,
                    "matched_user_level": None,
                    "matched_user_years_experience": None,
                    "matched_by": None,
                }
            )
        else:
            required_results.append(best_match)

            if best_match["match_type"] == "exact":
                exact_matches += 1
            elif best_match["match_type"] == "alias":
                alias_matches += 1
            elif best_match["match_type"] == "category":
                category_matches += 1

    required_count = len(required_results)
    matched_count = sum(1 for item in required_results if item["match_type"] != "none")
    matching_ratio = round(matched_count / required_count, 4) if required_count > 0 else 0.0

    return {
        "task_id": task.id,
        "task_title": task.title,
        "user_id": user.id,
        "user_name": user.full_name,
        "user_role": user.global_role.name if user.global_role else None,
        "required_skills_count": required_count,
        "matched_skills_count": matched_count,
        "matching_ratio": matching_ratio,
        "match_summary": {
            "exact_matches": exact_matches,
            "alias_matches": alias_matches,
            "category_matches": category_matches,
            "unmatched": max(0, required_count - matched_count),
        },
        "required_skill_results": required_results,
    }