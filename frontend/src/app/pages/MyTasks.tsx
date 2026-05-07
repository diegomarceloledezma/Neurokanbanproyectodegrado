import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlarmClock,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { getMyTasks, type MyTaskItem } from "../services/myTasksService";
import { getAccessToken } from "../services/sessionService";

function humanizeStatus(status?: string) {
  const map: Record<string, string> = {
    pending: "Pendiente",
    in_progress: "En progreso",
    review: "En revisión",
    blocked: "Bloqueada",
    done: "Completada",
  };

  return map[status || ""] ?? status ?? "No definido";
}

function humanizePriority(priority?: string) {
  const map: Record<string, string> = {
    low: "Baja",
    medium: "Media",
    high: "Alta",
    critical: "Crítica",
  };

  return map[priority || ""] ?? priority ?? "No definida";
}

function humanizeTaskType(taskType?: string) {
  const map: Record<string, string> = {
    feature: "Funcionalidad",
    bug: "Error",
    improvement: "Mejora",
    research: "Investigación",
    documentation: "Documentación",
    design: "Diseño",
    marketing: "Marketing",
    operations: "Operaciones",
    other: "Otro",
  };

  return map[taskType || ""] ?? taskType ?? "No definido";
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha límite";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function isOverdue(task: MyTaskItem) {
  if (!task.due_date) return false;
  if (task.status === "done") return false;
  return new Date(task.due_date).getTime() < Date.now();
}

export default function MyTasks() {
  const navigate = useNavigate();
  const token = getAccessToken();

  const [tasks, setTasks] = useState<MyTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!token) {
          throw new Error("No se encontró la sesión del usuario.");
        }

        setLoading(true);
        setError("");

        const data = await getMyTasks(token);
        setTasks(data);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudieron cargar tus tareas.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => task.status === "pending").length;
    const inProgress = tasks.filter((task) => task.status === "in_progress").length;
    const done = tasks.filter((task) => task.status === "done").length;
    const overdue = tasks.filter((task) => isOverdue(task)).length;

    return { pending, inProgress, done, overdue };
  }, [tasks]);

  if (loading) {
    return (
      <div className="text-slate-300 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        Cargando tus tareas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-white font-semibold">Mis tareas</h1>
        <p className="text-slate-400 mt-2">
          Aquí puedes revisar tus tareas asignadas, prioridades y próximas entregas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <ClipboardList className="w-5 h-5 text-cyan-400" />
            <span className="text-slate-300">Total</span>
          </div>
          <p className="text-3xl text-white">{tasks.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <AlarmClock className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-300">Pendientes</span>
          </div>
          <p className="text-3xl text-white">{stats.pending}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <PlayCircle className="w-5 h-5 text-purple-400" />
            <span className="text-slate-300">En progreso</span>
          </div>
          <p className="text-3xl text-white">{stats.inProgress}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-slate-300">Completadas</span>
          </div>
          <p className="text-3xl text-white">{stats.done}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FolderOpen className="w-5 h-5 text-cyan-400" />
          <h2 className="text-2xl text-white font-semibold">Listado de tareas</h2>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 text-slate-400">
            No tienes tareas asignadas por ahora.
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const overdue = isOverdue(task);

              return (
                <div key={task.id} className={`rounded-xl border p-5 ${ overdue ? "border-red-500/30 bg-red-500/5" : "border-slate-800 bg-slate-950/40" }`} >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-white text-lg font-semibold">{task.title}</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {task.description || "Sin descripción registrada."}
                      </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
                        {humanizeStatus(task.status)}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
                        {humanizePriority(task.priority)}
                      </span>
                      {overdue && (
                        <span className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                          Atrasada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 text-sm">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Tipo</p>
                      <p className="text-white">{humanizeTaskType(task.task_type)}</p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Complejidad</p>
                      <p className="text-white">{task.complexity}</p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Horas estimadas</p>
                      <p className="text-white">{task.estimated_hours ?? "No definidas"}</p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Fecha límite</p>
                      <p className="text-white">{formatDate(task.due_date)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-slate-400 text-xs mb-2">Habilidades requeridas</p>
                    <div className="flex flex-wrap gap-2">
                      {task.required_skills && task.required_skills.length > 0 ? (
                        task.required_skills.map((item) => (
                          <span key={item.id} className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs" >
                            {item.skill?.name || "Habilidad"} · Nivel {item.required_level}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-sm">
                          No se registraron habilidades requeridas.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <button onClick={() => navigate(`/task/${task.id}`)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-medium hover:bg-cyan-400 transition-all" >
                      Ver detalle
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}