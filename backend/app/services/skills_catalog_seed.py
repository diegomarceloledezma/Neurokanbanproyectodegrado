from sqlalchemy.orm import Session
import unicodedata

from app.models import Skill

CURATED_SKILLS = [
    {
        "name": "Programación",
        "canonical_name": "programacion",
        "category": "Desarrollo de software",
        "description": "Capacidad para desarrollar lógica y código para resolver problemas computacionales.",
        "source_name": "SFIA",
        "source_code": "PROG",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Diseño de software",
        "canonical_name": "diseno de software",
        "category": "Desarrollo de software",
        "description": "Diseño de componentes, estructura y comportamiento de soluciones de software.",
        "source_name": "SFIA",
        "source_code": "SWDN",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Desarrollo frontend",
        "canonical_name": "desarrollo frontend",
        "category": "Desarrollo de software",
        "description": "Construcción de interfaces y experiencia visual de aplicaciones web.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-FE-001",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Desarrollo backend",
        "canonical_name": "desarrollo backend",
        "category": "Desarrollo de software",
        "description": "Implementación de lógica de negocio, servicios y procesamiento del lado servidor.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-BE-001",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Diseño de API",
        "canonical_name": "diseno de api",
        "category": "Desarrollo de software",
        "description": "Definición de contratos, endpoints y estructuras de intercambio entre sistemas.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-API-001",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Gestión de bases de datos",
        "canonical_name": "gestion de bases de datos",
        "category": "Base de datos",
        "description": "Diseño, administración y mantenimiento de estructuras de datos persistentes.",
        "source_name": "SFIA",
        "source_code": "DBAD",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Modelado de datos",
        "canonical_name": "modelado de datos",
        "category": "Base de datos",
        "description": "Definición de entidades, relaciones y estructuras para organizar información.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-DB-001",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Pruebas de software",
        "canonical_name": "pruebas de software",
        "category": "Calidad de software",
        "description": "Validación funcional y técnica de aplicaciones mediante pruebas planificadas.",
        "source_name": "SFIA",
        "source_code": "TEST",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Aseguramiento de calidad",
        "canonical_name": "aseguramiento de calidad",
        "category": "Calidad de software",
        "description": "Control de estándares, verificación y mejora continua de la calidad del producto.",
        "source_name": "SFIA",
        "source_code": "QUAS",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Integración y despliegue",
        "canonical_name": "integracion y despliegue",
        "category": "Infraestructura",
        "description": "Preparación y publicación de soluciones en entornos de ejecución.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-DEVOPS-001",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Seguridad de aplicaciones",
        "canonical_name": "seguridad de aplicaciones",
        "category": "Seguridad",
        "description": "Aplicación de prácticas para proteger sistemas, datos y servicios digitales.",
        "source_name": "SFIA",
        "source_code": "SCTY",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Investigación UX",
        "canonical_name": "investigacion ux",
        "category": "Diseño UX/UI",
        "description": "Obtención de hallazgos sobre usuarios para mejorar la experiencia de uso.",
        "source_name": "ESCO",
        "source_code": "UX-RESEARCH",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Diseño de interfaces",
        "canonical_name": "diseno de interfaces",
        "category": "Diseño UX/UI",
        "description": "Diseño visual y funcional de pantallas e interacciones digitales.",
        "source_name": "ESCO",
        "source_code": "UI-DESIGN",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Prototipado",
        "canonical_name": "prototipado",
        "category": "Diseño UX/UI",
        "description": "Construcción de prototipos para validar ideas y flujos de interacción.",
        "source_name": "ESCO",
        "source_code": "PROTOTYPING",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Arquitectura de información",
        "canonical_name": "arquitectura de informacion",
        "category": "Diseño UX/UI",
        "description": "Organización lógica del contenido y de la navegación de sistemas digitales.",
        "source_name": "ESCO",
        "source_code": "INFORMATION-ARCHITECTURE",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Diseño gráfico",
        "canonical_name": "diseno grafico",
        "category": "Diseño y comunicación visual",
        "description": "Producción de piezas visuales para comunicación, promoción o identidad.",
        "source_name": "ESCO",
        "source_code": "GRAPHIC-DESIGN",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Edición de video",
        "canonical_name": "edicion de video",
        "category": "Diseño y comunicación visual",
        "description": "Montaje y edición de piezas audiovisuales para diversos formatos.",
        "source_name": "ESCO",
        "source_code": "VIDEO-EDITING",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Fotografía",
        "canonical_name": "fotografia",
        "category": "Diseño y comunicación visual",
        "description": "Captura y tratamiento de imágenes con fines comunicacionales o documentales.",
        "source_name": "ESCO",
        "source_code": "PHOTOGRAPHY",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Redacción",
        "canonical_name": "redaccion",
        "category": "Comunicación y contenidos",
        "description": "Producción de textos claros, coherentes y orientados a un propósito específico.",
        "source_name": "O*NET",
        "source_code": "WRITING",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Copywriting",
        "canonical_name": "copywriting",
        "category": "Comunicación y contenidos",
        "description": "Redacción persuasiva orientada a comunicación, conversión o posicionamiento.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-CONTENT-001",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Gestión de redes sociales",
        "canonical_name": "gestion de redes sociales",
        "category": "Marketing digital",
        "description": "Planificación, publicación y monitoreo de contenidos en plataformas sociales.",
        "source_name": "ESCO",
        "source_code": "SOCIAL-MEDIA-MANAGEMENT",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Marketing de contenidos",
        "canonical_name": "marketing de contenidos",
        "category": "Marketing digital",
        "description": "Diseño y ejecución de estrategias de contenido para atraer y fidelizar audiencias.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-MKT-001",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "SEO",
        "canonical_name": "seo",
        "category": "Marketing digital",
        "description": "Optimización de contenido y estructura para mejorar visibilidad en buscadores.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-MKT-002",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Email marketing",
        "canonical_name": "email marketing",
        "category": "Marketing digital",
        "description": "Planificación y ejecución de campañas de correo orientadas a comunicación y conversión.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-MKT-003",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Investigación",
        "canonical_name": "investigacion",
        "category": "Investigación y documentación",
        "description": "Búsqueda, análisis y sistematización de información para resolver problemas.",
        "source_name": "ESCO",
        "source_code": "RESEARCH",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Documentación técnica",
        "canonical_name": "documentacion tecnica",
        "category": "Investigación y documentación",
        "description": "Elaboración de documentación funcional, técnica o de soporte para sistemas y procesos.",
        "source_name": "ESCO",
        "source_code": "TECHNICAL-DOCUMENTATION",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Redacción de informes",
        "canonical_name": "redaccion de informes",
        "category": "Investigación y documentación",
        "description": "Producción estructurada de informes, reportes y entregables documentales.",
        "source_name": "O*NET",
        "source_code": "REPORT-WRITING",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Análisis de requisitos",
        "canonical_name": "analisis de requisitos",
        "category": "Análisis y negocio",
        "description": "Identificación, definición y validación de necesidades funcionales o del negocio.",
        "source_name": "SFIA",
        "source_code": "REQM",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Análisis de negocio",
        "canonical_name": "analisis de negocio",
        "category": "Análisis y negocio",
        "description": "Evaluación de procesos, necesidades y oportunidades para diseñar soluciones.",
        "source_name": "SFIA",
        "source_code": "BUAN",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Análisis de datos",
        "canonical_name": "analisis de datos",
        "category": "Datos",
        "description": "Interpretación de datos para generar hallazgos, patrones y soporte para decisiones.",
        "source_name": "O*NET",
        "source_code": "DATA-ANALYSIS",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Visualización de datos",
        "canonical_name": "visualizacion de datos",
        "category": "Datos",
        "description": "Representación gráfica de información para facilitar análisis y comunicación.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-DATA-001",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Gestión de proyectos",
        "canonical_name": "gestion de proyectos",
        "category": "Gestión y operaciones",
        "description": "Planificación, seguimiento y coordinación de recursos, plazos y entregables.",
        "source_name": "SFIA",
        "source_code": "PRMG",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Scrum",
        "canonical_name": "scrum",
        "category": "Gestión y operaciones",
        "description": "Aplicación de prácticas ágiles para la gestión iterativa del trabajo.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-PM-001",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Kanban",
        "canonical_name": "kanban",
        "category": "Gestión y operaciones",
        "description": "Gestión visual del flujo de trabajo y control progresivo de tareas.",
        "source_name": "PROJECT_CURATED",
        "source_code": "NK-PM-002",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Gestión de riesgos",
        "canonical_name": "gestion de riesgos",
        "category": "Gestión y operaciones",
        "description": "Identificación y tratamiento de riesgos que afectan objetivos o entregables.",
        "source_name": "SFIA",
        "source_code": "BURM",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Coordinación operativa",
        "canonical_name": "coordinacion operativa",
        "category": "Gestión y operaciones",
        "description": "Organización y seguimiento de actividades para asegurar continuidad operativa.",
        "source_name": "ESCO",
        "source_code": "OPERATIONS-COORDINATION",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Gestión de stakeholders",
        "canonical_name": "gestion de stakeholders",
        "category": "Gestión y operaciones",
        "description": "Relación y coordinación con actores clave involucrados en un proyecto o proceso.",
        "source_name": "SFIA",
        "source_code": "RLMT",
        "source_version": "curated-2026a",
        "source_url": "https://sfia-online.org/",
    },
    {
        "name": "Facilitación de reuniones",
        "canonical_name": "facilitacion de reuniones",
        "category": "Gestión y operaciones",
        "description": "Conducción efectiva de reuniones, talleres o espacios de coordinación.",
        "source_name": "O*NET",
        "source_code": "FACILITATION",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Atención al cliente",
        "canonical_name": "atencion al cliente",
        "category": "Servicio y soporte",
        "description": "Interacción y soporte orientado a resolver necesidades de clientes o usuarios.",
        "source_name": "O*NET",
        "source_code": "CUSTOMER-SERVICE",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Soporte técnico",
        "canonical_name": "soporte tecnico",
        "category": "Servicio y soporte",
        "description": "Atención de incidencias técnicas y acompañamiento operativo a usuarios.",
        "source_name": "ESCO",
        "source_code": "TECHNICAL-SUPPORT",
        "source_version": "curated-2026a",
        "source_url": "https://esco.ec.europa.eu/",
    },
    {
        "name": "Planificación",
        "canonical_name": "planificacion",
        "category": "Habilidades transversales",
        "description": "Organización anticipada de actividades, recursos y tiempos para cumplir objetivos.",
        "source_name": "O*NET",
        "source_code": "PLANNING",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Comunicación oral",
        "canonical_name": "comunicacion oral",
        "category": "Habilidades transversales",
        "description": "Capacidad para expresar ideas con claridad en interacciones verbales.",
        "source_name": "O*NET",
        "source_code": "ORAL-COMMUNICATION",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Trabajo en equipo",
        "canonical_name": "trabajo en equipo",
        "category": "Habilidades transversales",
        "description": "Colaboración efectiva con otras personas para alcanzar objetivos comunes.",
        "source_name": "O*NET",
        "source_code": "TEAMWORK",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
    {
        "name": "Resolución de problemas",
        "canonical_name": "resolucion de problemas",
        "category": "Habilidades transversales",
        "description": "Análisis y respuesta estructurada frente a situaciones complejas o imprevistas.",
        "source_name": "O*NET",
        "source_code": "PROBLEM-SOLVING",
        "source_version": "curated-2026a",
        "source_url": "https://www.onetonline.org/",
    },
]

def _normalize_text(value: str | None) -> str:
    if not value:
        return ""

    normalized = unicodedata.normalize("NFKD", value)
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_accents.strip().lower().split())

