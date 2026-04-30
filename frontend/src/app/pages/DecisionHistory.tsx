import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  History,
  Filter,
  FolderKanban,
  User,
  Sparkles,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";
import { getAccessToken } from "../services/sessionService";
import { getProjects, type ProjectResponse } from "../services/projectService";
import {
  getDecisionHistory,
  type DecisionHistoryItem,
} from "../services/decisionHistoryService";

const sourceLabels: Record<string, string> = {
  manual: "Manual",
  recommended: "Recomendado",
  hybrid: "Híbrido",
};

const strategyLabels: Record<string, string> = {
  balance: "Balance",
  efficiency: "Eficiencia",
  urgency: "Urgencia",
  learning: "Aprendizaje",
};

const roleLabels: Record<string, string> = {
  leader: "Líder de equipo",
  member: "Integrante del equipo",
  admin: "Administrador",
};

const riskColors: Record<string, string> = {
  low: "text-green-400 bg-green-500/10 border-green-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const riskLabels: Record<string, string> = {
  low: "Riesgo bajo",
  medium: "Riesgo medio",
  high: "Riesgo alto",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DecisionHistory() {
  const navigate = useNavigate();
  const token = getAccessToken();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [items, setItems] = useState<DecisionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("");

  useEffect(() => {
    const loadProjects = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const data = await getProjects(token);
        setProjects(data);
      } catch (err) {
        console.error(err);
      }
    };

    loadProjects();
  }, [token, navigate]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await getDecisionHistory(token, {
          project_id: selectedProjectId ? Number(selectedProjectId) : undefined,
          source: selectedSource || undefined,
          strategy: selectedStrategy || undefined,
          limit: 100,
        });

        setItems(response.items);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar el historial de decisiones.");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [token, navigate, selectedProjectId, selectedSource, selectedStrategy]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      manual: items.filter((item) => item.source === "manual").length,
      recommended: items.filter((item) => item.source === "recommended").length,
      hybrid: items.filter((item) => item.source === "hybrid").length,
    };
  }, [items]);

  if (loading) {
    return <div className="text-slate-300">Cargando historial de decisiones...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <History className="w-6 h-6 text-cyan-400" />
          <h1 className="text-3xl text-white">Historial de decisiones</h1>
        </div>
        <p className="text-slate-400">
          Revisa las asignaciones registradas, su origen, estrategia y contexto de decisión.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl text-white">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-2">Proyecto</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Todos los proyectos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Origen</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Todos</option>
              <option value="manual">Manual</option>
              <option value="recommended">Recomendado</option>
              <option value="hybrid">Híbrido</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Estrategia</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Todas</option>
              <option value="balance">Balance</option>
              <option value="efficiency">Eficiencia</option>
              <option value="urgency">Urgencia</option>
              <option value="learning">Aprendizaje</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-slate-400 text-xs mb-1">Total</p>
          <p className="text-white text-2xl">{summary.total}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-slate-400 text-xs mb-1">Manuales</p>
          <p className="text-white text-2xl">{summary.manual}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-slate-400 text-xs mb-1">Recomendadas</p>
          <p className="text-white text-2xl">{summary.recommended}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-slate-400 text-xs mb-1">Híbridas</p>
          <p className="text-white text-2xl">{summary.hybrid}</p>
        </div>
      </div>

      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <button
                    onClick={() => navigate(`/task/${item.task_id}`)}
                    className="text-left text-white text-lg hover:text-cyan-400 transition-colors"
                  >
                    {item.task_title}
                  </button>
                  <p className="text-slate-500 text-sm mt-1">
                    Registrado el {formatDateTime(item.created_at)}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg text-sm bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                    {sourceLabels[item.source] ?? item.source}
                  </span>

                  <span className="px-3 py-1 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-300">
                    {item.strategy ? strategyLabels[item.strategy] ?? item.strategy : "Sin estrategia"}
                  </span>

                  {item.risk_level && (
                    <span
                      className={`px-3 py-1 rounded-lg text-sm border ${
                        riskColors[item.risk_level] ?? "text-slate-300 bg-slate-800 border-slate-700"
                      }`}
                    >
                      {riskLabels[item.risk_level] ?? item.risk_level}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    <p className="text-slate-400 text-xs">Integrante asignado</p>
                  </div>
                  <button
                    onClick={() => navigate(`/member/${item.assigned_user_id}`)}
                    className="text-white hover:text-cyan-400 transition-colors"
                  >
                    {item.assigned_user_name}
                  </button>
                  <p className="text-slate-500 text-xs mt-1">
                    {roleLabels[item.assigned_user_role] ?? item.assigned_user_role}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <p className="text-slate-400 text-xs">Puntaje</p>
                  </div>
                  <p className="text-white text-xl">{item.recommendation_score.toFixed(2)}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderKanban className="w-4 h-4 text-cyan-400" />
                    <p className="text-slate-400 text-xs">Proyecto</p>
                  </div>
                  <button
                    onClick={() => navigate(`/projects/${item.project_id}`)}
                    className="text-white hover:text-cyan-400 transition-colors"
                  >
                    Ver proyecto #{item.project_id}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <p className="text-slate-400 text-xs">Uso de recomendación</p>
                  </div>
                  <p className="text-white">
                    {item.recommendation_used === true
                      ? "Sí"
                      : item.recommendation_used === false
                      ? "No"
                      : "No definido"}
                  </p>
                </div>
              </div>

              {item.reason && (
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <p className="text-slate-400 text-xs">Motivo registrado</p>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{item.reason}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            No hay decisiones registradas con los filtros actuales.
          </div>
        )}
      </div>
    </div>
  );
}