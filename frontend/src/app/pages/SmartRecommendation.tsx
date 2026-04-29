import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  BrainCircuit,
  Sparkles,
  User,
  FolderKanban,
  CheckSquare,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { getTaskById, assignTask, type TaskResponse } from "../services/taskService";
import {
  getTaskInsights,
  getTaskRecommendations,
  getTaskSimulation,
  type RecommendationMode,
  type TaskInsightResponse,
  type TaskRecommendationItem,
  type TaskRecommendationResponse,
  type TaskSimulationItem,
  type TaskSimulationResponse,
} from "../services/recommendationService";
import { getAccessToken, getStoredUser } from "../services/sessionService";
import TaskInsightsPanel from "../components/recommendation/TaskInsightsPanel";
import AnalysisSummary from "../components/recommendation/AnalysisSummary";
import RecommendationCard from "../components/recommendation/RecommendationCard";
import SimulationCard from "../components/recommendation/SimulationCard";

const strategyOptions = [
  { value: "balance", label: "Balance" },
  { value: "efficiency", label: "Eficiencia" },
  { value: "urgency", label: "Urgencia" },
  { value: "learning", label: "Aprendizaje" },
];

const modeOptions: Array<{ value: RecommendationMode; label: string; description: string }> = [
  {
    value: "heuristic",
    label: "Heurístico",
    description: "Usa reglas explicables basadas en carga, disponibilidad, habilidades y desempeño.",
  },
  {
    value: "hybrid",
    label: "Híbrido",
    description: "Combina score heurístico con probabilidad de éxito estimada por el baseline.",
  },
];

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

const strategyDescriptions: Record<string, string> = {
  balance: "Busca equilibrio entre carga, disponibilidad, habilidades y desempeño.",
  efficiency: "Prioriza el mejor rendimiento disponible para ejecutar la tarea.",
  urgency: "Favorece rapidez de respuesta y menor saturación para tareas urgentes.",
  learning: "Promueve desarrollo del equipo con riesgo controlado.",
};

function daysRemaining(dueDate?: string | null) {
  if (!dueDate) return "Sin fecha límite";
  const diff = new Date(dueDate).getTime() - new Date().getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "Fecha vencida";
  return `${days} días restantes`;
}

function formatPercent(value: number) {
  return `${value}%`;
}

function getLoadChangeLabel(simulation: TaskSimulationItem) {
  const change = simulation.projected_load - simulation.current_load;
  if (change > 0) return `+${change}%`;
  if (change < 0) return `${change}%`;
  return "Sin cambio";
}

function getActiveTasksChangeLabel(simulation: TaskSimulationItem) {
  const change = simulation.projected_active_tasks - simulation.current_active_tasks;
  if (change > 0) return `+${change} tarea${change > 1 ? "s" : ""}`;
  if (change < 0) return `${change} tarea${Math.abs(change) > 1 ? "s" : ""}`;
  return "Sin cambio";
}

function getTopRecommendation(recommendationData: TaskRecommendationResponse | null) {
  return recommendationData?.recommendations?.[0] ?? null;
}

