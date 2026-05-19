# Despliegue de NeuroKanban con Docker

Este bloque deja NeuroKanban preparado para ejecutarse en contenedores separados:

- `frontend`: React + Vite compilado y servido con Nginx.
- `backend`: FastAPI + Uvicorn.
- `db`: PostgreSQL 16.
- Volumen persistente para la base de datos.
- Volumen persistente para archivos subidos en recursos de tareas.
- Volumen persistente para artefactos del modelo IA.

## 1. Requisitos

Instala y abre Docker Desktop. Luego verifica en terminal:

```bash
docker --version
docker compose version
``` {data-source-line="206"}

## 2. Levantar todo en local

Desde la raíz del proyecto:

```bash
docker compose up --build
``` {data-source-line="214"}

Cuando termine, abre:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`
- Backend Swagger: `http://localhost:8000/docs`

## 3. Usuario inicial para base de datos nueva

Si la base de datos Docker está vacía, el backend crea automáticamente el catálogo base y un administrador inicial.

Credenciales por defecto para entorno local:

```txt
Usuario: admin
Contraseña: Admin12345
``` {data-source-line="231"}

Para despliegue real, cambia estas variables antes de levantar:

```txt
BOOTSTRAP_ADMIN_USERNAME
BOOTSTRAP_ADMIN_EMAIL
BOOTSTRAP_ADMIN_PASSWORD
SECRET_KEY
POSTGRES_PASSWORD
``` {data-source-line="241"}

## 4. Usar archivo de variables controlado

Puedes copiar el ejemplo:

```bash
cp .env.docker.example .env.docker
``` {data-source-line="249"}

Luego editar `.env.docker` y levantar con:

```bash
docker compose --env-file .env.docker up --build
``` {data-source-line="255"}

## 5. Comandos útiles

Ver logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
``` {data-source-line="265"}

Detener contenedores sin borrar datos:

```bash
docker compose down
``` {data-source-line="271"}

Detener y borrar también la base de datos/volúmenes:

```bash
docker compose down -v
``` {data-source-line="277"}

Reconstruir desde cero:

```bash
docker compose up --build --force-recreate
``` {data-source-line="283"}

## 6. Persistencia

Docker conserva información en estos volúmenes:

- `postgres_data`: datos de PostgreSQL.
- `backend_uploads`: archivos subidos como recursos de tareas.
- `backend_ml_artifacts`: modelo IA entrenado y metadatos.

Esto evita perder datos cuando se reinician los contenedores.

## 7. Notas para AWS EC2

Para una primera versión en AWS, el camino más directo es EC2 + Docker Compose:

1. Crear instancia Ubuntu.
2. Instalar Docker y Docker Compose.
3. Clonar/subir el proyecto.
4. Crear `.env.docker` con valores reales.
5. Cambiar:
   - `VITE_API_BASE_URL` al dominio/IP pública del backend.
   - `CORS_ORIGINS` al dominio/IP pública del frontend.
   - `SECRET_KEY`, `POSTGRES_PASSWORD` y `BOOTSTRAP_ADMIN_PASSWORD`.
6. Abrir puertos necesarios en el Security Group.
7. Ejecutar `docker compose --env-file .env.docker up -d --build`.

Para una versión más robusta a futuro, separar PostgreSQL en RDS y archivos en S3.