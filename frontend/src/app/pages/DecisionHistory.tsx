import { useEffect, useMemo, useState } from "react";
import { Clock, Filter, Sparkles, UserCheck, ShieldAlert, FolderKanban } from "lucide-react";
import { getAssignmentHistory, type AssignmentHistoryResponse } from "../services/taskService";
import { getProjects, type ProjectResponse } from "../services/projectService";
import { getAccessToken } from "../services/sessionService";
import { useNavigate } from "react-router";

const sourceLabels: Record<string, string> = {
  manual: "Manual",
  recommended: "Recomendación aplicada",
  simulated: "Basada en simulación",
  hybrid: "Híbrida",
};

const riskColors: Record<string, string> = {
  low: "text-green-400 bg-green-500/10 border-green-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const priorityLabels: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const roleLabels: Record<string, string> = {
  leader: "Líder de equipo",
  member: "Integrante del equipo",
  admin: "Administrador",
};

const strategyLabels: Record<string, string> = {
  balance: "Balance",
  efficiency: "Eficiencia",
  urgency: "Urgencia",
  learning: "Aprendizaje",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DecisionHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<AssignmentHistoryResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError("");

        const [projectData, historyData] = await Promise.all([
          getProjects(token),
          getAssignmentHistory(token),
        ]);

        setProjects(projectData);
        setHistory(historyData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar el historial de decisiones");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [navigate]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const loadHistory = async () => {
      try {
        setLoading(true);
        setError("");
        const historyData = await getAssignmentHistory(token, selectedProjectId || undefined);
        setHistory(historyData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo actualizar el historial");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [selectedProjectId]);

  const stats = useMemo(() => {
    const total = history.length;
    const usingRecommendation = history.filter((item) => item.recommendation_used).length;
    const recommendedSource = history.filter((item) => item.source === "recommended").length;
    const highRisk = history.filter((item) => item.risk_level === "high").length;

    return {
      total,
      usingRecommendation,
      recommendedSource,
      highRisk,
    };
  }, [history]);

  if (loading && history.length === 0) {
    return <div className="text-slate-300">Cargando historial de decisiones...</div>;
  }

  if (error && history.length === 0) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Historial de decisiones</h1>
        <p className="text-slate-400">
          Revisa las asignaciones registradas por el sistema y la trazabilidad de cada decisión.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
          <div>
            <h2 className="text-xl text-white mb-2">Filtros</h2>
            <p className="text-slate-400 text-sm">
              Puedes revisar todo el historial o filtrarlo por proyecto.
            </p>
          </div>

          <div className="min-w-[280px]">
            <label className="block text-sm text-slate-300 mb-2">
              <span className="inline-flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Proyecto
              </span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            >
              <option value="">Todos los proyectos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-cyan-400" />
            </div>
            <span className="text-3xl text-white">{stats.total}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Decisiones registradas</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-3xl text-white">{stats.usingRecommendation}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Usaron recomendación</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-3xl text-white">{stats.recommendedSource}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Asignadas desde IA</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-red-400" />
            </div>
            <span className="text-3xl text-white">{stats.highRisk}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Decisiones de alto riesgo</h3>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="text-left p-4 text-slate-300 text-sm">Tarea</th>
                <th className="text-left p-4 text-slate-300 text-sm">Asignado a</th>
                <th className="text-left p-4 text-slate-300 text-sm">Fuente</th>
                <th className="text-left p-4 text-slate-300 text-sm">Estrategia</th>
                <th className="text-left p-4 text-slate-300 text-sm">Riesgo</th>
                <th className="text-left p-4 text-slate-300 text-sm">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {history.map((record) => (
                <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div>
                      <button
                        onClick={() => navigate(`/task/${record.task.id}`)}
                        className="text-white hover:text-cyan-400 transition-colors text-left"
                      >
                        {record.task.title}
                      </button>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                          Proyecto #{record.task.project_id}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            record.task.priority === "critical"
                              ? "bg-red-500/10 text-red-400"
                              : record.task.priority === "high"
                              ? "bg-orange-500/10 text-orange-400"
                              : record.task.priority === "medium"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {priorityLabels[record.task.priority] ?? record.task.priority}
                        </span>
                        <span className="text-slate-500 text-xs">
                          Complejidad: {record.task.complexity}/5
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <div>
                      <button
                        onClick={() => navigate(`/member/${record.assigned_user.id}`)}
                        className="text-white hover:text-cyan-400 transition-colors text-left"
                      >
                        {record.assigned_user.full_name}
                      </button>
                      <p className="text-slate-400 text-xs">
                        {roleLabels[record.assigned_user.global_role?.name ?? "member"] ??
                          record.assigned_user.global_role?.name ??
                          "Integrante"}
                      </p>
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-slate-800 text-slate-300 text-sm border border-slate-700">
                        {record.source === "recommended" && <Sparkles className="w-3 h-3 text-cyan-400" />}
                        {sourceLabels[record.source] ?? record.source}
                      </span>
                      {record.recommendation_used && (
                        <p className="text-xs text-cyan-400">Se siguió la sugerencia del sistema</p>
                      )}
                    </div>
                  </td>

                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">
                        {record.strategy ? strategyLabels[record.strategy] ?? record.strategy : "No definida"}
                      </p>
                      {record.recommendation_score !== null &&
                        record.recommendation_score !== undefined && (
                          <p className="text-slate-400 text-xs">
                            Score: {record.recommendation_score}
                          </p>
                        )}
                    </div>
                  </td>

                  <td className="p-4">
                    {record.risk_level ? (
                      <span
                        className={`inline-block text-sm px-2 py-1 rounded border ${
                          riskColors[record.risk_level] ?? "text-slate-300 bg-slate-800 border-slate-700"
                        }`}
                      >
                        {record.risk_level}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-sm">No definido</span>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="text-slate-300 text-sm">{formatDateTime(record.created_at)}</div>
                    {record.assigned_by_user && (
                      <p className="text-slate-500 text-xs mt-1">
                        Por: {record.assigned_by_user.full_name}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-800/30 text-center">
            <FolderKanban className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-slate-400">Todavía no hay decisiones registradas.</p>
            <p className="text-slate-500 text-sm mt-1">
              Asigna una tarea desde la pantalla de recomendación para empezar a construir trazabilidad.
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <p className="text-slate-400 text-sm">
          Esta vista ya muestra trazabilidad real del sistema. En la siguiente fase podremos
          enriquecerla con outcomes, cumplimiento de plazos y comparación entre recomendación,
          decisión final y resultado obtenido.
        </p>
      </div>
    </div>
  );
}