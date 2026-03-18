import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Calendar, Clock, AlertCircle, MessageSquare, Sparkles, TrendingUp } from "lucide-react";
import { getTaskById, type TaskResponse } from "../services/taskService";
import { getAccessToken } from "../services/sessionService";

const priorityColors: Record<string, string> = {
  low: "text-slate-400 bg-slate-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  high: "text-orange-400 bg-orange-500/10",
  critical: "text-red-400 bg-red-500/10",
};

const priorityLabels: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  review: "En revisión",
  done: "Finalizada",
  blocked: "Bloqueada",
};

const roleLabels: Record<string, string> = {
  leader: "Líder de equipo",
  member: "Integrante del equipo",
  admin: "Administrador",
};

const formatDate = (date?: string | null) => {
  if (!date) return "No definida";

  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function TaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const loadTask = async () => {
      if (!taskId) {
        setError("No se encontró el identificador de la tarea");
        setLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const data = await getTaskById(taskId, token);
        setTask(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error al cargar la tarea");
        }
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [taskId, navigate]);

  if (loading) {
    return <div className="text-slate-300">Cargando tarea...</div>;
  }

  if (error || !task) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error || "Tarea no encontrada"}
      </div>
    );
  }

  const assigneeRole = task.assignee?.global_role?.name
    ? roleLabels[task.assignee.global_role.name] ?? task.assignee.global_role.name
    : "Sin rol";

  const creatorRole = task.creator?.global_role?.name
    ? roleLabels[task.creator.global_role.name] ?? task.creator.global_role.name
    : "Sin rol";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl text-white">{task.title}</h1>
            <span className={`text-sm px-3 py-1 rounded ${priorityColors[task.priority] ?? "text-slate-300 bg-slate-500/10"}`}>
              {priorityLabels[task.priority] ?? task.priority}
            </span>
          </div>
          <p className="text-slate-400">
            {task.description || "Esta tarea no tiene una descripción registrada."}
          </p>
        </div>

        <button
          onClick={() => navigate(`/recommendation/${taskId}`)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Sparkles className="w-4 h-4" />
          Nueva recomendación
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Información de la tarea</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-slate-400 text-sm mb-1">Prioridad</p>
                <span className={`inline-block text-sm px-3 py-1 rounded ${priorityColors[task.priority] ?? "text-slate-300 bg-slate-500/10"}`}>
                  {priorityLabels[task.priority] ?? task.priority}
                </span>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Estado</p>
                <p className="text-white">{statusLabels[task.status] ?? task.status}</p>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Complejidad</p>
                <div className="flex gap-1 items-center">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-4 rounded ${
                        i < task.complexity
                          ? "bg-gradient-to-t from-cyan-500 to-purple-600"
                          : "bg-slate-700"
                      }`}
                    ></div>
                  ))}
                  <span className="text-white ml-2">{task.complexity}/5</span>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Tiempo estimado</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <p className="text-white">
                    {task.estimated_hours ? `${task.estimated_hours}h` : "No definido"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Fecha límite</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <p className="text-white">{formatDate(task.due_date)}</p>
                </div>
              </div>

              {task.actual_hours !== null && task.actual_hours !== undefined && (
                <div>
                  <p className="text-slate-400 text-sm mb-1">Tiempo real</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <p className="text-white">{task.actual_hours}h</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-slate-400 text-sm mb-1">Tipo de tarea</p>
                <p className="text-white">{task.task_type}</p>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Registro</p>
                <p className="text-white">{formatDate(task.created_at)}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Comentarios</h2>

            <p className="text-slate-500 text-sm mb-4">
              El módulo de comentarios aún no está conectado al backend.
            </p>

            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="Escribe un comentario..."
              />
              <button
                type="button"
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Responsable</h3>

            {task.assignee ? (
              <div
                className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-all"
                onClick={() => navigate(`/member/${task.assignee?.id}`)}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white">
                  {task.assignee.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <p className="text-white">{task.assignee.full_name}</p>
                  <p className="text-slate-400 text-sm">{assigneeRole}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-4 bg-slate-800/50 rounded-lg">
                <p className="text-slate-500 text-sm">No asignado</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Creado por</h3>

            {task.creator ? (
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white">
                  {task.creator.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <p className="text-white">{task.creator.full_name}</p>
                  <p className="text-slate-400 text-sm">{creatorRole}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-4 bg-slate-800/50 rounded-lg">
                <p className="text-slate-500 text-sm">No disponible</p>
              </div>
            )}
          </div>

          {task.actual_hours !== null &&
            task.actual_hours !== undefined &&
            task.estimated_hours !== null &&
            task.estimated_hours !== undefined && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-white mb-4">Rendimiento</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Tiempo estimado</span>
                    <span className="text-white">{task.estimated_hours}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Tiempo real</span>
                    <span className="text-white">{task.actual_hours}h</span>
                  </div>
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Diferencia</span>
                      <span className={task.actual_hours <= task.estimated_hours ? "text-green-400" : "text-red-400"}>
                        {task.actual_hours <= task.estimated_hours ? "-" : "+"}
                        {Math.abs(Number(task.actual_hours) - Number(task.estimated_hours))}h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Acciones rápidas</h3>
            <div className="space-y-2">
              <button className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left">
                Cambiar estado
              </button>
              <button className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left">
                Editar tarea
              </button>
              <button className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left">
                Duplicar tarea
              </button>
              <button className="w-full py-2 px-4 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-sm text-left">
                Eliminar tarea
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}