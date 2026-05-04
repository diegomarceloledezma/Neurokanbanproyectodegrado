import unicodedata
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Skill, SkillAlias


CURATED_SKILL_ALIASES = [
    {"skill_canonical_name": "desarrollo frontend", "alias_name": "frontend", "source_name": "PROJECT_CURATED", "source_note": "Alias común"},
    {"skill_canonical_name": "desarrollo frontend", "alias_name": "front-end", "source_name": "PROJECT_CURATED", "source_note": "Variante escrita"},
    {"skill_canonical_name": "desarrollo backend", "alias_name": "backend", "source_name": "PROJECT_CURATED", "source_note": "Alias común"},
    {"skill_canonical_name": "desarrollo backend", "alias_name": "back-end", "source_name": "PROJECT_CURATED", "source_note": "Variante escrita"},
    {"skill_canonical_name": "diseno de api", "alias_name": "api", "source_name": "PROJECT_CURATED", "source_note": "Forma abreviada"},
    {"skill_canonical_name": "diseno de api", "alias_name": "api rest", "source_name": "PROJECT_CURATED", "source_note": "Forma común"},
    {"skill_canonical_name": "gestion de bases de datos", "alias_name": "base de datos", "source_name": "PROJECT_CURATED", "source_note": "Forma singular"},
    {"skill_canonical_name": "gestion de bases de datos", "alias_name": "bases de datos", "source_name": "PROJECT_CURATED", "source_note": "Forma plural"},
    {"skill_canonical_name": "gestion de bases de datos", "alias_name": "db", "source_name": "PROJECT_CURATED", "source_note": "Abreviatura común"},
    {"skill_canonical_name": "aseguramiento de calidad", "alias_name": "qa", "source_name": "PROJECT_CURATED", "source_note": "Abreviatura común"},
    {"skill_canonical_name": "pruebas de software", "alias_name": "testing", "source_name": "PROJECT_CURATED", "source_note": "Término común"},
    {"skill_canonical_name": "integracion y despliegue", "alias_name": "devops", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia operativa"},
    {"skill_canonical_name": "seguridad de aplicaciones", "alias_name": "appsec", "source_name": "PROJECT_CURATED", "source_note": "Abreviatura común"},
    {"skill_canonical_name": "investigacion ux", "alias_name": "ux research", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "diseno de interfaces", "alias_name": "ui design", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "diseno de interfaces", "alias_name": "ux/ui", "source_name": "PROJECT_CURATED", "source_note": "Uso combinado frecuente"},
    {"skill_canonical_name": "prototipado", "alias_name": "wireframing", "source_name": "PROJECT_CURATED", "source_note": "Término relacionado frecuente"},
    {"skill_canonical_name": "diseno grafico", "alias_name": "graphic design", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "edicion de video", "alias_name": "video editing", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "redaccion", "alias_name": "writing", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "copywriting", "alias_name": "redaccion publicitaria", "source_name": "PROJECT_CURATED", "source_note": "Forma extendida"},
    {"skill_canonical_name": "gestion de redes sociales", "alias_name": "social media", "source_name": "PROJECT_CURATED", "source_note": "Uso común"},
    {"skill_canonical_name": "marketing de contenidos", "alias_name": "content marketing", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "email marketing", "alias_name": "correo masivo", "source_name": "PROJECT_CURATED", "source_note": "Término operativo"},
    {"skill_canonical_name": "investigacion", "alias_name": "research", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "documentacion tecnica", "alias_name": "documentacion", "source_name": "PROJECT_CURATED", "source_note": "Forma abreviada"},
    {"skill_canonical_name": "redaccion de informes", "alias_name": "report writing", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "analisis de requisitos", "alias_name": "requirements analysis", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "analisis de negocio", "alias_name": "business analysis", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "analisis de datos", "alias_name": "data analysis", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "visualizacion de datos", "alias_name": "data visualization", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "gestion de proyectos", "alias_name": "project management", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "gestion de proyectos", "alias_name": "pm", "source_name": "PROJECT_CURATED", "source_note": "Abreviatura frecuente"},
    {"skill_canonical_name": "scrum", "alias_name": "metodologia scrum", "source_name": "PROJECT_CURATED", "source_note": "Forma extendida"},
    {"skill_canonical_name": "kanban", "alias_name": "metodo kanban", "source_name": "PROJECT_CURATED", "source_note": "Forma extendida"},
    {"skill_canonical_name": "gestion de stakeholders", "alias_name": "stakeholder management", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "atencion al cliente", "alias_name": "customer service", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "soporte tecnico", "alias_name": "technical support", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "planificacion", "alias_name": "planning", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "comunicacion oral", "alias_name": "oral communication", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "trabajo en equipo", "alias_name": "teamwork", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
    {"skill_canonical_name": "resolucion de problemas", "alias_name": "problem solving", "source_name": "PROJECT_CURATED", "source_note": "Equivalencia en inglés"},
]


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""

    normalized = unicodedata.normalize("NFKD", value)
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_accents.strip().lower().split())


def seed_curated_skill_aliases(db: Session):
    skills = db.query(Skill).all()

    skills_by_key = {}
    for skill in skills:
        name_key = _normalize_text(skill.name)
        canonical_key = _normalize_text(skill.canonical_name)

        if name_key:
            skills_by_key[name_key] = skill
        if canonical_key:
            skills_by_key[canonical_key] = skill

    existing_aliases = db.query(SkillAlias).all()
    existing_by_alias = {}

    for alias in existing_aliases:
        key = _normalize_text(alias.normalized_alias or alias.alias_name)
        if key:
            existing_by_alias[key] = alias

    created = 0
    updated = 0
    skipped = 0

    for item in CURATED_SKILL_ALIASES:
        target_key = _normalize_text(item["skill_canonical_name"])
        alias_key = _normalize_text(item["alias_name"])

        target_skill = skills_by_key.get(target_key)

        if not target_skill:
            skipped += 1
            continue

        existing_alias = existing_by_alias.get(alias_key)

        if existing_alias:
            changed = False

            if existing_alias.skill_id != target_skill.id:
                existing_alias.skill_id = target_skill.id
                changed = True

            if existing_alias.alias_name != item["alias_name"]:
                existing_alias.alias_name = item["alias_name"]
                changed = True

            if existing_alias.normalized_alias != alias_key:
                existing_alias.normalized_alias = alias_key
                changed = True

            if existing_alias.source_name != item["source_name"]:
                existing_alias.source_name = item["source_name"]
                changed = True

            if existing_alias.source_note != item["source_note"]:
                existing_alias.source_note = item["source_note"]
                changed = True

            if changed:
                updated += 1
        else:
            new_alias = SkillAlias(
                skill_id=target_skill.id,
                alias_name=item["alias_name"],
                normalized_alias=alias_key,
                source_name=item["source_name"],
                source_note=item["source_note"],
            )
            db.add(new_alias)
            existing_by_alias[alias_key] = new_alias
            created += 1

    db.commit()

    return {
        "message": "Alias curados de habilidades sembrados correctamente",
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_seed_items": len(CURATED_SKILL_ALIASES),
    }