import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  FolderKanban,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  BrainCircuit,
  Sparkles,
  BarChart3,
} from "lucide-react";
import {
  getDashboardOverview,
  type DashboardOverviewResponse,
} from "../services/dashboardService";
import {
  getMlBaselineStatus,
  type BaselineStatusResponse,
} from "../services/mlBaselineService";
import { getAccessToken, getCurrentUser } from "../services/sessionService";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  leader: "Líder de equipo",
  member: "Integrante del equipo",
};

function formatMetricPercent(value?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function humanizeVariant(variant?: string) {
  if (!variant) return "No definida";

  const map: Record<string, string> = {
    raw_history: "Histórico crudo",
    cleaned_history: "Histórico depurado",
    compact_cleaned_history: "Compacto depurado",
    raw_database: "Base histórica directa",
    raw_rows: "Filas crudas",
  };

  return map[variant] ?? variant;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUser = getCurrentUser();

  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [modelStatus, setModelStatus] = useState<BaselineStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const displayRole = currentUser?.role_name
    ? roleLabels[currentUser.role_name] ?? currentUser.role_name
    : currentUser?.global_role?.name
    ? roleLabels[currentUser.global_role.name] ?? currentUser.global_role.name
    : "Sin rol";

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!token) {
          throw new Error("No se encontró token de sesión.");
        }

        setLoading(true);
        setError("");

        const [overviewData, modelData] = await Promise.all([
          getDashboardOverview(token),
          getMlBaselineStatus(token),
        ]);

        setOverview(overviewData);
        setModelStatus(modelData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

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

  const metadata = modelStatus?.metadata ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">
          Resumen general del equipo, tareas y recomendaciones recientes
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold text-white mb-2">
          Hola, {currentUser?.full_name || currentUser?.username || "Usuario"}
        </h2>
        <p className="text-slate-400">
          Usuario:{" "}
          <span className="text-slate-200">
            {currentUser?.username || currentUser?.full_name || "Usuario"}
          </span>{" "}
          · Rol: <span className="text-slate-200">{displayRole}</span>
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

      <div className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <BrainCircuit className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-semibold text-white">
                Estado actual del modelo de IA
              </h2>
            </div>

            {metadata ? (
              <>
                <p className="text-slate-300">
                  Variante activa:{" "}
                  <span className="text-white font-medium">
                    {humanizeVariant(metadata.training_variant)}
                  </span>
                </p>
                <p className="text-slate-400 mt-2 max-w-3xl">
                  El sistema ya cuenta con un baseline entrenado y visible dentro
                  de la plataforma, con métricas, dataset y variables activas.
                </p>
              </>
            ) : (
              <p className="text-slate-400">
                Todavía no se encontró metadata del modelo de IA.
              </p>
            )}
          </div>

          <button
            onClick={() => navigate("/modelo-ia")}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Ver detalle del modelo
          </button>
        </div>

        {metadata && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Accuracy</p>
              <p className="text-white text-2xl">
                {formatMetricPercent(metadata.metrics.accuracy)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">F1 Score</p>
              <p className="text-white text-2xl">
                {formatMetricPercent(metadata.metrics.f1)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">ROC AUC</p>
              <p className="text-white text-2xl">
                {formatMetricPercent(metadata.metrics.roc_auc)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Filas del dataset</p>
              <p className="text-white text-2xl">{metadata.dataset_rows}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-2xl font-semibold text-white">
              Indicadores operativos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p className="text-white text-2xl">
                {overview.team_load_average.toFixed(2)}%
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">
                Tasa promedio de finalización
              </p>
              <p className="text-white text-2xl">
                {overview.average_completion_rate.toFixed(2)}%
              </p>
            </div>
          </div>
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
                    Fuente: <span className="text-slate-200">{item.source}</span> ·
                    Estrategia:{" "}
                    <span className="text-slate-200">
                      {item.strategy || "No definida"}
                    </span>
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
                  Miembros:{" "}
                  <span className="text-slate-200">{project.members_count}</span>
                </p>
                <button
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-700 transition-all"
                >
                  Ver proyecto
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}