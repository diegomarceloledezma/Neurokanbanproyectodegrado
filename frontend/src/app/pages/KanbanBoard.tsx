import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Plus, AlertCircle } from "lucide-react";
import { getTasksByProject, type TaskResponse } from "../services/taskService";
import { getAccessToken } from "../services/sessionService";

const columns = [
  { id: "pending", name: "Pendientes", color: "border-slate-600" },
  { id: "in_progress", name: "En progreso", color: "border-cyan-500" },
  { id: "review", name: "En revisión", color: "border-purple-500" },
  { id: "done", name: "Finalizadas", color: "border-green-500" },
];

const priorityColors: Record<string, string> = {
  low: "bg-slate-600/20 text-slate-300",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  critical: "bg-red-500/20 text-red-400",
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

export default function KanbanBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTasks = async () => {
      if (!projectId) {
        setError("No se encontró el identificador del proyecto");
        setLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const data = await getTasksByProject(projectId, token);
        setTasks(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error al cargar las tareas");
        }
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [projectId, navigate]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl text-white mb-2">Tablero Kanban</h1>
          <p className="text-slate-400">Organiza y visualiza el avance de las tareas del proyecto</p>
        </div>

        <button
          onClick={() => navigate(`/task/create/${projectId}`)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          Nueva tarea
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);

          return (
            <div key={column.id} className="flex flex-col">
              <div className={`bg-slate-900 border-t-4 ${column.color} border-x border-slate-800 rounded-t-xl p-4`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-white">{column.name}</h2>
                  <span className="text-slate-400 text-sm bg-slate-800 px-2 py-1 rounded">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 bg-slate-900/50 border-x border-b border-slate-800 rounded-b-xl p-4 space-y-3 min-h-[500px]">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all cursor-pointer group"
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          priorityColors[task.priority] ?? "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {priorityLabels[task.priority] ?? task.priority}
                      </span>

                      {task.priority === "critical" && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
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
                      <div className="flex items-center justify-between">
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
                            ></div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Tiempo estimado</span>
                        <span className="text-slate-300">
                          {task.estimated_hours ? `${task.estimated_hours} h` : "No definido"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Tipo</span>
                        <span className="text-slate-300 text-right">
                          {taskTypeLabels[task.task_type] ?? task.task_type}
                        </span>
                      </div>

                      {task.assignee && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                            {task.assignee.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="text-slate-300 text-sm">{task.assignee.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-slate-600">
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