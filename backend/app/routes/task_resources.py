from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import ProjectMember, Task, TaskResource, User
from app.routes.auth import get_current_user, has_any_role
from app.schemas import TaskResourceResponse, TaskResourceUploaderSummary

router = APIRouter(prefix="/task-resources", tags=["Task Resources"])

BASE_DIR = Path(__file__).resolve().parents[2]
TASK_RESOURCES_DIR = BASE_DIR / "uploads" / "task_resources"
TASK_RESOURCES_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024


def _is_project_member(db: Session, project_id: int, user_id: int) -> bool:
    return (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
        .first()
        is not None
    )


def _can_view_task(db: Session, task: Task, current_user: User) -> bool:
    if has_any_role(current_user, "admin"):
        return True

    if has_any_role(current_user, "leader"):
        if task.created_by == current_user.id:
            return True
        return _is_project_member(db, task.project_id, current_user.id)

    return task.assigned_to == current_user.id


def _can_delete_resource(resource: TaskResource, current_user: User) -> bool:
    if has_any_role(current_user, "admin", "leader"):
        return True
    return resource.uploaded_by == current_user.id


def _sanitize_filename(filename: str) -> str:
    cleaned = Path(filename or "archivo").name.strip()
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", cleaned)
    return cleaned or "archivo"


def _serialize_task_resource(resource: TaskResource) -> TaskResourceResponse:
    relative_path = (resource.file_path or "").replace("\\", "/")
    file_url = f"/uploads/{relative_path.lstrip('/')}" if relative_path else ""

    uploaded_by_user = None
    if resource.uploaded_by_user:
        uploaded_by_user = TaskResourceUploaderSummary.model_validate(resource.uploaded_by_user)

    return TaskResourceResponse(
        id=resource.id,
        task_id=resource.task_id,
        original_filename=resource.original_filename,
        stored_filename=resource.stored_filename,
        content_type=resource.content_type,
        size_bytes=resource.size_bytes or 0,
        note=resource.note,
        file_url=file_url,
        uploaded_by=resource.uploaded_by,
        created_at=resource.created_at,
        uploaded_by_user=uploaded_by_user,
    )


@router.get("/tasks/{task_id}", response_model=list[TaskResourceResponse])
def list_task_resources(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if not _can_view_task(db, task, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver los recursos de esta tarea",
        )

    resources = (
        db.query(TaskResource)
        .options(joinedload(TaskResource.uploaded_by_user))
        .filter(TaskResource.task_id == task_id)
        .order_by(TaskResource.created_at.desc())
        .all()
    )

    return [_serialize_task_resource(resource) for resource in resources]


@router.post("/tasks/{task_id}", response_model=TaskResourceResponse)
async def upload_task_resource(
    task_id: int,
    file: UploadFile = File(...),
    note: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if not _can_view_task(db, task, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para subir recursos a esta tarea",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Debes seleccionar un archivo válido")

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="El archivo supera el límite de 15 MB",
        )

    task_dir = TASK_RESOURCES_DIR / str(task_id)
    task_dir.mkdir(parents=True, exist_ok=True)

    sanitized_name = _sanitize_filename(file.filename)
    stored_filename = f"{uuid4().hex}_{sanitized_name}"
    absolute_path = task_dir / stored_filename
    absolute_path.write_bytes(file_bytes)

    relative_path = f"task_resources/{task_id}/{stored_filename}"

    resource = TaskResource(
        task_id=task_id,
        uploaded_by=current_user.id,
        original_filename=sanitized_name,
        stored_filename=stored_filename,
        file_path=relative_path,
        content_type=file.content_type,
        size_bytes=len(file_bytes),
        note=note.strip() if note else None,
    )

    db.add(resource)
    db.commit()
    db.refresh(resource)

    resource = (
        db.query(TaskResource)
        .options(joinedload(TaskResource.uploaded_by_user))
        .filter(TaskResource.id == resource.id)
        .first()
    )

    return _serialize_task_resource(resource)


@router.delete("/{resource_id}")
def delete_task_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resource = (
        db.query(TaskResource)
        .options(joinedload(TaskResource.task))
        .filter(TaskResource.id == resource_id)
        .first()
    )

    if not resource:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")

    if not _can_delete_resource(resource, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para eliminar este recurso",
        )

    absolute_path = BASE_DIR / "uploads" / resource.file_path

    if absolute_path.exists() and absolute_path.is_file():
        absolute_path.unlink()

    db.delete(resource)
    db.commit()

    return {"message": "Recurso eliminado correctamente"}
