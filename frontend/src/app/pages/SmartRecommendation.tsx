import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Cpu,
  Gauge,
  GitCompareArrows,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import {
  assignTaskFromRecommendation,
  getTaskInsightsIntelligence,
  getTaskRecommendationsIntelligence,
  getTaskSimulationIntelligence,
  type TaskInsightResponse,
  type TaskRecommendationItem,
  type TaskRecommendationResponse,
  type TaskSimulationResponse,
} from "../services/recommendationIntelligenceService";
import { getAccessToken, getCurrentUser } from "../services/sessionService";

const STRATEGY_OPTIONS = [
  { value: "balance", label: "Balance" },
  { value: "efficiency", label: "Eficiencia" },
  { value: "urgency", label: "Urgencia" },
  { value: "learning", label: "Aprendizaje" },
];

const MODE_OPTIONS = [
  { value: "heuristic", label: "Heurístico" },
  { value: "hybrid", label: "Híbrido" },
];

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function humanizeRisk(risk: string) {
  const map: Record<string, string> = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  };

  return map[risk] ?? risk;
}

function humanizeMode(mode: string) {
  const map: Record<string, string> = {
    heuristic: "Heurístico",
    hybrid: "Híbrido",
  };

  return map[mode] ?? mode;
}

function humanizeStrategy(strategy: string) {
  const map: Record<string, string> = {
    balance: "Balance",
    efficiency: "Eficiencia",
    urgency: "Urgencia",
    learning: "Aprendizaje",
  };

  return map[strategy] ?? strategy;
}

function getTopCandidate(data: TaskRecommendationResponse | null): TaskRecommendationItem | null {
  return data?.recommendations?.[0] ?? null;
}

