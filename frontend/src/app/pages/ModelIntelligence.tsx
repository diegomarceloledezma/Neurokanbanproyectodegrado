import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  Layers3,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  getMlBaselineStatus,
  trainCompactCleanedBaseline,
  type BaselineMetadata,
  type BaselineStatusResponse,
} from "../services/mlBaselineService";
import {
  getCleanTrainingPreview,
  type CleanTrainingPreviewResponse,
} from "../services/trainingDataService";
import {
  getDataProvenanceReport,
  getTrainingReadiness,
  type DataProvenanceReportResponse,
  type TrainingReadinessResponse,
} from "../services/dataProvenanceService";
import {
  getAssignmentEffectivenessSummary,
  type AssignmentEffectivenessSummaryResponse,
} from "../services/assignmentEffectivenessService";
import { getAccessToken } from "../services/sessionService";

type ExecutiveLevel = "alta" | "media" | "baja";

function formatPercent(value?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatPlainPercent(value?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function formatValue(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(2);
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

function humanizeTrainingSource(source?: string) {
  if (!source) return "No definido";

  const map: Record<string, string> = {
    historical_internal_data: "Histórico interno",
    historical_internal_data_cleaned: "Histórico interno depurado",
    database_training_history: "Historial desde base de datos",
  };

  return map[source] ?? source;
}

function humanizeFeatureName(feature: string) {
  const map: Record<string, string> = {
    "num__recommendation_score": "Puntaje de recomendación",
    "num__skill_match_score": "Ajuste de habilidades",
    "num__performance_score": "Desempeño histórico",
    "num__current_load_snapshot": "Carga actual",
    "num__required_skills_count": "Cantidad de habilidades requeridas",
    "num__matching_ratio": "Proporción de coincidencia",
    "num__estimated_hours_snapshot": "Horas estimadas",
    "num__complexity_snapshot": "Complejidad",
    "cat__strategy_balance": "Estrategia balance",
    "cat__strategy_efficiency": "Estrategia eficiencia",
    "cat__strategy_learning": "Estrategia aprendizaje",
    "cat__strategy_urgency": "Estrategia urgencia",
    "cat__priority_snapshot_low": "Prioridad baja",
    "cat__priority_snapshot_medium": "Prioridad media",
    "cat__priority_snapshot_high": "Prioridad alta",
    "cat__priority_snapshot_critical": "Prioridad crítica",
    "cat__source_historical_backfill": "Origen backfill histórico",
  };

  return map[feature] ?? feature;
}

function humanizeReason(reason: string) {
  const map: Record<string, string> = {
    uncertain_success_band: "Zona ambigua de éxito",
    weak_backfill_signal: "Señal débil de backfill",
    no_required_skills: "Sin habilidades requeridas",
    invalid_matching_ratio: "Matching ratio inválido",
    invalid_complexity: "Complejidad inválida",
    invalid_operational_snapshot: "Snapshot operativo inválido",
  };

  return map[reason] ?? reason;
}

function humanizeReadiness(level?: string) {
  const map: Record<string, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  };

  return map[level || ""] ?? level ?? "No definida";
}

function humanizeBreakdownLabel(label: string) {
  const map: Record<string, string> = {
    heuristic: "Heurístico",
    hybrid: "Híbrido",
    manual: "Manual",
    historical_backfill: "Backfill histórico",
    balance: "Balance",
    efficiency: "Eficiencia",
    urgency: "Urgencia",
    learning: "Aprendizaje",
    no_definida: "No definida",
  };

  return map[label] ?? label;
}

function labelDistributionSummary(metadata: BaselineMetadata | null) {
  if (!metadata) return { negative: 0, positive: 0 };

  return {
    negative: metadata.label_distribution?.["0"] ?? 0,
    positive: metadata.label_distribution?.["1"] ?? 0,
  };
}

function topItems<T extends { label: string; count: number }>(items: T[] | undefined, limit = 5) {
  return (items ?? []).slice(0, limit);
}

function getLevelClasses(level: ExecutiveLevel) {
  if (level === "alta") {
    return "border-green-500/20 bg-green-500/10 text-green-300";
  }
  if (level === "media") {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
  }
  return "border-red-500/20 bg-red-500/10 text-red-300";
}

function humanizeExecutiveLevel(level: ExecutiveLevel) {
  const map: Record<ExecutiveLevel, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  };

  return map[level];
}

function evaluateModelLevel(metadata: BaselineMetadata | null): ExecutiveLevel {
  if (!metadata) return "baja";

  const accuracy = metadata.metrics?.accuracy ?? 0;
  const f1 = metadata.metrics?.f1 ?? 0;
  const rocAuc = metadata.metrics?.roc_auc ?? 0;

  let score = 0;

  if (accuracy >= 0.72) score += 2;
  else if (accuracy >= 0.65) score += 1;

  if (f1 >= 0.68) score += 2;
  else if (f1 >= 0.58) score += 1;

  if (rocAuc >= 0.82) score += 2;
  else if (rocAuc >= 0.74) score += 1;

  if (score >= 4) return "alta";
  if (score >= 2) return "media";
  return "baja";
}

function evaluateReadinessLevel(readiness: TrainingReadinessResponse | null): ExecutiveLevel {
  if (!readiness) return "baja";

  if (readiness.readiness_score >= 85) return "alta";
  if (readiness.readiness_score >= 65) return "media";
  return "baja";
}

function evaluateHistoricalEvidenceLevel(
  effectiveness: AssignmentEffectivenessSummaryResponse | null
): ExecutiveLevel {
  if (!effectiveness) return "baja";

  if (effectiveness.total_records_with_outcome >= 80) return "alta";
  if (effectiveness.total_records_with_outcome >= 25) return "media";
  return "baja";
}

function evaluateDataQualityLevel(cleanPreview: CleanTrainingPreviewResponse | null): ExecutiveLevel {
  if (!cleanPreview || cleanPreview.raw_total_rows <= 0) return "baja";

  const cleanRate = (cleanPreview.clean_total_rows / cleanPreview.raw_total_rows) * 100;

  if (cleanRate >= 70) return "alta";
  if (cleanRate >= 50) return "media";
  return "baja";
}

function buildExecutiveSummary(params: {
  metadata: BaselineMetadata | null;
  readiness: TrainingReadinessResponse | null;
  effectiveness: AssignmentEffectivenessSummaryResponse | null;
  cleanPreview: CleanTrainingPreviewResponse | null;
}) {
  const { metadata, readiness, effectiveness, cleanPreview } = params;

  const modelLevel = evaluateModelLevel(metadata);
  const readinessLevel = evaluateReadinessLevel(readiness);
  const evidenceLevel = evaluateHistoricalEvidenceLevel(effectiveness);
  const dataQualityLevel = evaluateDataQualityLevel(cleanPreview);

  const levels = [modelLevel, readinessLevel, evidenceLevel, dataQualityLevel];
  const highCount = levels.filter((item) => item === "alta").length;
  const lowCount = levels.filter((item) => item === "baja").length;

  let overallLevel: ExecutiveLevel = "media";

  if (highCount >= 3 && lowCount === 0) overallLevel = "alta";
  else if (lowCount >= 2) overallLevel = "baja";

  const findings: string[] = [];

  if (readiness) {
    findings.push(
      `La base de entrenamiento presenta un readiness de ${readiness.readiness_score.toFixed(
        2
      )}, con nivel ${humanizeReadiness(readiness.readiness_level).toLowerCase()}.`
    );
  }

  if (metadata) {
    findings.push(
      `El modelo activo es ${metadata.model_type} con variante ${humanizeVariant(
        metadata.training_variant
      ).toLowerCase()} y ROC AUC de ${formatPercent(metadata.metrics.roc_auc)}.`
    );
  }

  if (effectiveness) {
    findings.push(
      `Existen ${effectiveness.total_records_with_outcome} asignaciones con outcome registrado para analizar desempeño histórico.`
    );

    if (
      effectiveness.ai_vs_non_ai_gap !== null &&
      effectiveness.ai_vs_non_ai_gap !== undefined
    ) {
      const gapText =
        effectiveness.ai_vs_non_ai_gap >= 0
          ? `La IA supera a las fuentes no IA por ${effectiveness.ai_vs_non_ai_gap.toFixed(
              2
            )} puntos de éxito promedio.`
          : `La IA queda ${Math.abs(effectiveness.ai_vs_non_ai_gap).toFixed(
              2
            )} puntos por debajo de fuentes no IA en éxito promedio.`;

      findings.push(gapText);
    }
  }

  if (cleanPreview) {
    findings.push(
      `El dataset limpio conserva ${cleanPreview.clean_total_rows} registros a partir de ${cleanPreview.raw_total_rows} filas crudas.`
    );
  }

  let verdict =
    "El sistema ya cuenta con un pipeline funcional, aunque todavía debe seguir fortaleciendo datos y validación.";

  if (overallLevel === "alta") {
    verdict =
      "El sistema presenta una base sólida para fase final: competencia de modelos, evidencia histórica, dataset depurado y señales cuantitativas defendibles.";
  } else if (overallLevel === "media") {
    verdict =
      "El sistema ya es defendible como solución inteligente funcional, aunque todavía conviene seguir ampliando dataset y validación para aumentar confianza empresarial.";
  } else if (overallLevel === "baja") {
    verdict =
      "El sistema ya demuestra arquitectura inteligente y trazabilidad, pero todavía requiere fortalecer datos y rendimiento antes de una confianza alta.";
  }

  return {
    overallLevel,
    modelLevel,
    readinessLevel,
    evidenceLevel,
    dataQualityLevel,
    verdict,
    findings,
  };
}

export default function ModelIntelligence() {
  const token = getAccessToken();

  const [status, setStatus] = useState<BaselineStatusResponse | null>(null);
  const [cleanPreview, setCleanPreview] = useState<CleanTrainingPreviewResponse | null>(null);
  const [report, setReport] = useState<DataProvenanceReportResponse | null>(null);
  const [readiness, setReadiness] = useState<TrainingReadinessResponse | null>(null);
  const [effectiveness, setEffectiveness] =
    useState<AssignmentEffectivenessSummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState("");
  const [trainingMessage, setTrainingMessage] = useState("");

  const metadata = status?.metadata ?? null;
  const distribution = useMemo(() => labelDistributionSummary(metadata), [metadata]);

  const executiveSummary = useMemo(() => {
    return buildExecutiveSummary({
      metadata,
      readiness,
      effectiveness,
      cleanPreview,
    });
  }, [metadata, readiness, effectiveness, cleanPreview]);

  const candidateModels = metadata?.candidate_models ?? [];
  const classBalance = metadata?.class_balance ?? cleanPreview?.class_balance ?? null;
  const modelReadiness = metadata?.model_readiness ?? null;

  const loadAll = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      const [
        statusResult,
        previewResult,
        reportResult,
        readinessResult,
        effectivenessResult,
      ] = await Promise.all([
        getMlBaselineStatus(token || undefined),
        getCleanTrainingPreview(20, token || undefined),
        getDataProvenanceReport(token || undefined),
        getTrainingReadiness(token || undefined),
        getAssignmentEffectivenessSummary(token || undefined),
      ]);

      setStatus(statusResult);
      setCleanPreview(previewResult);
      setReport(reportResult);
      setReadiness(readinessResult);
      setEffectiveness(effectivenessResult);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo cargar la información del modelo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll(false);
  }, []);

  const handleRetrain = async () => {
    try {
      setTraining(true);
      setTrainingMessage("");
      setError("");

      const result = await trainCompactCleanedBaseline(token || undefined);

      setTrainingMessage(
        `Modelo reentrenado correctamente. Ganador: ${result.model_type}. Accuracy: ${formatPercent(
          result.metrics?.accuracy
        )} · F1: ${formatPercent(result.metrics?.f1)} · ROC AUC: ${formatPercent(
          result.metrics?.roc_auc
        )}`
      );

      await loadAll(true);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo reentrenar el modelo.");
    } finally {
      setTraining(false);
    }
  };

  if (loading) {
    return <div className="text-slate-300">Cargando estado del modelo de IA...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!status?.model_exists || !metadata) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <BrainCircuit className="w-6 h-6 text-cyan-400" />
            <h1 className="text-3xl text-white">Estado del modelo de IA</h1>
          </div>
          <p className="text-slate-400">
            Todavía no se encontró un modelo baseline entrenado o no existe metadata disponible.
          </p>
        </div>
      </div>
    );
  }

  const metrics = metadata.metrics;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <BrainCircuit className="w-6 h-6 text-cyan-400" />
              <h1 className="text-3xl text-white">Estado del modelo de IA</h1>
              <span className="px-3 py-1 rounded-lg border border-green-500/20 bg-green-500/10 text-green-300 text-sm">
                Modelo activo
              </span>
              <span className="px-3 py-1 rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-300 text-sm">
                Ganador: {metadata.model_type}
              </span>
            </div>

            <p className="text-slate-300 text-lg">
              Variante activa: <span className="text-white">{humanizeVariant(metadata.training_variant)}</span>
            </p>

            <p className="text-slate-400 mt-2 max-w-3xl">
              Este panel resume el modelo activo, la competencia entre candidatos, la calidad del dataset
              depurado, el readiness del entrenamiento y la evidencia histórica del desempeño de las asignaciones.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => loadAll(true)} disabled={refreshing} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-all disabled:opacity-60" >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Actualizando..." : "Actualizar"}
            </button>

            <button onClick={handleRetrain} disabled={training} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20 transition-all disabled:opacity-60" >
              <Sparkles className={`w-4 h-4 ${training ? "animate-pulse" : ""}`} />
              {training ? "Reentrenando..." : "Competir y reentrenar"}
            </button>
          </div>
        </div>

        {trainingMessage && (
          <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
            {trainingMessage}
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <h2 className="text-2xl text-white">Resumen ejecutivo automático</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className={`rounded-xl border p-4 ${getLevelClasses(executiveSummary.overallLevel)}`}>
            <p className="text-xs mb-1 opacity-80">Veredicto general</p>
            <p className="text-2xl font-semibold">
              {humanizeExecutiveLevel(executiveSummary.overallLevel)}
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${getLevelClasses(executiveSummary.readinessLevel)}`}>
            <p className="text-xs mb-1 opacity-80">Readiness</p>
            <p className="text-2xl font-semibold">
              {humanizeExecutiveLevel(executiveSummary.readinessLevel)}
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${getLevelClasses(executiveSummary.modelLevel)}`}>
            <p className="text-xs mb-1 opacity-80">Modelo</p>
            <p className="text-2xl font-semibold">
              {humanizeExecutiveLevel(executiveSummary.modelLevel)}
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${getLevelClasses(executiveSummary.evidenceLevel)}`}>
            <p className="text-xs mb-1 opacity-80">Evidencia</p>
            <p className="text-2xl font-semibold">
              {humanizeExecutiveLevel(executiveSummary.evidenceLevel)}
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${getLevelClasses(executiveSummary.dataQualityLevel)}`}>
            <p className="text-xs mb-1 opacity-80">Calidad de datos</p>
            <p className="text-2xl font-semibold">
              {humanizeExecutiveLevel(executiveSummary.dataQualityLevel)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
          <p className="text-slate-200 leading-relaxed">{executiveSummary.verdict}</p>

          <div className="mt-4 space-y-2">
            {executiveSummary.findings.map((finding) => (
              <p key={finding} className="text-slate-400 text-sm">
                • {finding}
              </p>
            ))}
          </div>
        </div>
      </div>

      {candidateModels.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl text-white">Competencia de modelos</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {candidateModels.map((candidate: any, index: number) => (
              <div key={candidate.model_name} className={`rounded-xl border p-5 ${ index === 0 ? "border-yellow-500/20 bg-yellow-500/10" : "border-slate-800 bg-slate-950/40" }`} >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white text-lg font-semibold">{candidate.model_name}</p>
                  {index === 0 && (
                    <span className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-sm">
                      Ganador
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Selection score</p>
                    <p className="text-white">{formatValue(candidate.selection_score)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">ROC AUC</p>
                    <p className="text-white">{formatPercent(candidate.metrics?.roc_auc)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">F1</p>
                    <p className="text-white">{formatPercent(candidate.metrics?.f1)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
                    <p className="text-slate-400 text-xs mb-1">Balanced Acc.</p>
                    <p className="text-white">{formatPercent(candidate.metrics?.balanced_accuracy)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modelReadiness && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <h2 className="text-xl text-white">Readiness del modelo activo</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Banda de confianza</p>
              <p className="text-white text-lg font-semibold capitalize">
                {modelReadiness.confidence_band}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Uso recomendado</p>
              <p className="text-white text-lg font-semibold">
                {modelReadiness.recommended_usage}
              </p>
            </div>
          </div>
        </div>
      )}

      {effectiveness && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl text-white">Evidencia histórica de asignaciones</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Registros con outcome</p>
              <p className="text-white text-2xl">{effectiveness.total_records_with_outcome}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Éxito promedio IA</p>
              <p className="text-white text-2xl">
                {formatValue(effectiveness.average_success_score_ai)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Brecha IA vs no IA</p>
              <p className="text-white text-2xl">{formatValue(effectiveness.ai_vs_non_ai_gap)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-300 mb-3">Desglose por fuente</p>
              <div className="space-y-3">
                {effectiveness.source_breakdown.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4" >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-white font-medium">
                        {humanizeBreakdownLabel(item.label)}
                      </p>
                      <span className="text-slate-300 text-sm">{item.count} registros</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-slate-400 text-xs">Éxito promedio</p>
                        <p className="text-white">{formatValue(item.average_success_score)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">A tiempo</p>
                        <p className="text-white">{formatPlainPercent(item.on_time_rate)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Retrabajo</p>
                        <p className="text-white">{formatPlainPercent(item.rework_rate)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Calidad promedio</p>
                        <p className="text-white">{formatValue(item.average_quality_score)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-300 mb-3">Desglose por estrategia</p>
              <div className="space-y-3">
                {effectiveness.strategy_breakdown.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4" >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-white font-medium">
                        {humanizeBreakdownLabel(item.label)}
                      </p>
                      <span className="text-slate-300 text-sm">{item.count} registros</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-slate-400 text-xs">Éxito promedio</p>
                        <p className="text-white">{formatValue(item.average_success_score)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">A tiempo</p>
                        <p className="text-white">{formatPlainPercent(item.on_time_rate)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Retrabajo</p>
                        <p className="text-white">{formatPlainPercent(item.rework_rate)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Calidad promedio</p>
                        <p className="text-white">{formatValue(item.average_quality_score)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-slate-300">Accuracy</span>
          </div>
          <p className="text-3xl text-white">{formatPercent(metrics.accuracy)}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span className="text-slate-300">F1 Score</span>
          </div>
          <p className="text-3xl text-white">{formatPercent(metrics.f1)}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <span className="text-slate-300">ROC AUC</span>
          </div>
          <p className="text-3xl text-white">{formatPercent(metrics.roc_auc)}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Database className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-300">Filas del dataset</span>
          </div>
          <p className="text-3xl text-white">{metadata.dataset_rows}</p>
        </div>
      </div>

      {classBalance && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl text-white">Balance de clases</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Clase negativa</p>
              <p className="text-white text-2xl">{classBalance.negative_count}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Clase positiva</p>
              <p className="text-white text-2xl">{classBalance.positive_count}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Minority ratio</p>
              <p className="text-white text-2xl">
                {formatPlainPercent(classBalance.minority_ratio_percent)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Evaluación</p>
              <p className="text-white text-2xl capitalize">{classBalance.assessment}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Resumen del entrenamiento</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Modelo ganador</p>
                <p className="text-white">{metadata.model_type}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Variable objetivo</p>
                <p className="text-white">{metadata.target}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Origen del entrenamiento</p>
                <p className="text-white">{humanizeTrainingSource(metadata.training_source)}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Variante</p>
                <p className="text-white">{humanizeVariant(metadata.training_variant)}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Filas de entrenamiento</p>
                <p className="text-white">{metadata.train_rows}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Filas de prueba</p>
                <p className="text-white">{metadata.test_rows}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Semilla aleatoria</p>
                <p className="text-white">{metadata.random_state}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Tamaño de prueba</p>
                <p className="text-white">{formatPercent(metadata.test_size)}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Layers3 className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl text-white">Variables activas del modelo</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-slate-300 mb-3">Variables numéricas</p>
                <div className="flex flex-wrap gap-2">
                  {metadata.numeric_features.map((feature) => (
                    <span key={feature} className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm" >
                      {humanizeFeatureName(`num__${feature}`)}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-slate-300 mb-3">Variables categóricas</p>
                <div className="flex flex-wrap gap-2">
                  {metadata.categorical_features.map((feature) => (
                    <span key={feature} className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm" >
                      {feature === "strategy"
                        ? "Estrategia"
                        : feature === "priority_snapshot"
                        ? "Prioridad"
                        : feature === "source"
                        ? "Origen"
                        : feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-green-400" />
              <h2 className="text-xl text-white">Importancia de variables</h2>
            </div>

            <div className="space-y-3">
              {metadata.top_coefficients.map((item: any) => (
                <div key={item.feature} className="p-4 rounded-lg bg-slate-800/40 border border-slate-700" >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-white">{humanizeFeatureName(item.feature)}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400">
                        Peso: <span className="text-slate-200">{formatValue(item.coefficient)}</span>
                      </span>
                      <span className="text-slate-400">
                        Abs.: <span className="text-slate-200">{formatValue(item.absolute_weight)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              <h2 className="text-xl text-white">Etiqueta objetivo</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Clase 0</p>
                <p className="text-white">{distribution.negative} registros</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Clase 1</p>
                <p className="text-white">{distribution.positive} registros</p>
              </div>
            </div>
          </div>

          {cleanPreview && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl text-white">Calidad del dataset limpio</h2>
              </div>

              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Filas crudas</p>
                  <p className="text-white">{cleanPreview.raw_total_rows}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Filas limpias</p>
                  <p className="text-white">{cleanPreview.clean_total_rows}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Filas excluidas</p>
                  <p className="text-white">{cleanPreview.excluded_rows}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Balance del dataset</p>
                  <p className="text-white capitalize">
                    {cleanPreview.class_balance?.assessment || "No definido"}
                  </p>
                </div>
              </div>

              {Object.entries(cleanPreview.excluded_by_reason ?? {}).length > 0 && (
                <div className="mt-5">
                  <p className="text-slate-300 mb-3">Motivos de exclusión</p>
                  <div className="space-y-2">
                    {Object.entries(cleanPreview.excluded_by_reason).map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3" >
                        <span className="text-slate-300 text-sm">{humanizeReason(reason)}</span>
                        <span className="text-slate-400 text-sm">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {report && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl text-white">Proveniencia y cobertura</h2>
              </div>

              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Skills con fuente</p>
                  <p className="text-white">
                    {report.skills_catalog.skills_with_source} / {report.skills_catalog.total_skills}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Tareas con skills requeridas</p>
                  <p className="text-white">
                    {report.tasks.tasks_with_required_skills} / {report.tasks.total_tasks}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Assignment history</p>
                  <p className="text-white">{report.recommendation_flow.total_assignment_history}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}