export default function SmartRecommendation() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [recommendationData, setRecommendationData] =
    useState<TaskRecommendationResponse | null>(null);
  const [simulationData, setSimulationData] = useState<TaskSimulationResponse | null>(null);
  const [insightData, setInsightData] = useState<TaskInsightResponse | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState("balance");
  const [selectedMode, setSelectedMode] = useState<RecommendationMode>("heuristic");
  const [loading, setLoading] = useState(true);
  const [reloadingAnalysis, setReloadingAnalysis] = useState(false);
  const [assigningMemberId, setAssigningMemberId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
        const taskData = await getTaskById(taskId, token);
        setTask(taskData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("Ocurrió un error al cargar la tarea");
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [taskId, navigate]);

  useEffect(() => {
    const loadAnalysis = async () => {
      if (!taskId) return;

      const token = getAccessToken();
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setReloadingAnalysis(true);
        setError("");
        setSuccessMessage("");

        const [recommendations, simulation, insights] = await Promise.all([
          getTaskRecommendations(taskId, token, selectedStrategy, selectedMode),
          getTaskSimulation(taskId, token, selectedStrategy, selectedMode),
          getTaskInsights(taskId, token),
        ]);

        setRecommendationData(recommendations);
        setSimulationData(simulation);
        setInsightData(insights);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("Ocurrió un error al cargar el análisis inteligente");
      } finally {
        setReloadingAnalysis(false);
      }
    };

    loadAnalysis();
  }, [taskId, selectedStrategy, selectedMode, navigate]);

  const handleAssign = async (rec: TaskRecommendationItem) => {
    if (!taskId || !recommendationData) return;

    const token = getAccessToken();
    const currentUser = getStoredUser();

    if (!token || !currentUser) {
      navigate("/login");
      return;
    }

    setError("");
    setSuccessMessage("");
    setAssigningMemberId(rec.member.id);

    try {
      await assignTask(
        taskId,
        {
          assigned_to: rec.member.id,
          assigned_by: currentUser.id,
          source: selectedMode === "hybrid" ? "hybrid" : "recommended",
          strategy: recommendationData.strategy,
          recommendation_score: rec.score,
          risk_level: rec.risk_level,
          reason: rec.reason,
          recommendation_used: true,
        },
        token
      );

      setSuccessMessage(
        `La tarea fue asignada a ${rec.member.full_name} y la decisión quedó registrada correctamente.`
      );

      setTimeout(() => {
        navigate(`/task/${taskId}`);
      }, 1000);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo asignar la tarea");
    } finally {
      setAssigningMemberId(null);
    }
  };

  const handleApplySuggestedStrategy = () => {
    if (!insightData) return;
    setSelectedStrategy(insightData.suggested_strategy);
  };

  const topRecommendation = useMemo(
    () => getTopRecommendation(recommendationData),
    [recommendationData]
  );

  if (loading) {
    return <div className="text-slate-300">Cargando recomendación...</div>;
  }

  if (error && (!task || !recommendationData)) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        No se encontró la tarea.
      </div>
    );
  }

  const activeMode = modeOptions.find((option) => option.value === selectedMode);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl text-white">Recomendación inteligente</h1>
            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm border border-cyan-500/20">
              NeuroKanban IA
            </span>
          </div>
          <p className="text-slate-400">
            Evalúa a quién asignar la tarea con base en habilidades, carga, disponibilidad y estrategia.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/task/${taskId}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al detalle
          </button>

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
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-4 text-green-300">
          {successMessage}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl text-white">{task.title}</h2>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              {task.description || "Esta tarea no tiene descripción registrada."}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-1">Prioridad</p>
                <p className="text-white text-sm">
                  {priorityLabels[task.priority] ?? task.priority}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Complejidad</p>
                <p className="text-white text-sm">{task.complexity}/5</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Tiempo estimado</p>
                <p className="text-white text-sm">
                  {task.estimated_hours ? `${task.estimated_hours} h` : "No definido"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Fecha límite</p>
                <p className="text-white text-sm">{daysRemaining(task.due_date)}</p>
              </div>
            </div>

            {task.required_skills.length > 0 && (
              <div className="mt-5">
                <p className="text-slate-500 text-xs mb-2">Habilidades requeridas</p>
                <div className="flex flex-wrap gap-2">
                  {task.required_skills.map((item) => (
                    <span
                      key={item.id}
                      className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm"
                    >
                      {item.skill?.name ?? `Habilidad ${item.skill_id}`} · nivel {item.required_level}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {topRecommendation && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <h2 className="text-xl text-white">Resumen de la mejor opción</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">Integrante recomendado</p>
              <button
                onClick={() => navigate(`/member/${topRecommendation.member.id}`)}
                className="text-white hover:text-cyan-400 transition-colors"
              >
                {topRecommendation.member.full_name}
              </button>
              <p className="text-slate-500 text-xs mt-1">
                {roleLabels[topRecommendation.member.role_name] ?? topRecommendation.member.role_name}
              </p>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">Puntaje final</p>
              <p className="text-white text-xl">{topRecommendation.score}%</p>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">Riesgo</p>
              <span
                className={`inline-flex text-sm px-2 py-1 rounded border ${
                  riskColors[topRecommendation.risk_level]
                }`}
              >
                {riskLabels[topRecommendation.risk_level]}
              </span>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">Modo activo</p>
              <p className="text-white">
                {selectedMode === "hybrid" ? "Híbrido" : "Heurístico"}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {topRecommendation.model_used ? "Con apoyo del baseline" : "Solo reglas explicables"}
              </p>
            </div>
          </div>
        </div>
      )}

      <TaskInsightsPanel
        insightData={insightData}
        selectedStrategy={selectedStrategy}
        onApplySuggestedStrategy={handleApplySuggestedStrategy}
      />

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <h2 className="text-xl text-white mb-2">Estrategia de asignación</h2>
            <p className="text-slate-400 text-sm mb-3">
              Elige el enfoque con el que quieres calcular la recomendación.
            </p>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            >
              {strategyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="mt-3 p-4 bg-slate-800/50 rounded-lg">
              <p className="text-slate-300 text-sm">{strategyDescriptions[selectedStrategy]}</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl text-white mb-2">Modo de recomendación</h2>
            <p className="text-slate-400 text-sm mb-3">
              Compara reglas explicables contra la capa híbrida con apoyo del modelo baseline.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {modeOptions.map((option) => {
                const isActive = selectedMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedMode(option.value)}
                    className={`text-left rounded-xl border px-4 py-4 transition-all ${
                      isActive
                        ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <BrainCircuit className={`w-4 h-4 ${isActive ? "text-cyan-300" : "text-slate-400"}`} />
                      <p className={`text-sm ${isActive ? "text-cyan-200" : "text-white"}`}>
                        {option.label}
                      </p>
                    </div>
                    <p className="text-slate-400 text-xs">{option.description}</p>
                  </button>
                );
              })}
            </div>

            {activeMode && (
              <div className="mt-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-slate-300 text-sm">{activeMode.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnalysisSummary
        currentStrategyLabel={
          strategyLabels[recommendationData?.strategy ?? selectedStrategy] ??
          (recommendationData?.strategy ?? selectedStrategy)
        }
        recommendationsCount={recommendationData?.recommendations.length ?? 0}
        simulationsCount={simulationData?.simulations.length ?? 0}
        urgencyLabel={daysRemaining(task.due_date)}
        modeLabel={selectedMode === "hybrid" ? "Híbrido" : "Heurístico"}
        modelActive={
          selectedMode === "hybrid" &&
          Boolean(recommendationData?.recommendations?.some((rec) => rec.model_used))
        }
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl text-white">Top 3 integrantes recomendados</h2>
            <p className="text-slate-400 text-sm">
              {selectedMode === "hybrid"
                ? "Comparación final usando reglas explicables + probabilidad estimada por el baseline."
                : "Comparación basada únicamente en reglas heurísticas explicables."}
            </p>
          </div>
          {reloadingAnalysis && (
            <span className="text-sm text-slate-400">Actualizando análisis...</span>
          )}
        </div>

        {recommendationData?.recommendations?.length ? (
          recommendationData.recommendations.map((rec, index) => (
            <RecommendationCard
              key={rec.member.id}
              rec={rec}
              index={index}
              assigningMemberId={assigningMemberId}
              onAssign={handleAssign}
              onViewProfile={(memberId) => navigate(`/member/${memberId}`)}
              roleLabels={roleLabels}
              riskColors={riskColors}
              riskLabels={riskLabels}
              selectedMode={selectedMode}
            />
          ))
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-6 text-slate-400">
            No hay recomendaciones disponibles.
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-xl text-white">Simulación antes de asignar</h2>
            <p className="text-slate-400 text-sm">
              Compara cómo cambiaría la carga de trabajo antes de confirmar una asignación.
            </p>
          </div>
          {simulationData && (
            <span className="text-sm text-slate-400">
              Estrategia aplicada:{" "}
              <span className="text-white">
                {strategyLabels[simulationData.strategy] ?? simulationData.strategy}
              </span>{" "}
              · Modo:{" "}
              <span className="text-white">
                {simulationData.mode === "hybrid" ? "Híbrido" : "Heurístico"}
              </span>
            </span>
          )}
        </div>

        <div className="space-y-4">
          {simulationData?.simulations?.length ? (
            simulationData.simulations.map((simulation, index) => (
              <SimulationCard
                key={simulation.member.id}
                simulation={simulation}
                index={index}
                roleLabels={roleLabels}
                riskColors={riskColors}
                riskLabels={riskLabels}
                formatPercent={formatPercent}
                getLoadChangeLabel={getLoadChangeLabel}
                getActiveTasksChangeLabel={getActiveTasksChangeLabel}
                selectedMode={selectedMode}
              />
            ))
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-6 text-slate-400">
              No hay simulaciones disponibles.
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-cyan-400 mt-1" />
          <div>
            <h3 className="text-white mb-2">Sobre esta recomendación</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Esta vista compara integrantes reales del proyecto usando habilidades, disponibilidad,
              carga actual, estrategia de asignación y simulación del impacto antes de confirmar la
              decisión. En modo híbrido, además incorpora la probabilidad estimada por el baseline
              para enriquecer el análisis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}