def seed_curated_skills_catalog(db: Session):
    existing_skills = db.query(Skill).all()

    existing_by_key = {}

    for skill in existing_skills:
        normalized_name = _normalize_text(skill.name)
        normalized_canonical = _normalize_text(skill.canonical_name)

        if normalized_name:
            existing_by_key[normalized_name] = skill

        if normalized_canonical:
            existing_by_key[normalized_canonical] = skill

    created = 0
    updated = 0

    for item in CURATED_SKILLS:
        normalized_name = _normalize_text(item.get("name"))
        normalized_canonical = _normalize_text(item.get("canonical_name"))

        existing = (
            existing_by_key.get(normalized_canonical)
            or existing_by_key.get(normalized_name)
        )

        if existing:
            changed = False

            for field, value in item.items():
                if getattr(existing, field) != value:
                    setattr(existing, field, value)
                    changed = True

            if existing.is_active is not True:
                existing.is_active = True
                changed = True

            if changed:
                updated += 1

            if normalized_name:
                existing_by_key[normalized_name] = existing
            if normalized_canonical:
                existing_by_key[normalized_canonical] = existing

        else:
            new_skill = Skill(
                name=item["name"],
                canonical_name=item["canonical_name"],
                category=item["category"],
                description=item["description"],
                source_name=item["source_name"],
                source_code=item["source_code"],
                source_version=item["source_version"],
                source_url=item["source_url"],
                is_active=True,
            )
            db.add(new_skill)

            if normalized_name:
                existing_by_key[normalized_name] = new_skill
            if normalized_canonical:
                existing_by_key[normalized_canonical] = new_skill

            created += 1

    db.commit()

    return {
        "message": "Catálogo curado de habilidades sembrado correctamente",
        "created": created,
        "updated": updated,
        "total_seed_items": len(CURATED_SKILLS),
    }