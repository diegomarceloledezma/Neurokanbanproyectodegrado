import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  GitCompareArrows,
  Layers3,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  getMlBaselineStatus,
  trainOptimizedBaseline,
  type BaselineMetadata,
  type BaselineStatusResponse,
} from "../services/mlBaselineService";
import {
  getCleanTrainingPreview,
  type CleanTrainingPreviewResponse,
} from "../services/trainingDataService";
import {
  getTrainingReadiness,
  type TrainingReadinessResponse,
} from "../services/dataProvenanceService";
import {
  getAssignmentEffectivenessSummary,
  type AssignmentEffectivenessSummaryResponse,
} from "../services/assignmentEffectivenessService";
import { getAccessToken } from "../services/sessionService";

type ExecutiveLevel = "alta" | "media" | "baja";

type ExtendedBaselineMetadata = BaselineMetadata & {
  selection_score?: number;
  cross_validation?: {
    folds: number;
    metrics_mean?: Record<string, number>;
    metrics_std?: Record<string, number>;
  };
  calibration_summary?: {
    brier_score?: number | null;
    expected_calibration_error?: number | null;
    buckets?: Array<{
      bucket: string;
      support: number;
      mean_predicted_probability: number;
      actual_positive_rate: number;
      absolute_gap: number;
    }>;
  };
  threshold_analysis?: {
    default_threshold: number;
    default_metrics?: Record<string, number>;
    best_f1_threshold?: number;
    best_f1_metrics?: Record<string, number>;
    best_balanced_threshold?: number;
    best_balanced_metrics?: Record<string, number>;
    grid?: Array<{
      threshold: number;
      metrics: Record<string, number>;
    }>;
  };
  segment_performance?: {
    by_strategy?: SegmentRow[];
    by_source?: SegmentRow[];
    by_task_type?: SegmentRow[];
  };
  evaluation_notes?: string[];
  candidate_models?: Array<{
    model_name: string;
    selection_score: number;
    metrics: Record<string, number>;
    cross_validation_mean?: Record<string, number>;
    brier_score?: number | null;
  }>;
  previous_active_selection_score?: number | null;
  previous_active_model_type?: string | null;
  previous_active_training_variant?: string | null;
  active_model_synced?: boolean;
  default_threshold_metrics?: Record<string, number>;
  operating_threshold?: number;
  thresholding_strategy?: string;
  probability_separation?: {
    positive_mean_probability?: number | null;
    negative_mean_probability?: number | null;
    separation_gap?: number | null;
    assessment?: string;
  };
  optimized_variant_candidates?: Array<{
    training_variant: string;
    model_type?: string;
    eligible: boolean;
    reason?: string | null;
    dataset_rows?: number;
    test_rows?: number;
    selection_score?: number;
    metrics?: Record<string, number>;
    cross_validation_mean?: Record<string, number>;
    operating_threshold?: number;
  }>;
  optimization_summary?: {
    selected_variant?: string;
    selected_model_type?: string;
    selected_selection_score?: number;
    evaluated_variants?: number;
    eligible_variants?: number;
    selection_criteria?: string;
  };
};

type SegmentRow = {
  label: string;
  support: number;
  positive_rate: number;
  metrics: Record<string, number>;
};

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatPlainPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function formatValue(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function humanizeVariant(variant?: string) {
  if (!variant) return "No definida";

  const map: Record<string, string> = {
    raw_history: "Histórico crudo",
    cleaned_history: "Histórico depurado",
    compact_cleaned_history: "Compacto depurado",
    trusted_source_aware_history: "Trusted source-aware",
    recalibrated_source_aware_history: "Recalibrado source-aware",
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
    historical_internal_data_trusted: "Histórico interno trusted",
    historical_internal_data_recalibrated: "Histórico interno recalibrado",
    database_training_history: "Historial desde base de datos",
  };

  return map[source] ?? source;
}

function humanizeReadiness(level?: string) {
  const map: Record<string, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  };

  return map[level || ""] ?? level ?? "No definida";
}

