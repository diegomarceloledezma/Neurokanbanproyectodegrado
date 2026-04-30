import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Plus,
  AlertCircle,
  FolderKanban,
  BarChart3,
  ArrowLeft,
  Clock,
  User,
  BrainCircuit,
} from "lucide-react";
import { getTasksByProject, type TaskResponse } from "../services/taskService";
import { getProjectById, type ProjectResponse } from "../services/projectService";
import { getAccessToken } from "../services/sessionService";

const columns = [
  { id: "pending", name: "Pendientes", color: "border-slate-600" },
  { id: "in_progress", name: "En progreso", color: "border-cyan-500" },
  { id: "review", name: "En revisión", color: "border-purple-500" },
  { id: "done", name: "Finalizadas", color: "border-green-500" },
  { id: "blocked", name: "Bloqueadas", color: "border-red-500" },
];

const priorityColors: Record<string, string> = {
  low: "bg-slate-600/20 text-slate-300 border border-slate-600/20",
  medium: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20",
  high: "bg-orange-500/20 text-orange-400 border border-orange-500/20",
  critical: "bg-red-500/20 text-red-400 border border-red-500/20",
};

const priorityLabels: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const taskTypeLabels: Record<string, string> = {
  feature: "Funcionalidad",
  bug: "Corrección",
  improvement: "Mejora",
  research: "Investigación",
  documentation: "Documentación",
  design: "Diseño",
  marketing: "Marketing",
  operations: "Operaciones",
  other: "Otro",
};

function formatDate(date?: string | null) {
  if (!date) return "Sin fecha";
  return new Date(date).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysRemainingText(dueDate?: string | null) {
  if (!dueDate) return "Sin fecha límite";

  const now = new Date();
  const target = new Date(dueDate);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Vencida";
  if (days === 0) return "Vence hoy";
  if (days === 1) return "1 día restante";
  return `${days} días restantes`;
}

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function KanbanBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBoardData = async () => {
      if (!projectId) {
        setError("No se encontró el identificador del proyecto.");
        setLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [projectData, tasksData] = await Promise.all([
          getProjectById(projectId, token),
          getTasksByProject(projectId, token),
        ]);

        setProject(projectData);
        setTasks(tasksData);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error al cargar el tablero Kanban.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadBoardData();
  }, [projectId, navigate]);

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === "pending").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      review: tasks.filter((task) => task.status === "review").length,
      done: tasks.filter((task) => task.status === "done").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
    };
  }, [tasks]);

  if (loading) {
    return <div className="text-slate-300">Cargando tablero Kanban...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl text-white">Tablero Kanban</h1>
            {project && (
              <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-sm border border-cyan-500/20">
                Proyecto #{project.id}
              </span>
            )}
          </div>

          <p className="text-slate-300 text-lg">
            {project?.name || "Proyecto"}
          </p>

          <p className="text-slate-400 mt-2 max-w-3xl">
            {project?.description || "Organiza y visualiza el avance real de las tareas del proyecto."}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al proyecto
          </button>

          <button
            onClick={() => navigate("/metrics")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            Ver métricas
          </button>

          <button
            onClick={() => navigate(`/task/create/${projectId}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Nueva tarea
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <FolderKanban className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl text-white">Resumen del tablero</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Total</p>
            <p className="text-white text-2xl">{summary.total}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Pendientes</p>
            <p className="text-white text-2xl">{summary.pending}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">En progreso</p>
            <p className="text-white text-2xl">{summary.inProgress}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">En revisión</p>
            <p className="text-white text-2xl">{summary.review}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Finalizadas</p>
            <p className="text-white text-2xl">{summary.done}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Bloqueadas</p>
            <p className="text-white text-2xl">{summary.blocked}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);

          return (
            <div key={column.id} className="flex flex-col">
              <div
                className={`bg-slate-900 border-t-4 ${column.color} border-x border-slate-800 rounded-t-xl p-4`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-white">{column.name}</h2>
                  <span className="text-slate-400 text-sm bg-slate-800 px-2 py-1 rounded">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 bg-slate-900/50 border-x border-b border-slate-800 rounded-b-xl p-4 space-y-3 min-h-[520px]">
                {columnTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="w-full text-left bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all group"
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          priorityColors[task.priority] ?? "bg-slate-700 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {priorityLabels[task.priority] ?? task.priority}
                      </span>

                      {task.priority === "critical" && (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                    </div>

                    <h3 className="text-white mb-2 group-hover:text-cyan-400 transition-colors">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Tipo</span>
                        <span className="text-slate-300 text-right">
                          {taskTypeLabels[task.task_type] ?? task.task_type}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Complejidad</span>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-3 rounded ${
                                i < task.complexity
                                  ? "bg-gradient-to-t from-cyan-500 to-purple-600"
                                  : "bg-slate-700"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Tiempo estimado</span>
                        <span className="text-slate-300">
                          {task.estimated_hours ? `${task.estimated_hours} h` : "No definido"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Fecha límite</span>
                        <span className="text-slate-300 text-right">
                          {getDaysRemainingText(task.due_date)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Habilidades</span>
                        <span className="text-slate-300">
                          {task.required_skills.length}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm">{formatDate(task.due_date)}</span>
                        </div>

                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                              {getInitials(task.assignee.full_name)}
                            </div>
                            <span className="text-slate-300 text-sm truncate">
                              {task.assignee.full_name}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-500">
                            <User className="w-4 h-4" />
                            <span className="text-sm">Sin responsable</span>
                          </div>
                        )}

                        {task.required_skills.length > 0 && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <BrainCircuit className="w-4 h-4" />
                            <span className="text-sm">
                              {task.required_skills[0].skill?.name ?? "Habilidad requerida"}
                              {task.required_skills.length > 1
                                ? ` +${task.required_skills.length - 1}`
                                : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {columnTasks.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-slate-600 text-center">
                    <p className="text-sm">No hay tareas en esta columna</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}