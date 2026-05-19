FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt ./requirements-prod.txt
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install -r requirements-prod.txt \
    && python -m pip check

COPY app ./app
COPY sql ./sql

RUN mkdir -p /app/uploads/task_resources /app/app/ml_artifacts \
    && addgroup --system neurokanban \
    && adduser --system --ingroup neurokanban neurokanban \
    && chown -R neurokanban:neurokanban /app

USER neurokanban

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]