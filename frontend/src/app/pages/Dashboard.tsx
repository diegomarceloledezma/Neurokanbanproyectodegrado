import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  FolderKanban,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  KanbanSquare,
  Sparkles,
} from "lucide-react";
import {
  getDashboardOverview,
  type DashboardOverviewResponse,
} from "../services/dashboardService";
import { getAccessToken, getCurrentUser } from "../services/sessionService";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  leader: "Líder de equipo",
  member: "Integrante del equipo",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUser = getCurrentUser();

  const roleName = (
    currentUser?.role_name ||
    currentUser?.global_role?.name ||
    ""
  ).toLowerCase();

  const isMember = roleName === "member";

  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [loading, setLoading] = useState(!isMember);
  const [error, setError] = useState("");

  const displayRole =
    roleLabels[roleName] ||
    currentUser?.role_name ||
    currentUser?.global_role?.name ||
    "Usuario";

  useEffect(() => {
    if (isMember) {
      setLoading(false);
      setError("");
      return;
    }

    const loadData = async () => {
      try {
        if (!token) {
          throw new Error("No se encontró token de sesión.");
        }

        setLoading(true);
        setError("");

        const overviewData = await getDashboardOverview(token);
        setOverview(overviewData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, isMember]);

  if (isMember) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Panel principal</h1>
          </div>

          <p className="text-slate-300 text-lg">
            Bienvenido/a,{" "}
            <span className="text-white font-semibold">
              {currentUser?.full_name || currentUser?.username || "Usuario"}
            </span>
          </p>

          <p className="text-slate-400 mt-2">
            Rol actual: <span className="text-slate-200">{displayRole}</span>
          </p>

          <p className="text-slate-400 mt-4 max-w-3xl">
            Desde aquí puedes revisar tus tareas asignadas, consultar proyectos en los que
            participas y hacer seguimiento de tu trabajo sin acceder a módulos
            administrativos o analíticos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate("/my-tasks")}
            className="text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:bg-slate-800/80 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-lg font-semibold">Mis tareas</p>
                <p className="text-slate-400 text-sm mt-1">
                  Revisa tus tareas y actualiza su estado
                </p>
              </div>
              <ClipboardList className="w-5 h-5 text-cyan-400" />
            </div>
          </button>

          <button
            onClick={() => navigate("/projects")}
            className="text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:bg-slate-800/80 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-lg font-semibold">Proyectos</p>
                <p className="text-slate-400 text-sm mt-1">
                  Consulta los proyectos donde participas
                </p>
              </div>
              <FolderKanban className="w-5 h-5 text-purple-400" />
            </div>
          </button>

          <button
            onClick={() => navigate("/kanban-projects")}
            className="text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:bg-slate-800/80 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-lg font-semibold">Tablero Kanban</p>
                <p className="text-slate-400 text-sm mt-1">
                  Visualiza el estado de tus proyectos
                </p>
              </div>
              <KanbanSquare className="w-5 h-5 text-yellow-400" />
            </div>
          </button>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-2">Qué puedes hacer aquí</h2>
          <div className="space-y-2 text-slate-300 text-sm">
            <p>• Revisar tus tareas asignadas</p>
            <p>• Actualizar el estado de tus tareas</p>
            <p>• Registrar horas reales trabajadas</p>
            <p>• Dejar tareas en revisión para validación del líder</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-slate-300">Cargando dashboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
        No se encontró información para mostrar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">
          Resumen general del sistema y estado operativo del equipo
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold text-white mb-2">
          Hola, {currentUser?.full_name || currentUser?.username || "Usuario"}
        </h2>
        <p className="text-slate-400">
          Rol actual: <span className="text-slate-200">{displayRole}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <FolderKanban className="w-5 h-5 text-cyan-400" />
            <span className="text-slate-300">Proyectos</span>
          </div>
          <p className="text-3xl text-white">{overview.total_projects}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <ListChecks className="w-5 h-5 text-purple-400" />
            <span className="text-slate-300">Tareas totales</span>
          </div>
          <p className="text-3xl text-white">{overview.total_tasks}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-slate-300">Completadas</span>
          </div>
          <p className="text-3xl text-white">{overview.completed_tasks}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-300">Vencidas</span>
          </div>
          <p className="text-3xl text-white">{overview.overdue_tasks}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Indicadores operativos
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-slate-400 text-xs mb-1">Pendientes</p>
            <p className="text-white text-2xl">{overview.pending_tasks}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-slate-400 text-xs mb-1">En progreso</p>
            <p className="text-white text-2xl">{overview.in_progress_tasks}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-slate-400 text-xs mb-1">Carga promedio del equipo</p>
            <p className="text-white text-2xl">{overview.team_load_average.toFixed(2)}%</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-slate-400 text-xs mb-1">Finalización promedio</p>
            <p className="text-white text-2xl">
              {overview.average_completion_rate.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Proyectos recientes
        </h2>

        {overview.recent_projects.length === 0 ? (
          <p className="text-slate-400">No hay proyectos recientes para mostrar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {overview.recent_projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <p className="text-white font-medium">{project.name}</p>
                <p className="text-slate-400 text-sm mt-2 line-clamp-3">
                  {project.description || "Sin descripción registrada."}
                </p>
                <p className="text-slate-400 text-sm mt-3">
                  Estado: <span className="text-slate-200">{project.status}</span>
                </p>
                <p className="text-slate-400 text-sm">
                  Miembros: <span className="text-slate-200">{project.members_count}</span>
                </p>

                <button
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-700 transition-all"
                >
                  Ver proyecto
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Recomendaciones recientes
        </h2>

        {overview.recent_recommendations.length === 0 ? (
          <p className="text-slate-400">
            Todavía no hay recomendaciones recientes registradas.
          </p>
        ) : (
          <div className="space-y-3">
            {overview.recent_recommendations.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <p className="text-white font-medium">{item.task_title}</p>
                <p className="text-slate-400 text-sm mt-1">
                  Asignado a:{" "}
                  <span className="text-slate-200">{item.assigned_user_name}</span>
                </p>
                <p className="text-slate-400 text-sm">
                  Fuente: <span className="text-slate-200">{item.source}</span>
                  {item.strategy ? (
                    <>
                      {" "}
                      · Estrategia: <span className="text-slate-200">{item.strategy}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-slate-400 text-sm">
                  Puntaje:{" "}
                  <span className="text-slate-200">
                    {item.recommendation_score?.toFixed(2)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}