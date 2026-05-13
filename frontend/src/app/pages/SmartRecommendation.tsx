import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  GitCompareArrows,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import {
  getTaskInsights,
  getTaskRecommendations,
  getTaskSimulation,
  type CandidateBucketItem,
  type RecommendationMode,
  type RecommendedAction,
  type TaskInsightResponse,
  type TaskRecommendationItem,
  type TaskRecommendationResponse,
  type TaskSimulationResponse,
} from "../services/recommendationService";
import { assignTaskFromRecommendation } from "../services/recommendationIntelligenceService";
import { getAccessToken, getCurrentUser } from "../services/sessionService";

const STRATEGY_OPTIONS = [
  { value: "balance", label: "Balance" },
  { value: "efficiency", label: "Eficiencia" },
  { value: "urgency", label: "Urgencia" },
  { value: "learning", label: "Aprendizaje" },
];

const MODE_OPTIONS: Array<{ value: RecommendationMode; label: string }> = [
  { value: "heuristic", label: "Heurístico" },
  { value: "hybrid", label: "Híbrido" },
];

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

function humanizeRisk(risk: string) {
  const map: Record<string, string> = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  };
  return map[risk] ?? risk;
}

function humanizeDecisionStatus(status?: string) {
  const map: Record<string, string> = {
    assignable_candidate_found: "Existe un candidato asignable",
    no_assignable_candidate: "No existe un candidato asignable",
  };
  return map[status || ""] ?? status ?? "Sin decisión";
}

function humanizeRecommendedAction(action?: RecommendedAction | string | null) {
  const map: Record<string, string> = {
    assign_now: "Asignar ahora",
    assign_with_mentoring_and_supervision: "Asignar con mentoría y supervisión",
    replan_or_escalate: "Replanificar o escalar",
    replan_or_explicit_risk_acceptance: "Replanificar o aceptar el riesgo explícitamente",
  };
  return map[action || ""] ?? action ?? "Sin acción definida";
}

function formatPercentNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(2)}%`;
}

function formatPercentText(value?: string | null) {
  if (!value) return "—";
  return value;
}

function parsePercentText(value?: string | null) {
  if (!value) return 0;
  const cleaned = value.replace("%", "").trim();
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getTopCandidate(data: TaskRecommendationResponse | null): TaskRecommendationItem | null {
  return data?.recommendations?.[0] ?? null;
}

function getConfidenceClasses(level: string) {
  if (level === "Alta") return "border-green-500/20 bg-green-500/10 text-green-300";
  if (level === "Media") return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
  return "border-red-500/20 bg-red-500/10 text-red-300";
}

function getOperationalConfidence(item: TaskRecommendationItem | CandidateBucketItem | null) {
  if (!item) return "Baja";

  const skillScore =
    "skill_match_score" in item ? Number(item.skill_match_score ?? 0) : item.matching_skills.length > 0 ? 60 : 0;

  const availability =
    "availability" in item && typeof item.availability === "number"
      ? Number(item.availability)
      : parsePercentText(String((item as TaskRecommendationItem).availability ?? ""));

  const currentLoad =
    "current_load" in item && typeof item.current_load === "number"
      ? Number(item.current_load)
      : parsePercentText(String((item as TaskRecommendationItem).current_load ?? ""));

  const mlProbability = Number(item.ml_success_probability ?? 0);
  const hasSkillMatches = item.matching_skills.length > 0;

  if (
    skillScore >= 80 &&
    availability >= 20 &&
    currentLoad <= 85 &&
    item.risk_level !== "high" &&
    (!item.model_used || mlProbability >= 0.6)
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

function getRecommendationWarnings(item: TaskRecommendationItem | CandidateBucketItem) {
  const warnings: string[] = [];
  const skillScore =
    "skill_match_score" in item ? Number(item.skill_match_score ?? 0) : item.matching_skills.length > 0 ? 60 : 0;

  const availability =
    "availability" in item && typeof item.availability === "number"
      ? Number(item.availability)
      : parsePercentText(String((item as TaskRecommendationItem).availability ?? ""));

  const currentLoad =
    "current_load" in item && typeof item.current_load === "number"
      ? Number(item.current_load)
      : parsePercentText(String((item as TaskRecommendationItem).current_load ?? ""));

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

  if (item.model_used && mlProbability < 0.3) {
    warnings.push("La probabilidad del modelo es baja para esta asignación.");
  }

  if ("assignability_status" in item && item.assignability_status === "not_assignable") {
    warnings.push("La IA no recomienda asignarlo ahora.");
  }

  return warnings;
}

function getDecisionBannerClasses(data: TaskRecommendationResponse | null) {
  if (!data) return "border-slate-700 bg-slate-900 text-slate-200";
  if (data.primary_candidate_available) {
    return "border-green-500/20 bg-green-500/10 text-green-300";
  }
  return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
}

function getBucketClasses(kind: "assignable" | "risky" | "not_assignable") {
  if (kind === "assignable") {
    return {
      wrapper: "border-green-500/20 bg-green-500/5",
      badge: "border-green-500/20 bg-green-500/10 text-green-300",
      title: "Asignables ahora",
    };
  }

  if (kind === "risky") {
    return {
      wrapper: "border-yellow-500/20 bg-yellow-500/5",
      badge: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
      title: "Asignables con riesgo",
    };
  }

  return {
    wrapper: "border-red-500/20 bg-red-500/5",
    badge: "border-red-500/20 bg-red-500/10 text-red-300",
    title: "No asignables ahora",
  };
}

function getActionGuidance(action?: RecommendedAction | string | null) {
  const map: Record<string, { title: string; bullets: string[] }> = {
    replan_or_escalate: {
      title: "Sugerencia ejecutiva",
      bullets: [
        "Revisar fecha límite o dividir la tarea en entregables más pequeños.",
        "Liberar carga del equipo antes de reasignar.",
        "Escalar la decisión si la tarea es crítica y no existe capacidad real.",
      ],
    },
    replan_or_explicit_risk_acceptance: {
      title: "Sugerencia ejecutiva",
      bullets: [
        "Si decides asignar, documenta el riesgo de forma explícita.",
        "Define supervisión cercana y puntos de control.",
        "Considera ajustar plazo, alcance o apoyo técnico.",
      ],
    },
    assign_with_mentoring_and_supervision: {
      title: "Sugerencia ejecutiva",
      bullets: [
        "Asignar con supervisión activa y seguimiento semanal.",
        "Definir apoyo técnico o mentoring desde el inicio.",
        "Controlar riesgo y retrabajo desde los primeros días.",
      ],
    },
    assign_now: {
      title: "Sugerencia ejecutiva",
      bullets: [
        "La asignación es viable con la información actual.",
        "Aun así, monitorea carga y avance del candidato.",
        "Registra la decisión para fortalecer el histórico.",
      ],
    },
  };

  return (
    map[action || ""] ?? {
      title: "Sugerencia ejecutiva",
      bullets: [
        "Revisa la decisión con base en capacidad operativa, skills y riesgo.",
      ],
    }
  );
}

function getNotAssignableReasonTags(item: CandidateBucketItem) {
  const tags: string[] = [];
  const skillMatches = item.matching_skills.length;
  const availability = Number(item.availability ?? 0);
  const currentLoad = Number(item.current_load ?? 0);
  const mlProbability = Number(item.ml_success_probability ?? 0);

  if (skillMatches === 0) tags.push("Brecha técnica");
  if (availability <= 0) tags.push("Sin disponibilidad");
  if (currentLoad >= 95) tags.push("Carga alta");
  if (item.risk_level === "high") tags.push("Riesgo alto");
  if (item.model_used && mlProbability < 0.35) tags.push("Debajo del umbral ML");

  return tags.slice(0, 4);
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

function CandidateCard({
  item,
  onAssign,
  assigning,
  allowAssign,
  emphasizeNotAssignable = false,
}: {
  item: CandidateBucketItem;
  onAssign: (memberId: number) => Promise<void>;
  assigning: boolean;
  allowAssign: boolean;
  emphasizeNotAssignable?: boolean;
}) {
  const confidence = getOperationalConfidence(item);
  const warnings = getRecommendationWarnings(item);
  const reasonTags = getNotAssignableReasonTags(item);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white text-lg font-semibold">{item.member.full_name}</p>
            {emphasizeNotAssignable && (
              <span className="px-3 py-1 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 text-xs">
                No asignable
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">{item.member.email}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-lg border text-xs ${getConfidenceClasses(confidence)}`}>
            Confianza {confidence}
          </span>
          <span className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs">
            Riesgo {humanizeRisk(item.risk_level)}
          </span>
        </div>
      </div>

      {reasonTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reasonTags.map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-lg border border-yellow-500/20 bg-yellow-500/10 text-yellow-300 text-xs" >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-slate-300 text-sm leading-relaxed">{item.reason}</p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
        <MetricPill label="Score final" value={item.score.toFixed(2)} />
        <MetricPill label="Disponibilidad" value={formatPercentNumber(item.availability)} />
        <MetricPill label="Carga actual" value={formatPercentNumber(item.current_load)} />
        <MetricPill label="Probabilidad ML" value={item.model_used ? formatPercentNumber((item.ml_success_probability ?? 0) * 100) : "No aplicada"} />
      </div>

      <div className="flex flex-wrap gap-2">
        {item.matching_skills.length > 0 ? (
          item.matching_skills.map((skill) => (
            <span key={skill} className="px-3 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-xs" >
              {skill}
            </span>
          ))
        ) : (
          <span className="text-slate-500 text-sm">Sin skills coincidentes registradas.</span>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <p className="text-yellow-300 text-sm font-medium mb-2">Observaciones</p>
          <div className="space-y-1">
            {warnings.map((warning) => (
              <p key={warning} className="text-yellow-200 text-sm">
                • {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => onAssign(item.member.id)} disabled={!allowAssign || assigning} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${ allowAssign ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-slate-800 text-slate-500 cursor-not-allowed" }`} >
          <UserCheck className="w-4 h-4" />
          {assigning ? "Asignando..." : allowAssign ? "Asignar candidato" : "No asignable"}
        </button>
      </div>
    </div>
  );
}

export default function SmartRecommendation() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUser = getCurrentUser();

  const [strategy, setStrategy] = useState("balance");
  const [mode, setMode] = useState<RecommendationMode>("hybrid");

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

  const heuristicTop = useMemo(() => getTopCandidate(heuristicRecommendations), [heuristicRecommendations]);
  const hybridTop = useMemo(() => getTopCandidate(hybridRecommendations), [hybridRecommendations]);

  const sameTopCandidate =
    heuristicTop &&
    hybridTop &&
    heuristicTop.member.id === hybridTop.member.id;

  const primaryCandidate = activeRecommendations?.primary_candidate ?? null;
  const actionGuidance = getActionGuidance(activeRecommendations?.recommended_action);

  const topReferenceCandidate = useMemo(() => {
    if (activeRecommendations?.primary_candidate) return null;
    return activeRecommendations?.recommendations?.[0] ?? null;
  }, [activeRecommendations]);

  useEffect(() => {
    if (!taskId || !token) return;

    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccessMessage("");

        const [heuristicData, hybridData, simulationData, insightsData] = await Promise.all([
          getTaskRecommendations(taskId, token, strategy, "heuristic"),
          getTaskRecommendations(taskId, token, strategy, "hybrid"),
          getTaskSimulation(taskId, token, strategy, mode),
          getTaskInsights(taskId, token),
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
      setSuccessMessage("");

      const [heuristicData, hybridData, simulationData, insightsData] = await Promise.all([
        getTaskRecommendations(taskId, token, strategy, "heuristic"),
        getTaskRecommendations(taskId, token, strategy, "hybrid"),
        getTaskSimulation(taskId, token, strategy, mode),
        getTaskInsights(taskId, token),
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

    const selectedRecommendation =
      activeRecommendations.recommendations.find((item) => item.member.id === memberId) ??
      activeRecommendations.assignable_candidates.find((item) => item.member.id === memberId);

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
        <Link to={taskId ? `/task/${taskId}` : "/projects"} className="text-cyan-400 hover:text-cyan-300 text-sm">
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
            <p className="text-slate-400">{activeRecommendations?.task_title || "Analizando tarea..."}</p>
          </div>

          <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-all disabled:opacity-60" >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
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
            <select value={mode} onChange={(e) => setMode(e.target.value as RecommendationMode)} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" >
              {MODE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <MetricPill label="Estrategia aplicada" value={humanizeStrategy(strategy)} />
          <MetricPill label="Modo seleccionado" value={humanizeMode(mode)} />
        </div>
      </div>

      <div className={`rounded-2xl border p-6 ${getDecisionBannerClasses(activeRecommendations)}`}>
        <div className="flex items-start gap-3">
          {activeRecommendations?.primary_candidate_available ? (
            <CheckCircle2 className="w-6 h-6 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 mt-0.5" />
          )}

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              {humanizeDecisionStatus(activeRecommendations?.decision_status)}
            </h2>

            <p className="text-sm opacity-90">
              Acción recomendada por la IA:{" "}
              <span className="font-semibold">
                {humanizeRecommendedAction(activeRecommendations?.recommended_action)}
              </span>
            </p>

            {activeRecommendations && (
              <div className="flex flex-wrap gap-3 text-sm">
                <span>
                  Asignables: <strong>{activeRecommendations.assignability_summary.assignable_count}</strong>
                </span>
                <span>
                  Con riesgo: <strong>{activeRecommendations.assignability_summary.risky_count}</strong>
                </span>
                <span>
                  No asignables: <strong>{activeRecommendations.assignability_summary.not_assignable_count}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {!primaryCandidate && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-6">
          <div className="flex items-center gap-3 mb-3">
            <Lightbulb className="w-5 h-5 text-cyan-300" />
            <h2 className="text-xl text-cyan-300">{actionGuidance.title}</h2>
          </div>
          <div className="space-y-2">
            {actionGuidance.bullets.map((bullet) => (
              <p key={bullet} className="text-cyan-100 text-sm">
                • {bullet}
              </p>
            ))}
          </div>
        </div>
      )}

      {primaryCandidate ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <h2 className="text-2xl text-white">Candidato primario</h2>
          </div>

          <CandidateCard item={primaryCandidate} onAssign={handleAssign} assigning={assigningMemberId === primaryCandidate.member.id} allowAssign={Boolean(activeRecommendations?.primary_candidate_available)} />
        </div>
      ) : (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="w-5 h-5 text-yellow-300" />
            <h2 className="text-xl text-yellow-300">No conviene asignar esta tarea directamente</h2>
          </div>
          <p className="text-yellow-100 text-sm leading-relaxed">
            La IA no encontró un candidato que cumpla simultáneamente con la capacidad operativa
            y el mínimo técnico esperado. La acción sugerida es{" "}
            <span className="font-semibold">
              {humanizeRecommendedAction(activeRecommendations?.recommended_action)}
            </span>.
          </p>
        </div>
      )}

      {topReferenceCandidate && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h2 className="text-2xl text-white">Perfil más cercano, pero no recomendado</h2>
          </div>

          <p className="text-slate-400 text-sm mb-4">
            Este perfil aparece primero en el ranking actual, pero la IA no lo considera asignable
            para esta tarea.
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <div>
                <p className="text-white text-lg font-semibold">{topReferenceCandidate.member.full_name}</p>
                <p className="text-slate-400 text-sm">{topReferenceCandidate.member.email}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-lg border border-yellow-500/20 bg-yellow-500/10 text-yellow-300 text-xs">
                  Solo referencia
                </span>
                <span className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs">
                  Score {topReferenceCandidate.score.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">{topReferenceCandidate.reason}</p>
          </div>
        </div>
      )}

      {insights && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h2 className="text-2xl text-white">Lectura inteligente de la tarea</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            <MetricPill label="Estrategia sugerida" value={insights.suggested_strategy_label} />
            <MetricPill label="Área sugerida" value={insights.suggested_area} />
            <MetricPill label="Confianza" value={insights.confidence_level.toUpperCase()} />
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">{insights.explanation}</p>

          <div className="flex flex-wrap gap-2 mb-3">
            {insights.suggested_skills.map((skill) => (
              <span key={skill} className="px-3 py-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-sm" >
                {skill}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            {insights.detected_signals.map((signal) => (
              <p key={signal} className="text-slate-400 text-sm">
                • {signal}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {(["assignable", "risky", "not_assignable"] as const).map((kind) => {
          const config = getBucketClasses(kind);
          const items =
            kind === "assignable"
              ? activeRecommendations?.assignable_candidates ?? []
              : kind === "risky"
              ? activeRecommendations?.risky_candidates ?? []
              : activeRecommendations?.not_assignable_candidates ?? [];

          return (
            <div key={kind} className={`rounded-2xl border p-6 space-y-4 ${config.wrapper}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl text-white">{config.title}</h2>
                <span className={`px-3 py-1 rounded-lg border text-xs ${config.badge}`}>{items.length}</span>
              </div>

              {items.length === 0 ? (
                <p className="text-slate-400 text-sm">No hay candidatos en este grupo.</p>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <CandidateCard key={`${kind}-${item.member.id}`} item={item} onAssign={handleAssign} assigning={assigningMemberId === item.member.id} allowAssign={kind === "assignable" && Boolean(activeRecommendations?.primary_candidate_available)} emphasizeNotAssignable={kind === "not_assignable"} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompareArrows className="w-5 h-5 text-purple-400" />
          <h2 className="text-2xl text-white">
            {activeRecommendations?.primary_candidate_available
              ? "Comparación Heurístico vs Híbrido"
              : "Comparación de perfiles de referencia"}
          </h2>
        </div>

        {!activeRecommendations?.primary_candidate_available && (
          <p className="text-slate-400 text-sm mb-4">
            Los perfiles mostrados abajo son referencias de ranking. No representan candidatos
            asignables para esta tarea en el estado actual.
          </p>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-slate-400 text-xs mb-2">
              {activeRecommendations?.primary_candidate_available ? "Top Heurístico" : "Referencia Heurística"}
            </p>
            <p className="text-white text-lg font-semibold">{heuristicTop?.member.full_name || "—"}</p>
            <p className="text-slate-400 text-sm mt-1">
              Puntaje: {heuristicTop?.score?.toFixed(2) || "—"}
            </p>
            <p className="text-slate-400 text-sm">
              Riesgo: {heuristicTop ? humanizeRisk(heuristicTop.risk_level) : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-slate-400 text-xs mb-2">
              {activeRecommendations?.primary_candidate_available ? "Top Híbrido" : "Referencia Híbrida"}
            </p>
            <p className="text-white text-lg font-semibold">{hybridTop?.member.full_name || "—"}</p>
            <p className="text-slate-400 text-sm mt-1">
              Puntaje: {hybridTop?.score?.toFixed(2) || "—"}
            </p>
            <p className="text-slate-400 text-sm">
              Riesgo: {hybridTop ? humanizeRisk(hybridTop.risk_level) : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-slate-400 text-xs mb-2">Lectura rápida</p>
            <p className="text-white text-lg font-semibold">
              {sameTopCandidate ? "Coinciden" : "Cambian de candidato"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {activeRecommendations?.primary_candidate_available
                ? "La IA te permite contrastar el ranking puro vs el ranking con señal ML."
                : "La IA muestra perfiles de referencia, pero mantiene bloqueada la asignación real."}
            </p>
          </div>
        </div>
      </div>

      {simulation && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-2xl text-white">Simulación de impacto</h2>
          </div>

          {!activeRecommendations?.primary_candidate_available && (
            <p className="text-slate-400 text-sm mb-4">
              Esta simulación muestra impacto potencial, pero no implica aprobación automática de la asignación.
            </p>
          )}

          <div className="space-y-4">
            {simulation.simulations.map((item) => (
              <div key={item.member.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-white text-lg font-semibold">
                      #{item.rank} · {item.member.full_name}
                    </p>
                    <p className="text-slate-400 text-sm">{item.reason}</p>
                  </div>

                  <div className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs">
                    Riesgo {humanizeRisk(item.risk_level)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <MetricPill label="Carga actual" value={formatPercentNumber(item.current_load)} />
                  <MetricPill label="Carga proyectada" value={formatPercentNumber(item.projected_load)} />
                  <MetricPill label="Disponibilidad actual" value={formatPercentNumber(item.current_availability)} />
                  <MetricPill label="Disponibilidad proyectada" value={formatPercentNumber(item.projected_availability)} />
                  <MetricPill label="Tareas activas" value={String(item.current_active_tasks)} />
                  <MetricPill label="Impacto horas" value={item.estimated_hours_impact.toFixed(2)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h2 className="text-2xl text-white">
            {activeRecommendations?.primary_candidate_available ? "Ranking resumido" : "Perfiles evaluados por la IA"}
          </h2>
        </div>

        {!activeRecommendations?.primary_candidate_available && (
          <p className="text-slate-400 text-sm mb-4">
            El ranking se muestra para transparencia analítica, pero ninguno de estos perfiles supera el filtro final
            de asignación.
          </p>
        )}

        <div className="space-y-4">
          {(activeRecommendations?.recommendations ?? []).map((item) => (
            <div key={item.member.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-lg font-semibold">{item.member.full_name}</p>
                    {!activeRecommendations?.primary_candidate_available && (
                      <span className="px-3 py-1 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 text-xs">
                        No asignable
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{item.member.email}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs">
                    Score {item.score.toFixed(2)}
                  </span>
                  <span className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs">
                    Riesgo {humanizeRisk(item.risk_level)}
                  </span>
                </div>
              </div>

              <p className="text-slate-300 text-sm leading-relaxed">{item.reason}</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                <MetricPill label="Disponibilidad" value={formatPercentText(item.availability)} />
                <MetricPill label="Carga actual" value={formatPercentText(item.current_load)} />
                <MetricPill label="Skills coincidentes" value={String(item.matching_skills.length)} />
                <MetricPill label="Probabilidad ML" value={item.model_used ? formatPercentNumber((item.ml_success_probability ?? 0) * 100) : "No aplicada"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}