function parsePercentText(value?: string | null) {
  if (!value) return 0;
  const cleaned = value.replace("%", "").trim();
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getOperationalConfidence(item: TaskRecommendationItem | null) {
  if (!item) return "Baja";

  const skillScore = Number(item.skill_match_score ?? 0);
  const availability = parsePercentText(item.availability);
  const currentLoad = parsePercentText(item.current_load);
  const mlProbability = Number(item.ml_success_probability ?? 0);
  const hasSkillMatches = item.matching_skills.length > 0;

  if (
    skillScore >= 80 &&
    availability >= 20 &&
    currentLoad <= 85 &&
    item.risk_level !== "high" &&
    (!item.model_used || mlProbability >= 0.60)
  ) {
    return "Alta";
  }

  if (
    (skillScore >= 45 || hasSkillMatches) &&
    currentLoad <= 95 &&
    !(availability <= 0 && item.risk_level === "high")
  ) {
    return "Media";
  }

  return "Baja";
}

function getConfidenceClasses(level: string) {
  if (level === "Alta") {
    return "border-green-500/20 bg-green-500/10 text-green-300";
  }
  if (level === "Media") {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
  }
  return "border-red-500/20 bg-red-500/10 text-red-300";
}

function getRecommendationWarnings(item: TaskRecommendationItem) {
  const warnings: string[] = [];
  const availability = parsePercentText(item.availability);
  const currentLoad = parsePercentText(item.current_load);
  const skillScore = Number(item.skill_match_score ?? 0);
  const mlProbability = Number(item.ml_success_probability ?? 0);

  if (item.matching_skills.length === 0 || skillScore <= 0) {
    warnings.push("No registra habilidades coincidentes con la tarea.");
  }

  if (availability <= 0) {
    warnings.push("No tiene disponibilidad operativa inmediata.");
  }

  if (currentLoad >= 95) {
    warnings.push("Tiene una carga actual muy alta.");
  }

  if (item.risk_level === "high") {
    warnings.push("La asignación tiene riesgo alto y conviene revisarla.");
  }

  if (item.model_used && mlProbability < 0.30) {
    warnings.push("La probabilidad del modelo es baja para esta asignación.");
  }

  return warnings;
}

export default function SmartRecommendation() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUser = getCurrentUser();

  const [strategy, setStrategy] = useState("balance");
  const [mode, setMode] = useState("hybrid");

  const [heuristicRecommendations, setHeuristicRecommendations] =
    useState<TaskRecommendationResponse | null>(null);
  const [hybridRecommendations, setHybridRecommendations] =
    useState<TaskRecommendationResponse | null>(null);
  const [simulation, setSimulation] = useState<TaskSimulationResponse | null>(null);
  const [insights, setInsights] = useState<TaskInsightResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [assigningMemberId, setAssigningMemberId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const activeRecommendations = useMemo(() => {
    return mode === "heuristic" ? heuristicRecommendations : hybridRecommendations;
  }, [mode, heuristicRecommendations, hybridRecommendations]);

  const heuristicTop = useMemo(
    () => getTopCandidate(heuristicRecommendations),
    [heuristicRecommendations]
  );

  const hybridTop = useMemo(
    () => getTopCandidate(hybridRecommendations),
    [hybridRecommendations]
  );

  const activeTop = useMemo(
    () => getTopCandidate(activeRecommendations),
    [activeRecommendations]
  );

  const activeTopConfidence = useMemo(
    () => getOperationalConfidence(activeTop),
    [activeTop]
  );

  const activeTopWarnings = useMemo(
    () => (activeTop ? getRecommendationWarnings(activeTop) : []),
    [activeTop]
  );

  const sameTopCandidate =
    heuristicTop &&
    hybridTop &&
    heuristicTop.member.id === hybridTop.member.id;

  useEffect(() => {
    if (!taskId || !token) return;

    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccessMessage("");

        const [
          heuristicData,
          hybridData,
          simulationData,
          insightsData,
        ] = await Promise.all([
          getTaskRecommendationsIntelligence(taskId, strategy, "heuristic", token),
          getTaskRecommendationsIntelligence(taskId, strategy, "hybrid", token),
          getTaskSimulationIntelligence(taskId, strategy, mode, token),
          getTaskInsightsIntelligence(taskId, token),
        ]);

        setHeuristicRecommendations(heuristicData);
        setHybridRecommendations(hybridData);
        setSimulation(simulationData);
        setInsights(insightsData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar la recomendación inteligente.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [taskId, strategy, mode, token]);

  const handleRefresh = async () => {
    if (!taskId || !token) return;

    try {
      setRefreshing(true);
      setError("");

      const [
        heuristicData,
        hybridData,
        simulationData,
        insightsData,
      ] = await Promise.all([
        getTaskRecommendationsIntelligence(taskId, strategy, "heuristic", token),
        getTaskRecommendationsIntelligence(taskId, strategy, "hybrid", token),
        getTaskSimulationIntelligence(taskId, strategy, mode, token),
        getTaskInsightsIntelligence(taskId, token),
      ]);

      setHeuristicRecommendations(heuristicData);
      setHybridRecommendations(hybridData);
      setSimulation(simulationData);
      setInsights(insightsData);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo actualizar la recomendación.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAssign = async (memberId: number) => {
    if (!taskId || !token || !activeRecommendations) return;

    const selectedRecommendation = activeRecommendations.recommendations.find(
      (item) => item.member.id === memberId
    );

    if (!selectedRecommendation) return;

    try {
      setAssigningMemberId(memberId);
      setError("");
      setSuccessMessage("");

      await assignTaskFromRecommendation(
        taskId,
        {
          assigned_to: memberId,
          assigned_by: currentUser?.id ?? null,
          source: mode,
          strategy,
          recommendation_score: selectedRecommendation.score,
          risk_level: selectedRecommendation.risk_level,
          reason: selectedRecommendation.reason,
          recommendation_used: true,
        },
        token
      );

      setSuccessMessage("La tarea fue asignada correctamente.");
      navigate(`/task/${taskId}`);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo asignar la tarea.");
    } finally {
      setAssigningMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-300 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        Cargando recomendación inteligente...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Link to={taskId ? `/task/${taskId}` : "/projects"} className="text-cyan-400 hover:text-cyan-300 text-sm" >
          ← Volver al detalle de la tarea
        </Link>

        <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <BrainCircuit className="w-6 h-6 text-cyan-400" />
              <h1 className="text-3xl text-white">Recomendación Inteligente</h1>
              {activeRecommendations && (
                <span className="px-3 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-sm">
                  Modo activo: {humanizeMode(mode)}
                </span>
              )}
            </div>

            <p className="text-slate-400">
              {activeRecommendations?.task_title || "Analizando tarea..."}
            </p>
          </div>

          <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-all disabled:opacity-60" >
            <Sparkles className={`w-4 h-4 ${refreshing ? "animate-pulse" : ""}`} />
            {refreshing ? "Actualizando..." : "Actualizar análisis"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
          {successMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-2">Estrategia</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" >
              {STRATEGY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Modo activo para asignar</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" >
              {MODE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-4 py-3">
            <p className="text-slate-400 text-xs mb-1">Estrategia aplicada</p>
            <p className="text-white font-medium">{humanizeStrategy(strategy)}</p>
          </div>

          <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-4 py-3">
            <p className="text-slate-400 text-xs mb-1">Modo seleccionado</p>
            <p className="text-white font-medium">{humanizeMode(mode)}</p>
          </div>
        </div>
      </div>

      {activeTop && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <h2 className="text-2xl text-white">Lectura operativa de la recomendación</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Candidato sugerido</p>
              <p className="text-white text-lg font-semibold">{activeTop.member.full_name}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Puntaje final</p>
              <p className="text-white text-lg font-semibold">{activeTop.score.toFixed(2)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Probabilidad ML</p>
              <p className="text-white text-lg font-semibold">
                {formatPercent(activeTop.ml_success_probability)}
              </p>
            </div>

            <div className={`rounded-xl border p-4 ${getConfidenceClasses(activeTopConfidence)}`}>
              <p className="text-xs mb-1 opacity-80">Confianza operativa</p>
              <p className="text-lg font-semibold">{activeTopConfidence}</p>
            </div>
          </div>

          {activeTopWarnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-300" />
                <p className="text-yellow-300 font-medium">Observaciones de revisión</p>
              </div>
              <div className="space-y-1">
                {activeTopWarnings.map((warning) => (
                  <p key={warning} className="text-yellow-200 text-sm">
                    • {warning}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompareArrows className="w-5 h-5 text-purple-400" />
          <h2 className="text-2xl text-white">Comparación Heurístico vs Híbrido</h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-slate-400 text-xs mb-2">Top Heurístico</p>
            <p className="text-white text-lg font-semibold">
              {heuristicTop?.member.full_name || "—"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Puntaje: {heuristicTop?.score?.toFixed(2) || "—"}
            </p>
            <p className="text-slate-400 text-sm">
              Riesgo: {heuristicTop ? humanizeRisk(heuristicTop.risk_level) : "—"}
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Confianza: {getOperationalConfidence(heuristicTop)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-slate-400 text-xs mb-2">Top Híbrido</p>
            <p className="text-white text-lg font-semibold">
              {hybridTop?.member.full_name || "—"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Puntaje: {hybridTop?.score?.toFixed(2) || "—"}
            </p>
            <p className="text-slate-400 text-sm">
              Prob. ML: {formatPercent(hybridTop?.ml_success_probability)}
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Confianza: {getOperationalConfidence(hybridTop)}
            </p>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <p className="text-slate-400 text-xs mb-2">Resultado de comparación</p>
            <p className="text-white text-lg font-semibold">
              {sameTopCandidate ? "Coinciden" : "Difieren"}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              {sameTopCandidate
                ? "Ambos motores sugieren a la misma persona como mejor candidata."
                : "Los motores proponen candidatos distintos según su lógica de evaluación."}
            </p>
          </div>
        </div>
      </div>

      {insights && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h2 className="text-2xl text-white">Insights de la tarea</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Explicación</p>
                <p className="text-slate-200">{insights.explanation}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-2">Señales detectadas</p>
                <div className="flex flex-wrap gap-2">
                  {insights.detected_signals.map((signal) => (
                    <span key={signal} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm" >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-2">Habilidades sugeridas</p>
                <div className="flex flex-wrap gap-2">
                  {insights.suggested_skills.map((skill) => (
                    <span key={skill} className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm" >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Estrategia sugerida</p>
                <p className="text-white">{insights.suggested_strategy_label}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Área sugerida</p>
                <p className="text-white">{insights.suggested_area}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Confianza</p>
                <p className="text-white capitalize">{insights.confidence_level}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeRecommendations && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-2xl text-white">
              Top de candidatos · modo {humanizeMode(mode)}
            </h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {activeRecommendations.recommendations.map((item, index) => {
              const confidence = getOperationalConfidence(item);
              const warnings = getRecommendationWarnings(item);

              return (
                <div key={item.member.id} className={`rounded-xl border p-5 ${ index === 0 ? "border-cyan-500/30 bg-cyan-500/5" : "border-slate-800 bg-slate-950/40" }`} >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-lg font-semibold">{item.member.full_name}</p>
                      <p className="text-slate-400 text-sm">{item.member.email}</p>
                      <p className="text-slate-500 text-xs mt-1">{item.member.role_name}</p>
                    </div>

                    <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                      <p className="text-slate-400 text-xs mb-1">Puntaje</p>
                      <p className="text-white font-medium">{item.score.toFixed(2)}</p>
                    </div>

                    <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                      <p className="text-slate-400 text-xs mb-1">Riesgo</p>
                      <p className="text-white font-medium">{humanizeRisk(item.risk_level)}</p>
                    </div>

                    <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                      <p className="text-slate-400 text-xs mb-1">Disponibilidad</p>
                      <p className="text-white font-medium">{item.availability}</p>
                    </div>

                    <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                      <p className="text-slate-400 text-xs mb-1">Carga actual</p>
                      <p className="text-white font-medium">{item.current_load}</p>
                    </div>
                  </div>

                  <div className={`mt-4 rounded-lg border p-3 ${getConfidenceClasses(confidence)}`}>
                    <p className="text-xs mb-1 opacity-80">Confianza operativa</p>
                    <p className="font-medium">{confidence}</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-slate-400 text-xs mb-2">Habilidades coincidentes</p>
                    <div className="flex flex-wrap gap-2">
                      {item.matching_skills.length > 0 ? (
                        item.matching_skills.map((skill) => (
                          <span key={skill} className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs" >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-sm">
                          Sin coincidencias registradas
                        </span>
                      )}
                    </div>
                  </div>

                  {warnings.length > 0 && (
                    <div className="mt-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
                      <p className="text-yellow-300 text-xs mb-2">Alertas de revisión</p>
                      <div className="space-y-1">
                        {warnings.map((warning) => (
                          <p key={warning} className="text-yellow-200 text-sm">
                            • {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-lg bg-slate-900/70 border border-slate-800 p-4">
                    <p className="text-slate-400 text-xs mb-1">Justificación</p>
                    <p className="text-slate-300 text-sm">{item.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                      <p className="text-slate-400 text-xs mb-1">Heurístico</p>
                      <p className="text-white font-medium">
                        {item.heuristic_score?.toFixed(2) ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                      <p className="text-slate-400 text-xs mb-1">Prob. ML</p>
                      <p className="text-white font-medium">
                        {formatPercent(item.ml_success_probability)}
                      </p>
                    </div>
                  </div>

                  <button onClick={() => handleAssign(item.member.id)} disabled={assigningMemberId === item.member.id} className="w-full mt-5 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-500 text-slate-950 font-medium hover:bg-cyan-400 transition-all disabled:opacity-60" >
                    {assigningMemberId === item.member.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    {assigningMemberId === item.member.id
                      ? "Asignando..."
                      : "Asignar a esta persona"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {simulation && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gauge className="w-5 h-5 text-purple-400" />
            <h2 className="text-2xl text-white">
              Simulación de impacto · modo {humanizeMode(mode)}
            </h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {simulation.simulations.map((item) => (
              <div key={`${item.member.id}-${item.rank}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-5" >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold">{item.member.full_name}</p>
                    <p className="text-slate-400 text-sm">Rank #{item.rank}</p>
                  </div>

                  <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
                    {item.score.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Carga actual</p>
                    <p className="text-white">{item.current_load.toFixed(2)}%</p>
                  </div>

                  <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Carga proyectada</p>
                    <p className="text-white">{item.projected_load.toFixed(2)}%</p>
                  </div>

                  <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Disp. actual</p>
                    <p className="text-white">{item.current_availability.toFixed(2)}%</p>
                  </div>

                  <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Disp. proyectada</p>
                    <p className="text-white">{item.projected_availability.toFixed(2)}%</p>
                  </div>

                  <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Tareas activas</p>
                    <p className="text-white">{item.current_active_tasks}</p>
                  </div>

                  <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Tareas proyectadas</p>
                    <p className="text-white">{item.projected_active_tasks}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-slate-900/70 border border-slate-800 p-4">
                  <p className="text-slate-400 text-xs mb-1">Impacto estimado</p>
                  <p className="text-white">{item.estimated_hours_impact.toFixed(2)} h</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl text-white">Lectura rápida para fase final</h2>
        </div>

        <div className="space-y-2 text-slate-300 text-sm">
          <p>• Prioriza mostrar <span className="text-white font-medium">balance + hybrid</span> como configuración principal.</p>
          <p>• Usa <span className="text-white font-medium">efficiency + hybrid</span> como segunda vista defendible.</p>
          <p>• Si la confianza operativa sale baja o aparecen muchas alertas, conviene revisión manual del líder.</p>
        </div>
      </div>
    </div>
  );
}