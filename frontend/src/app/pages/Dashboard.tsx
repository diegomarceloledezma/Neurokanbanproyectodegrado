import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FolderKanban,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";
import { fetchCurrentUser } from "../services/authService";
import { clearSession, getAccessToken, type StoredUser } from "../services/sessionService";
import {
  getDashboardOverview,
  type DashboardOverviewResponse,
} from "../services/dashboardService";

export default function Dashboard() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const loadSession = async () => {
      const token = getAccessToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const [user, overviewData] = await Promise.all([
          fetchCurrentUser(token),
          getDashboardOverview(token),
        ]);

        setCurrentUser(user);
        setOverview(overviewData);
      } catch (error) {
        clearSession();
        setSessionError("Tu sesión expiró o no es válida. Inicia sesión nuevamente.");
        navigate("/login");
      } finally {
        setSessionLoading(false);
      }
    };

    loadSession();
  }, [navigate]);

  const roleLabels: Record<string, string> = {
    leader: "Líder de equipo",
    member: "Integrante del equipo",
    admin: "Administrador",
  };

  const rawRole =
    currentUser?.global_role?.name ??
    currentUser?.role_name ??
    null;

  const displayRole = rawRole
    ? roleLabels[rawRole] ?? rawRole
    : "Sin rol";

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="nk-dashboard-page space-y-6">
      <div className="nk-page-header">
        <h1 className="nk-page-title text-3xl text-white mb-2">Dashboard</h1>
        <p className="nk-page-subtitle text-slate-400">
          Resumen general del equipo, tareas y recomendaciones recientes
        </p>
      </div>

      {currentUser && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white text-lg mb-1">Hola, {currentUser.full_name}</h2>
          <p className="text-slate-400 text-sm">
            Usuario: {currentUser.username} · Rol: {displayRole}
          </p>
        </div>
      )}

      {sessionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {sessionError}
        </div>
      )}

      {overview && (
        <>
          <div className="nk-stats-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <span className="text-2xl text-white">{overview.pending_tasks}</span>
              </div>
              <h3 className="text-slate-300 mb-1">Tareas pendientes</h3>
              <p className="text-slate-500 text-sm">Actividades aún no iniciadas</p>
            </div>

            <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-cyan-500" />
                </div>
                <span className="text-2xl text-white">{overview.in_progress_tasks}</span>
              </div>
              <h3 className="text-slate-300 mb-1">En progreso</h3>
              <p className="text-slate-500 text-sm">Tareas actualmente en ejecución</p>
            </div>

            <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-2xl text-white">{overview.overdue_tasks}</span>
              </div>
              <h3 className="text-slate-300 mb-1">Vencidas</h3>
              <p className="text-slate-500 text-sm">Tareas fuera de plazo</p>
            </div>

            <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <span className="text-2xl text-white">{overview.team_load_average}%</span>
              </div>
              <h3 className="text-slate-300 mb-1">Carga promedio</h3>
              <p className="text-slate-500 text-sm">Promedio real del equipo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <FolderKanban className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl text-white">Proyectos recientes</h2>
              </div>

              {overview.recent_projects.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-slate-400">
                  No hay proyectos registrados todavía.
                </div>
              ) : (
                <div className="space-y-4">
                  {overview.recent_projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="w-full text-left p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-white">{project.name}</h3>
                          <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                            {project.description || "Sin descripción registrada"}
                          </p>
                          <p className="text-slate-500 text-xs mt-2">
                            {project.members_count} integrante{project.members_count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-xs border border-cyan-500/20">
                          {project.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl text-white">Asignaciones recomendadas</h2>
              </div>

              <div className="space-y-4">
                {overview.recent_recommendations.length > 0 ? (
                  overview.recent_recommendations.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(`/task/${item.task_id}`)}
                      className="w-full text-left p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/50 transition-all"
                    >
                      <p className="text-white text-sm mb-1">{item.task_title}</p>
                      <p className="text-slate-400 text-sm mb-2">
                        Asignado a {item.assigned_user_name}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Score: {item.recommendation_score ? item.recommendation_score.toFixed(2) : "0.00"}
                        </span>
                        <span>{item.strategy || "Sin estrategia"}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-slate-400 text-sm">
                    Todavía no hay asignaciones recomendadas registradas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}