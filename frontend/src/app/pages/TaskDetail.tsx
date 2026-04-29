import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Calendar,
  Clock,
  AlertCircle,
  Sparkles,
  TrendingUp,
  BrainCircuit,
  FolderKanban,
  CheckSquare,
  User,
  Briefcase,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { getTaskById, type TaskResponse } from "../services/taskService";
import { getAccessToken } from "../services/sessionService";

const priorityColors: Record<string, string> = {
  low: "text-slate-300 bg-slate-500/10 border-slate-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
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

const levelLabels: Record<number, string> = {
  1: "Básico",
  2: "Inicial",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

function formatDate(date?: string | null) {
  if (!date) return "No definida";

  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDaysRemainingText(dueDate?: string | null) {
  if (!dueDate) return "Sin fecha límite";

  const now = new Date();
  const target = new Date(dueDate);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Fecha vencida";
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

export default function TaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTask = async () => {
      if (!taskId) {
        setError("No se encontró el identificador de la tarea.");
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
          setError("Ocurrió un error al cargar la tarea.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [taskId, navigate]);

  const assigneeRole = useMemo(() => {
    if (!task?.assignee?.global_role?.name) return "Sin rol";
    return roleLabels[task.assignee.global_role.name] ?? task.assignee.global_role.name;
  }, [task]);

  const creatorRole = useMemo(() => {
    if (!task?.creator?.global_role?.name) return "Sin rol";
    return roleLabels[task.creator.global_role.name] ?? task.creator.global_role.name;
  }, [task]);

  const timeDifference = useMemo(() => {
    if (
      task?.actual_hours === null ||
      task?.actual_hours === undefined ||
      task?.estimated_hours === null ||
      task?.estimated_hours === undefined
    ) {
      return null;
    }

    const diff = Number(task.actual_hours) - Number(task.estimated_hours);
    return diff;
  }, [task]);

  if (loading) {
    return <div className="text-slate-300">Cargando tarea...</div>;
  }

  if (error || !task) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error || "Tarea no encontrada."}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl text-white">{task.title}</h1>
            <span
              className={`text-sm px-3 py-1 rounded border ${
                priorityColors[task.priority] ?? "text-slate-300 bg-slate-500/10 border-slate-500/20"
              }`}
            >
              {priorityLabels[task.priority] ?? task.priority}
            </span>
          </div>
          <p className="text-slate-400 max-w-3xl">
            Consulta el detalle operativo, el responsable actual, las habilidades requeridas y el acceso a la recomendación inteligente.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/projects/${task.project_id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <FolderKanban className="w-4 h-4" />
            Ver proyecto
          </button>

          <button
            onClick={() => navigate(`/kanban/${task.project_id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <CheckSquare className="w-4 h-4" />
            Ver Kanban
          </button>

          <button
            onClick={() => navigate(`/recommendation/${task.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Sparkles className="w-4 h-4" />
            Recomendación inteligente
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <ArrowLeft className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl text-white">Resumen general de la tarea</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Estado</p>
            <p className="text-white">{statusLabels[task.status] ?? task.status}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Tipo de tarea</p>
            <p className="text-white">{task.task_type}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Tiempo estimado</p>
            <p className="text-white">
              {task.estimated_hours !== null && task.estimated_hours !== undefined
                ? `${task.estimated_hours} h`
                : "No definido"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">Fecha límite</p>
            <p className="text-white">{getDaysRemainingText(task.due_date)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Descripción de la tarea</h2>

            <div className="rounded-xl bg-slate-800/40 border border-slate-700 p-4">
              <p className="text-slate-300 leading-relaxed">
                {task.description || "Esta tarea no tiene una descripción registrada."}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Información de la tarea</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-slate-400 text-sm mb-1">Prioridad</p>
                <span
                  className={`inline-block text-sm px-3 py-1 rounded border ${
                    priorityColors[task.priority] ?? "text-slate-300 bg-slate-500/10 border-slate-500/20"
                  }`}
                >
                  {priorityLabels[task.priority] ?? task.priority}
                </span>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Estado actual</p>
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
                    />
                  ))}
                  <span className="text-white ml-2">{task.complexity}/5</span>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Tiempo estimado</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <p className="text-white">
                    {task.estimated_hours !== null && task.estimated_hours !== undefined
                      ? `${task.estimated_hours} h`
                      : "No definido"}
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
                    <p className="text-white">{task.actual_hours} h</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-slate-400 text-sm mb-1">Fecha de registro</p>
                <p className="text-white">{formatDate(task.created_at)}</p>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Última actualización</p>
                <p className="text-white">{formatDate(task.updated_at)}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Habilidades requeridas</h2>
            </div>

            {task.required_skills.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {task.required_skills.map((requiredSkill) => (
                  <div
                    key={requiredSkill.id}
                    className="px-4 py-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5"
                  >
                    <p className="text-white font-medium">
                      {requiredSkill.skill?.name ?? `Habilidad ${requiredSkill.skill_id}`}
                    </p>
                    <p className="text-sm text-slate-400">
                      Nivel requerido: {requiredSkill.required_level} ·{" "}
                      {levelLabels[requiredSkill.required_level] ?? "No definido"}
                    </p>
                    {requiredSkill.skill?.category && (
                      <p className="text-xs text-slate-500 mt-1">
                        Categoría: {requiredSkill.skill.category}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-slate-400 text-sm">
                Esta tarea todavía no tiene habilidades requeridas registradas. La recomendación
                puede funcionar, pero será menos precisa.
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-cyan-400 mt-1" />
              <div>
                <h3 className="text-white mb-2">Preparación para recomendación</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Esta vista muestra los principales insumos que utiliza el módulo inteligente
                  para sugerir una asignación: prioridad, complejidad, tiempo estimado, fecha
                  límite, responsable actual y habilidades requeridas.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Responsable actual</h3>

            {task.assignee ? (
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-all text-left"
                onClick={() => navigate(`/member/${task.assignee.id}`)}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white">
                  {getInitials(task.assignee.full_name)}
                </div>
                <div>
                  <p className="text-white">{task.assignee.full_name}</p>
                  <p className="text-slate-400 text-sm">{assigneeRole}</p>
                </div>
              </button>
            ) : (
              <div className="flex items-center justify-center p-4 bg-slate-800/50 rounded-lg">
                <p className="text-slate-500 text-sm">La tarea todavía no tiene responsable asignado.</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Registrada por</h3>

            {task.creator ? (
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white">
                  {getInitials(task.creator.full_name)}
                </div>
                <div>
                  <p className="text-white">{task.creator.full_name}</p>
                  <p className="text-slate-400 text-sm">{creatorRole}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-4 bg-slate-800/50 rounded-lg">
                <p className="text-slate-500 text-sm">No disponible.</p>
              </div>
            )}
          </div>

          {timeDifference !== null && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-white mb-4">Comparación de tiempo</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Tiempo estimado</span>
                  <span className="text-white">{task.estimated_hours} h</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Tiempo real</span>
                  <span className="text-white">{task.actual_hours} h</span>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Diferencia</span>
                    <span className={timeDifference <= 0 ? "text-green-400" : "text-red-400"}>
                      {timeDifference <= 0 ? "-" : "+"}
                      {Math.abs(timeDifference)} h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Accesos rápidos</h3>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate(`/recommendation/${task.id}`)}
                className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Abrir recomendación inteligente
              </button>

              <button
                type="button"
                onClick={() => navigate(`/projects/${task.project_id}`)}
                className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left inline-flex items-center gap-2"
              >
                <FolderKanban className="w-4 h-4" />
                Ir al proyecto
              </button>

              <button
                type="button"
                onClick={() => navigate(`/kanban/${task.project_id}`)}
                className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left inline-flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                Ir al tablero Kanban
              </button>

              {task.assignee && (
                <button
                  type="button"
                  onClick={() => navigate(`/member/${task.assignee.id}`)}
                  className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left inline-flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Ver perfil del responsable
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-cyan-400 mt-1" />
              <div>
                <h3 className="text-white mb-2">Lectura operativa</h3>
                <p className="text-slate-400 text-sm">
                  Esta pantalla concentra la información clave de la tarea para su seguimiento
                  y para la toma de decisiones antes de una reasignación o recomendación.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-purple-400 mt-1" />
              <div>
                <h3 className="text-white mb-2">Estado de asignación</h3>
                <p className="text-slate-400 text-sm">
                  {task.assignee
                    ? "La tarea ya cuenta con un responsable asignado, pero puede compararse nuevamente mediante la recomendación inteligente."
                    : "La tarea todavía no tiene responsable asignado, por lo que puede analizarse directamente desde la recomendación inteligente."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}