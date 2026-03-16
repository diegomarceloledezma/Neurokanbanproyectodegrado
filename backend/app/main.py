from fastapi import FastAPI
from sqlalchemy import text

from app.config import APP_NAME
from app.db import engine
from app.routes.users import router as users_router

app = FastAPI(title=APP_NAME)

app.include_router(users_router)


@app.get("/")
def root():
    return {"message": "NeuroKanban backend funcionando"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}