function humanizeReason(reason: string) {
  const map: Record<string, string> = {
    uncertain_success_band: "Zona ambigua de éxito",
    weak_backfill_signal: "Señal débil de backfill",
    no_required_skills: "Sin habilidades requeridas",
    invalid_matching_ratio: "Matching ratio inválido",
    invalid_complexity: "Complejidad inválida",
    backfill_low_skill_fit: "Backfill con bajo ajuste técnico",
    backfill_low_decision_signal: "Backfill con baja señal de decisión",
    benchmark_low_skill_fit: "Benchmark con bajo ajuste técnico",
    benchmark_uncertain_success_band: "Benchmark en zona ambigua",
  };

  return map[reason] ?? reason;
}

function humanizeEvaluationNote(note: string) {
  const normalized = note.toLowerCase();

  if (normalized.includes("validación cruzada") && normalized.includes("holdout")) {
    return "La validación cruzada es más conservadora que el holdout. Esto no invalida el modelo; indica que el sistema está midiendo estabilidad y que el modelo debe usarse como apoyo supervisado a la decisión.";
  }

  return note;
}

function buildModelDefenseNotes(
  metadata: ExtendedBaselineMetadata | null,
  notes: string[]
): string[] {
  if (!metadata) return [];

  const defenseNotes = [
    "Modelo apto para apoyo a decisión supervisada: recomienda, compara y explica, pero la asignación final sigue siendo decisión del líder.",
    "La evaluación combina holdout, validación cruzada, calibración, threshold tuning y análisis por segmentos para evitar una lectura basada en una sola métrica.",
  ];

  if ((metadata.metrics?.roc_auc ?? 0) >= 0.82) {
    defenseNotes.push(
      `El ROC AUC de ${formatPercent(
        metadata.metrics?.roc_auc
      )} muestra buena capacidad para separar asignaciones con mayor probabilidad de éxito frente a casos de riesgo.`
    );
  }

  if ((metadata.probability_separation?.separation_gap ?? 0) >= 0.25) {
    defenseNotes.push(
      `La separación probabilística es clara: la brecha entre éxitos y riesgos es de ${formatPercent(
        metadata.probability_separation?.separation_gap
      )}.`
    );
  }

  for (const note of notes) {
    defenseNotes.push(humanizeEvaluationNote(note));
  }

  return Array.from(new Set(defenseNotes));
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

function evaluateModelLevel(metadata: ExtendedBaselineMetadata | null): ExecutiveLevel {
  if (!metadata) return "baja";

  const accuracy = metadata.metrics?.accuracy ?? 0;
  const f1 = metadata.metrics?.f1 ?? 0;
  const rocAuc = metadata.metrics?.roc_auc ?? 0;
  const cvRocAuc = metadata.cross_validation?.metrics_mean?.roc_auc ?? 0;
  const brier = metadata.calibration_summary?.brier_score ?? 1;

  let score = 0;

  if (accuracy >= 0.74) score += 2;
  else if (accuracy >= 0.68) score += 1;

  if (f1 >= 0.70) score += 2;
  else if (f1 >= 0.62) score += 1;

  if (rocAuc >= 0.82) score += 2;
  else if (rocAuc >= 0.76) score += 1;

  if (cvRocAuc >= 0.78) score += 1;
  if (brier <= 0.22) score += 1;

  if (score >= 6) return "alta";
  if (score >= 3) return "media";
  return "baja";
}

function evaluateReadinessLevel(
  readiness: TrainingReadinessResponse | null
): ExecutiveLevel {
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

function evaluateDataQualityLevel(
  cleanPreview: CleanTrainingPreviewResponse | null
): ExecutiveLevel {
  if (!cleanPreview || cleanPreview.raw_total_rows <= 0) return "baja";

  const cleanRate = (cleanPreview.clean_total_rows / cleanPreview.raw_total_rows) * 100;

  if (cleanRate >= 70) return "alta";
  if (cleanRate >= 55) return "media";
  return "baja";
}

function buildExecutiveSummary(params: {
  metadata: ExtendedBaselineMetadata | null;
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

  if (metadata) {
    findings.push(
      `El campeón activo usa ${metadata.model_type} con variante ${humanizeVariant(
        metadata.training_variant
      ).toLowerCase()}.`
    );
    findings.push(
      `Holdout: ROC AUC ${formatPercent(metadata.metrics?.roc_auc)}, F1 ${formatPercent(
        metadata.metrics?.f1
      )} y balanced accuracy ${formatPercent(metadata.metrics?.balanced_accuracy)}.`
    );

    const cvRocAuc = metadata.cross_validation?.metrics_mean?.roc_auc;
    if (cvRocAuc !== undefined) {
      findings.push(`Validación cruzada: ROC AUC promedio ${formatPercent(cvRocAuc)}.`);
    }

    const brier = metadata.calibration_summary?.brier_score;
    if (brier !== undefined && brier !== null) {
      findings.push(`Calibración: Brier Score ${formatValue(brier, 4)}.`);
    }
  }

  if (readiness) {
    findings.push(
      `Readiness del entrenamiento: ${readiness.readiness_score.toFixed(
        2
      )}, nivel ${humanizeReadiness(readiness.readiness_level).toLowerCase()}.`
    );
  }

  if (effectiveness) {
    findings.push(
      `Existen ${effectiveness.total_records_with_outcome} asignaciones con outcome para respaldo histórico.`
    );
  }

  if (cleanPreview) {
    findings.push(
      `El dataset limpio conserva ${cleanPreview.clean_total_rows} filas a partir de ${cleanPreview.raw_total_rows} crudas.`
    );
  }

  let verdict =
    "El modelo ya es defendible, pero todavía conviene seguir fortaleciendo estabilidad, calibración y cobertura segmentada.";

  if (overallLevel === "alta") {
    verdict =
      "El módulo de IA ya se ve serio y defendible: tiene evidencia histórica, métricas buenas, validación robusta y lectura ejecutiva clara.";
  } else if (overallLevel === "media") {
    verdict =
      "El modelo es defendible y útil para apoyo a decisión, aunque todavía hay margen de mejora en estabilidad y cobertura por segmentos.";
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

function summaryLabelValue(label: string, value: string, tone = "text-white") {
  return (
    <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-lg ${tone}`}>{value}</p>
    </div>
  );
}

function SegmentTable({
  title,
  rows,
}: {
  title: string;
  rows: SegmentRow[] | undefined;
}) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <GitCompareArrows className="w-5 h-5 text-cyan-400" />
        <h2 className="text-xl text-white">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left py-3 pr-4">Segmento</th>
              <th className="text-left py-3 pr-4">Soporte</th>
              <th className="text-left py-3 pr-4">Accuracy</th>
              <th className="text-left py-3 pr-4">Balanced</th>
              <th className="text-left py-3 pr-4">F1</th>
              <th className="text-left py-3 pr-4">ROC AUC</th>
              <th className="text-left py-3">Tasa positiva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate-800/60 text-slate-200">
                <td className="py-3 pr-4">{row.label}</td>
                <td className="py-3 pr-4">{row.support}</td>
                <td className="py-3 pr-4">{formatPercent(row.metrics?.accuracy)}</td>
                <td className="py-3 pr-4">{formatPercent(row.metrics?.balanced_accuracy)}</td>
                <td className="py-3 pr-4">{formatPercent(row.metrics?.f1)}</td>
                <td className="py-3 pr-4">{formatPercent(row.metrics?.roc_auc)}</td>
                <td className="py-3">{formatPercent(row.positive_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ModelIntelligence() {
  const token = getAccessToken();

  const [status, setStatus] = useState<BaselineStatusResponse | null>(null);
  const [cleanPreview, setCleanPreview] = useState<CleanTrainingPreviewResponse | null>(null);
  const [readiness, setReadiness] = useState<TrainingReadinessResponse | null>(null);
  const [effectiveness, setEffectiveness] =
    useState<AssignmentEffectivenessSummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState("");
  const [trainingMessage, setTrainingMessage] = useState("");

  const metadata = (status?.metadata ?? null) as ExtendedBaselineMetadata | null;

  const executiveSummary = useMemo(() => {
    return buildExecutiveSummary({
      metadata,
      readiness,
      effectiveness,
      cleanPreview,
    });
  }, [metadata, readiness, effectiveness, cleanPreview]);

  const loadAll = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      const [statusResult, previewResult, readinessResult, effectivenessResult] =
        await Promise.all([
          getMlBaselineStatus(token || undefined),
          getCleanTrainingPreview(20, token || undefined),
          getTrainingReadiness(token || undefined),
          getAssignmentEffectivenessSummary(token || undefined),
        ]);

      setStatus(statusResult);
      setCleanPreview(previewResult);
      setReadiness(readinessResult);
      setEffectiveness(effectivenessResult);
    } catch (err) {
      console.error(err);
      setError("No fue posible cargar la inteligencia del modelo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleTrain = async () => {
    try {
      setTraining(true);
      setTrainingMessage("");
      setError("");

      const result = await trainOptimizedBaseline(token || undefined);
      const resultMetadata = result as ExtendedBaselineMetadata;

      setTrainingMessage(
        `Entrenamiento optimizado finalizado. Campeón: ${
          resultMetadata.model_type
        } · variante ${humanizeVariant(resultMetadata.training_variant)} · ROC AUC ${formatPercent(
          resultMetadata.metrics?.roc_auc
        )}`
      );

      await loadAll(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo entrenar la IA optimizada.");
    } finally {
      setTraining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-300">
        Cargando inteligencia del modelo...
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <BrainCircuit className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-2xl text-white mb-3">Modelo IA</h1>
          <p className="text-slate-400 mb-6">
            Todavía no existe un baseline activo guardado.
          </p>

          <button onClick={handleTrain} disabled={training} className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition disabled:opacity-60" >
            <Sparkles className="w-4 h-4" />
            {training ? "Entrenando..." : "Entrenar IA optimizada"}
          </button>
        </div>
      </div>
    );
  }

  const metrics = (metadata.metrics ?? {
    accuracy: 0,
    balanced_accuracy: 0,
    precision: 0,
    recall: 0,
    f1: 0,
    roc_auc: 0,
  }) as {
    accuracy: number;
    balanced_accuracy?: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
  };
  const cvMean: Record<string, number> = metadata.cross_validation?.metrics_mean ?? {};
  const cvStd: Record<string, number> = metadata.cross_validation?.metrics_std ?? {};
  const calibration = metadata.calibration_summary;
  const thresholdAnalysis = metadata.threshold_analysis;
  const candidates = metadata.candidate_models ?? [];
  const optimizedVariants = metadata.optimized_variant_candidates ?? [];
  const notes = metadata.evaluation_notes ?? [];
  const presentationNotes = buildModelDefenseNotes(metadata, notes);

  const isActiveChampionSynced =
    metadata.active_model_synced ??
    (metadata.current_active_selection_score === metadata.selection_score &&
      metadata.current_active_model_type === metadata.model_type &&
      metadata.current_active_training_variant === metadata.training_variant);

  const previousActiveScore = metadata.previous_active_selection_score ?? null;
  const currentSelectionScore = metadata.selection_score ?? null;
  const selectionDelta =
    previousActiveScore !== null && currentSelectionScore !== null
      ? currentSelectionScore - previousActiveScore
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Modelo IA</h1>
          <p className="text-slate-400">
            Evaluación robusta, calibración y segmentación del campeón activo.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => loadAll(true)} disabled={refreshing} className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-200 disabled:opacity-60" >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </button>

          <button onClick={handleTrain} disabled={training} className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition disabled:opacity-60" >
            <Sparkles className="w-4 h-4" />
            {training ? "Optimizando..." : "Entrenar IA optimizada"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
          {error}
        </div>
      )}

      {trainingMessage && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300">
          {trainingMessage}
        </div>
      )}

      <div className={`p-4 rounded-lg border ${ isActiveChampionSynced ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-300" }`} >
        {isActiveChampionSynced ? (
          <div className="space-y-1">
            <p className="font-medium">Campeón activo sincronizado correctamente.</p>
            <p className="text-sm">
              La metadata mostrada corresponde al modelo actualmente guardado como campeón.
            </p>
            {selectionDelta !== null && (
              <p className="text-sm">
                Variación frente al campeón anterior:{" "}
                <span className="font-semibold">
                  {selectionDelta >= 0 ? "+" : ""}
                  {selectionDelta.toFixed(4)}
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-medium">La corrida actual no reemplazó al campeón activo.</p>
            <p className="text-sm">
              Se muestra la comparación entre el candidato evaluado y el campeón anterior.
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-green-400" />
          <h2 className="text-xl text-white">Resumen ejecutivo</h2>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {[
            {
              label: "Nivel global",
              value: humanizeExecutiveLevel(executiveSummary.overallLevel),
              level: executiveSummary.overallLevel,
            },
            {
              label: "Modelo",
              value: humanizeExecutiveLevel(executiveSummary.modelLevel),
              level: executiveSummary.modelLevel,
            },
            {
              label: "Readiness",
              value: humanizeExecutiveLevel(executiveSummary.readinessLevel),
              level: executiveSummary.readinessLevel,
            },
            {
              label: "Evidencia histórica",
              value: humanizeExecutiveLevel(executiveSummary.evidenceLevel),
              level: executiveSummary.evidenceLevel,
            },
            {
              label: "Calidad de datos",
              value: humanizeExecutiveLevel(executiveSummary.dataQualityLevel),
              level: executiveSummary.dataQualityLevel,
            },
          ].map((item) => (
            <div key={item.label} className={`px-3 py-2 rounded-lg border text-sm ${getLevelClasses(item.level)}`} >
              {item.label}: <span className="font-semibold">{item.value}</span>
            </div>
          ))}
        </div>

        <p className="text-slate-200 leading-relaxed mb-4">{executiveSummary.verdict}</p>

        <div className="space-y-2">
          {executiveSummary.findings.map((finding) => (
            <p key={finding} className="text-slate-300 text-sm">
              • {finding}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-6 gap-4">
        {summaryLabelValue("Modelo ganador", metadata.model_type)}
        {summaryLabelValue("Variante activa", humanizeVariant(metadata.training_variant))}
        {summaryLabelValue(
          "Umbral operativo",
          metadata.operating_threshold !== undefined ? String(metadata.operating_threshold) : "—"
        )}
        {summaryLabelValue(
          "Readiness oficial",
          humanizeReadiness(metadata.model_readiness?.confidence_band),
          metadata.model_readiness?.confidence_band === "alta"
            ? "text-green-300"
            : metadata.model_readiness?.confidence_band === "media"
            ? "text-yellow-300"
            : "text-red-300"
        )}
        {summaryLabelValue(
          "Score activo",
          formatValue(metadata.current_active_selection_score, 4)
        )}
        {summaryLabelValue(
          "Score previo",
          formatValue(metadata.previous_active_selection_score, 4)
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl text-white">Métricas holdout</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryLabelValue("Accuracy", formatPercent(metrics.accuracy))}
            {summaryLabelValue("Balanced accuracy", formatPercent(metrics.balanced_accuracy))}
            {summaryLabelValue("Precision", formatPercent(metrics.precision))}
            {summaryLabelValue("Recall", formatPercent(metrics.recall))}
            {summaryLabelValue("F1 Score", formatPercent(metrics.f1))}
            {summaryLabelValue("ROC AUC", formatPercent(metrics.roc_auc))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl text-white">Validación cruzada</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryLabelValue("Folds", String(metadata.cross_validation?.folds ?? 0))}
            {summaryLabelValue("CV ROC AUC", formatPercent(cvMean.roc_auc))}
            {summaryLabelValue("CV F1", formatPercent(cvMean.f1))}
            {summaryLabelValue("CV Balanced", formatPercent(cvMean.balanced_accuracy))}
            {summaryLabelValue("Desv. F1", formatPlainPercent((cvStd.f1 ?? 0) * 100))}
            {summaryLabelValue("Desv. ROC AUC", formatPlainPercent((cvStd.roc_auc ?? 0) * 100))}
          </div>
        </div>
      </div>

      {metadata.probability_separation && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <GitCompareArrows className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl text-white">Separación probabilística</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Mide si el modelo asigna probabilidades más altas a casos exitosos que a casos de riesgo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {summaryLabelValue(
              "Media en éxitos",
              formatPercent(metadata.probability_separation.positive_mean_probability)
            )}
            {summaryLabelValue(
              "Media en riesgos",
              formatPercent(metadata.probability_separation.negative_mean_probability)
            )}
            {summaryLabelValue(
              "Brecha",
              formatPercent(metadata.probability_separation.separation_gap)
            )}
            {summaryLabelValue(
              "Evaluación",
              humanizeReadiness(metadata.probability_separation.assessment)
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gauge className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl text-white">Calibración probabilística</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {summaryLabelValue("Brier Score", formatValue(calibration?.brier_score, 4))}
            {summaryLabelValue(
              "Expected Calibration Error",
              formatValue(calibration?.expected_calibration_error, 4)
            )}
          </div>

          {calibration?.buckets && calibration.buckets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-3 pr-4">Bucket</th>
                    <th className="text-left py-3 pr-4">Soporte</th>
                    <th className="text-left py-3 pr-4">Predicho</th>
                    <th className="text-left py-3 pr-4">Real</th>
                    <th className="text-left py-3">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.buckets.map((bucket) => (
                    <tr key={bucket.bucket} className="border-b border-slate-800/60 text-slate-200">
                      <td className="py-3 pr-4">{bucket.bucket}</td>
                      <td className="py-3 pr-4">{bucket.support}</td>
                      <td className="py-3 pr-4">
                        {formatPercent(bucket.mean_predicted_probability)}
                      </td>
                      <td className="py-3 pr-4">
                        {formatPercent(bucket.actual_positive_rate)}
                      </td>
                      <td className="py-3">
                        {formatPercent(bucket.absolute_gap)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h2 className="text-xl text-white">Threshold tuning</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summaryLabelValue(
                "Threshold por defecto",
                String(thresholdAnalysis?.default_threshold ?? 0.5)
              )}
              {summaryLabelValue(
                "Mejor threshold F1",
                String(thresholdAnalysis?.best_f1_threshold ?? "—")
              )}
              {summaryLabelValue(
                "Mejor threshold Balanced",
                String(thresholdAnalysis?.best_balanced_threshold ?? "—")
              )}
              {summaryLabelValue(
                "F1 con threshold F1",
                formatPercent(thresholdAnalysis?.best_f1_metrics?.f1)
              )}
            </div>

            {thresholdAnalysis?.grid && thresholdAnalysis.grid.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="text-left py-3 pr-4">Threshold</th>
                      <th className="text-left py-3 pr-4">Accuracy</th>
                      <th className="text-left py-3 pr-4">Balanced</th>
                      <th className="text-left py-3 pr-4">F1</th>
                      <th className="text-left py-3">ROC AUC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thresholdAnalysis.grid.map((item) => (
                      <tr key={item.threshold} className="border-b border-slate-800/60 text-slate-200">
                        <td className="py-3 pr-4">{item.threshold}</td>
                        <td className="py-3 pr-4">{formatPercent(item.metrics?.accuracy)}</td>
                        <td className="py-3 pr-4">
                          {formatPercent(item.metrics?.balanced_accuracy)}
                        </td>
                        <td className="py-3 pr-4">{formatPercent(item.metrics?.f1)}</td>
                        <td className="py-3">{formatPercent(item.metrics?.roc_auc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <SegmentTable title="Desempeño por estrategia" rows={metadata.segment_performance?.by_strategy} />
      <SegmentTable title="Desempeño por origen" rows={metadata.segment_performance?.by_source} />
      <SegmentTable title="Desempeño por tipo de tarea" rows={metadata.segment_performance?.by_task_type} />

      {optimizedVariants.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl text-white">Optimización de variantes</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Se compararon variantes del dataset y se promovió automáticamente la de mejor selection score.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-3 pr-4">Variante</th>
                  <th className="text-left py-3 pr-4">Modelo</th>
                  <th className="text-left py-3 pr-4">Filas</th>
                  <th className="text-left py-3 pr-4">Selection</th>
                  <th className="text-left py-3 pr-4">ROC AUC</th>
                  <th className="text-left py-3 pr-4">F1</th>
                  <th className="text-left py-3">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {optimizedVariants.map((variant) => (
                  <tr key={variant.training_variant} className="border-b border-slate-800/60 text-slate-200">
                    <td className="py-3 pr-4">{humanizeVariant(variant.training_variant)}</td>
                    <td className="py-3 pr-4">{variant.model_type ?? "—"}</td>
                    <td className="py-3 pr-4">{variant.dataset_rows ?? "—"}</td>
                    <td className="py-3 pr-4">{formatValue(variant.selection_score, 4)}</td>
                    <td className="py-3 pr-4">{formatPercent(variant.metrics?.roc_auc)}</td>
                    <td className="py-3 pr-4">{formatPercent(variant.metrics?.f1)}</td>
                    <td className="py-3">{variant.operating_threshold ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Layers3 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl text-white">Comparador de candidatos</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-3 pr-4">Modelo</th>
                  <th className="text-left py-3 pr-4">Selection</th>
                  <th className="text-left py-3 pr-4">ROC AUC</th>
                  <th className="text-left py-3 pr-4">F1</th>
                  <th className="text-left py-3 pr-4">CV ROC AUC</th>
                  <th className="text-left py-3">Brier</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.model_name} className="border-b border-slate-800/60 text-slate-200" >
                    <td className="py-3 pr-4">{candidate.model_name}</td>
                    <td className="py-3 pr-4">{formatValue(candidate.selection_score, 4)}</td>
                    <td className="py-3 pr-4">{formatPercent(candidate.metrics?.roc_auc)}</td>
                    <td className="py-3 pr-4">{formatPercent(candidate.metrics?.f1)}</td>
                    <td className="py-3 pr-4">
                      {formatPercent(candidate.cross_validation_mean?.roc_auc)}
                    </td>
                    <td className="py-3">{formatValue(candidate.brier_score, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {presentationNotes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl text-white">Lectura técnica para exposición</h2>
          </div>

          <p className="text-slate-400 text-sm mb-4">
            Esta sección resume cómo explicar el modelo sin que las observaciones técnicas se vean como errores del sistema.
          </p>

          <div className="space-y-2">
            {presentationNotes.map((note) => (
              <div key={note} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm leading-relaxed" >
                {note}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {cleanPreview && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Calidad del dataset limpio</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {summaryLabelValue("Filas crudas", String(cleanPreview.raw_total_rows))}
              {summaryLabelValue("Filas limpias", String(cleanPreview.clean_total_rows))}
              {summaryLabelValue("Excluidas", String(cleanPreview.excluded_rows))}
            </div>

            <div className="space-y-2">
              {Object.entries(cleanPreview.excluded_by_reason ?? {}).map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700" >
                  <span className="text-slate-300">{humanizeReason(reason)}</span>
                  <span className="text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {readiness && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <h2 className="text-xl text-white">Readiness del entrenamiento</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summaryLabelValue("Readiness score", formatValue(readiness.readiness_score))}
              {summaryLabelValue(
                "Readiness level",
                humanizeReadiness(readiness.readiness_level)
              )}
              {summaryLabelValue(
                "Cobertura de skills",
                formatPlainPercent(readiness.coverage.skills_source_coverage)
              )}
              {summaryLabelValue(
                "Cobertura task-skill",
                formatPlainPercent(readiness.coverage.task_skill_coverage)
              )}
              {summaryLabelValue(
                "Asignación con outcome",
                formatPlainPercent(
                  readiness.coverage.outcome_linked_assignment_coverage
                )
              )}
            </div>

            {readiness.observations.length > 0 && (
              <div className="mt-4 space-y-2">
                {readiness.observations.map((item) => (
                  <div key={item} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-slate-200 text-sm" >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {effectiveness && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl text-white">Evidencia histórica</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {summaryLabelValue(
              "Registros con outcome",
              String(effectiveness.total_records_with_outcome)
            )}
            {summaryLabelValue(
              "Promedio de éxito IA",
              formatValue(effectiveness.average_success_score_ai)
            )}
            {summaryLabelValue(
              "Promedio no IA",
              formatValue(effectiveness.average_success_score_non_ai)
            )}
            {summaryLabelValue(
              "Gap IA vs no IA",
              formatValue(effectiveness.ai_vs_non_ai_gap)
            )}
          </div>
        </div>
      )}
    </div>
  );
}