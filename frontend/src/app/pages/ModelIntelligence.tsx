import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  Layers3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  getMlBaselineStatus,
  type BaselineMetadata,
  type BaselineStatusResponse,
} from "../services/mlBaselineService";
import { getAccessToken } from "../services/sessionService";

function formatPercent(value?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatValue(value?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(4);
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

function labelDistributionSummary(metadata: BaselineMetadata | null) {
  if (!metadata) return { negative: 0, positive: 0 };

  return {
    negative: metadata.label_distribution?.["0"] ?? 0,
    positive: metadata.label_distribution?.["1"] ?? 0,
  };
}

export default function ModelIntelligence() {
  const token = getAccessToken();

  const [status, setStatus] = useState<BaselineStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const metadata = status?.metadata ?? null;

  const distribution = useMemo(() => labelDistributionSummary(metadata), [metadata]);

  const loadStatus = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");
      const result = await getMlBaselineStatus(token || undefined);
      setStatus(result);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo cargar el estado del modelo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus(false);
  }, []);

  if (loading) {
    return <div className="text-slate-300">Cargando estado del modelo de IA...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
        {error}
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
            </div>

            <p className="text-slate-300 text-lg">
              Variante activa:{" "}
              <span className="text-white">{humanizeVariant(metadata.training_variant)}</span>
            </p>

            <p className="text-slate-400 mt-2 max-w-3xl">
              Este panel resume la versión actualmente activa del baseline de éxito de asignación,
              sus métricas de evaluación, el tamaño del dataset utilizado y las variables más
              influyentes en el entrenamiento.
            </p>
          </div>

          <button
            onClick={() => loadStatus(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

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
            <Gauge className="w-5 h-5 text-cyan-400" />
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Resumen del entrenamiento</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Tipo de modelo</p>
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
                    <span
                      key={feature}
                      className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-slate-300 mb-3">Variables categóricas</p>
                <div className="flex flex-wrap gap-2">
                  {metadata.categorical_features.map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-green-400" />
              <h2 className="text-xl text-white">Coeficientes principales</h2>
            </div>

            <div className="space-y-3">
              {metadata.top_coefficients.map((item) => (
                <div
                  key={item.feature}
                  className="p-4 rounded-lg bg-slate-800/40 border border-slate-700"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-white">{item.feature}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400">
                        Coeficiente: <span className="text-slate-200">{formatValue(item.coefficient)}</span>
                      </span>
                      <span className="text-slate-400">
                        Peso abs.: <span className="text-slate-200">{formatValue(item.absolute_weight)}</span>
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
              <h2 className="text-xl text-white">Distribución de clases</h2>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Casos clase 0</p>
                <p className="text-white text-2xl">{distribution.negative}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Casos clase 1</p>
                <p className="text-white text-2xl">{distribution.positive}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Métricas detalladas</h2>

            <div className="space-y-3 text-sm">
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Accuracy</p>
                <p className="text-white">{formatPercent(metrics.accuracy)}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Precision</p>
                <p className="text-white">{formatPercent(metrics.precision)}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">Recall</p>
                <p className="text-white">{formatPercent(metrics.recall)}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">F1 Score</p>
                <p className="text-white">{formatPercent(metrics.f1)}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-slate-400 text-xs mb-1">ROC AUC</p>
                <p className="text-white">{formatPercent(metrics.roc_auc)}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-3">Estado interpretado</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              El sistema está usando actualmente un baseline compacto depurado, entrenado con
              histórico interno limpio. Esta versión prioriza interpretabilidad y estabilidad
              sobre complejidad excesiva del modelo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}