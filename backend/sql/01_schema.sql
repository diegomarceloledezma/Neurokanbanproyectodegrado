CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE areas (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    global_role_id BIGINT REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    area_id BIGINT REFERENCES areas(id),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_team VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    area_id BIGINT REFERENCES areas(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled'))
);

CREATE TABLE project_members (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_role VARCHAR(80) NOT NULL,
    weekly_capacity_hours NUMERIC(5,2) DEFAULT 40,
    availability_percentage NUMERIC(5,2) DEFAULT 100,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

CREATE TABLE skills (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    category VARCHAR(100),
    area_id BIGINT REFERENCES areas(id),
    description TEXT
);

CREATE TABLE user_skills (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    level INT NOT NULL CHECK (level BETWEEN 1 AND 5),
    years_experience NUMERIC(4,1) DEFAULT 0,
    verified_by_leader BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_id)
);

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    complexity INT NOT NULL CHECK (complexity BETWEEN 1 AND 5),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    estimated_hours NUMERIC(6,2),
    actual_hours NUMERIC(6,2) DEFAULT 0,
    due_date DATE,
    created_by BIGINT REFERENCES users(id),
    assigned_to BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (task_type IN ('feature', 'bug', 'improvement', 'research', 'documentation', 'design', 'marketing', 'operations', 'other')),
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CHECK (status IN ('pending', 'in_progress', 'review', 'done', 'blocked'))
);

CREATE TABLE task_required_skills (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    required_level INT NOT NULL CHECK (required_level BETWEEN 1 AND 5),
    UNIQUE(task_id, skill_id)
);

CREATE TABLE task_status_history (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by BIGINT REFERENCES users(id),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE work_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hours_logged NUMERIC(6,2) NOT NULL CHECK (hours_logged >= 0),
    notes TEXT,
    logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recommendations (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    recommended_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC(6,2) NOT NULL,
    rank_position INT NOT NULL,
    reason_summary TEXT,
    workload_score NUMERIC(6,2),
    skill_match_score NUMERIC(6,2),
    availability_score NUMERIC(6,2),
    performance_score NUMERIC(6,2),
    risk_level VARCHAR(20),
    strategy VARCHAR(30) NOT NULL DEFAULT 'balance',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (risk_level IN ('low', 'medium', 'high') OR risk_level IS NULL)
);

CREATE TABLE assignment_decisions (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_to BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by BIGINT REFERENCES users(id),
    source VARCHAR(30) NOT NULL DEFAULT 'manual',
    strategy VARCHAR(30),
    recommendation_score NUMERIC(6,2),
    risk_level VARCHAR(20),
    reason TEXT,
    recommendation_used BOOLEAN NOT NULL DEFAULT TRUE,
    workload_score NUMERIC(6,2),
    skill_match_score NUMERIC(6,2),
    availability_score NUMERIC(6,2),
    performance_score NUMERIC(6,2),
    current_load_snapshot NUMERIC(6,2),
    availability_snapshot NUMERIC(6,2),
    active_tasks_snapshot INT,
    required_skills_count INT,
    matching_skills_count INT,
    estimated_hours_snapshot NUMERIC(6,2),
    priority_snapshot VARCHAR(20),
    complexity_snapshot INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (risk_level IN ('low', 'medium', 'high') OR risk_level IS NULL),
    CHECK (source IN ('manual', 'recommended', 'simulated', 'hybrid'))
);

CREATE TABLE task_outcomes (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    finished_on_time BOOLEAN,
    delay_hours NUMERIC(6,2) DEFAULT 0,
    quality_score INT CHECK (quality_score BETWEEN 1 AND 5),
    had_rework BOOLEAN DEFAULT FALSE,
    outcome_notes TEXT,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);