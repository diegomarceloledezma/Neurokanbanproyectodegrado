from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL, SQLALCHEMY_ECHO

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL no está configurada. Define esta variable en backend/.env "
        "o mediante Docker Compose antes de levantar el backend."
    )

engine = create_engine(
    DATABASE_URL,
    echo=SQLALCHEMY_ECHO,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()