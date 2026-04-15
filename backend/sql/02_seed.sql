INSERT INTO roles (name, description) VALUES
('admin', 'Administrador general del sistema'),
('leader', 'Líder de equipo'),
('member', 'Integrante del equipo');

INSERT INTO areas (name, description) VALUES
('Software', 'Desarrollo de software'),
('Diseño', 'Diseño gráfico y UX/UI'),
('Marketing', 'Marketing y contenido'),
('Administración', 'Gestión administrativa'),
('Multidisciplinario', 'Equipos con distintas áreas');

INSERT INTO users (full_name, username, email, password_hash, global_role_id)
VALUES
('Diego Flores', 'diego', 'diego@example.com', 'temp_hash_123', 2),
('Ana Pérez', 'ana', 'ana@example.com', 'temp_hash_123', 3),
('Luis Rojas', 'luis', 'luis@example.com', 'temp_hash_123', 3),
('María Gómez', 'maria', 'maria@example.com', 'temp_hash_123', 3);

INSERT INTO teams (name, description, area_id, created_by)
VALUES
('Equipo NeuroKanban', 'Equipo principal del proyecto', 5, 1);

INSERT INTO team_members (team_id, user_id, role_in_team)
VALUES
(1, 1, 'leader'),
(1, 2, 'member'),
(1, 3, 'member'),
(1, 4, 'member');

INSERT INTO projects (team_id, area_id, name, description, status, start_date, created_by)
VALUES
(1, 5, 'NeuroKanban MVP', 'Primera versión funcional del sistema', 'active', CURRENT_DATE, 1);

INSERT INTO project_members (project_id, user_id, project_role, weekly_capacity_hours, availability_percentage)
VALUES
(1, 1, 'Project Leader', 20, 100),
(1, 2, 'Frontend Support', 15, 80),
(1, 3, 'Backend Support', 15, 75),
(1, 4, 'Research and Documentation', 10, 60);

INSERT INTO skills (name, category, area_id, description)
VALUES
('React', 'Frontend', 1, 'Desarrollo de interfaces'),
('PostgreSQL', 'Base de Datos', 1, 'Diseño y consultas SQL'),
('FastAPI', 'Backend', 1, 'APIs con Python'),
('UX/UI', 'Diseño', 2, 'Diseño de experiencia e interfaces'),
('Documentación', 'Gestión', 5, 'Redacción y documentación técnica'),
('Investigación', 'Análisis', 5, 'Levantamiento y análisis de información'),
('Redacción', 'Comunicación', 5, 'Producción de textos y copy'),
('Coordinación', 'Operaciones', 5, 'Gestión operativa y seguimiento');

INSERT INTO user_skills (user_id, skill_id, level, years_experience, verified_by_leader)
VALUES
(1, 2, 4, 1.5, true),
(1, 3, 4, 1.5, true),
(2, 1, 4, 1.0, true),
(2, 4, 3, 1.0, true),
(3, 2, 3, 1.0, true),
(3, 3, 3, 1.0, true),
(4, 5, 4, 2.0, true),
(4, 6, 4, 2.0, true),
(4, 7, 4, 2.0, true),
(1, 8, 3, 1.2, true);

INSERT INTO tasks (project_id, title, description, task_type, priority, complexity, status, estimated_hours, due_date, created_by, assigned_to)
VALUES
(1, 'Diseñar modelo de base de datos', 'Definir tablas y relaciones principales', 'documentation', 'high', 4, 'in_progress', 8, CURRENT_DATE + 5, 1, 3),
(1, 'Diseñar pantalla de login', 'Pantalla inicial del sistema', 'design', 'medium', 2, 'pending', 4, CURRENT_DATE + 4, 1, 2),
(1, 'Definir requerimientos funcionales', 'Lista inicial de requerimientos del sistema', 'research', 'high', 3, 'review', 6, CURRENT_DATE + 2, 1, 4);

INSERT INTO task_required_skills (task_id, skill_id, required_level)
VALUES
(1, 2, 3),
(1, 3, 3),
(2, 1, 3),
(2, 4, 2),
(3, 5, 3),
(3, 6, 3);

INSERT INTO assignment_decisions (task_id, assigned_to, assigned_by, source, strategy, recommendation_score, risk_level, reason, recommendation_used)
VALUES
(1, 3, 1, 'recommended', 'efficiency', 86.50, 'low', 'Buena disponibilidad y habilidades alineadas al backend.', true),
(2, 2, 1, 'manual', 'balance', 72.00, 'low', 'Asignación manual por experiencia previa en interfaz.', false);

INSERT INTO task_outcomes (task_id, finished_on_time, delay_hours, quality_score, had_rework, outcome_notes)
VALUES
(1, true, 0, 4, false, 'Buen desempeño en el diseño técnico inicial');