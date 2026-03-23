import { Brain, CheckCircle, Layers3, Lightbulb } from "lucide-react";
import type { TaskInsightResponse } from "../../services/recommendationService";

type TaskInsightsPanelProps = {
  insightData: TaskInsightResponse | null;
  selectedStrategy: string;
  onApplySuggestedStrategy: () => void;
};

const confidenceStyles: Record<string, string> = {
  alta: "text-green-300 bg-green-500/10 border-green-500/20",
  media: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
  baja: "text-red-300 bg-red-500/10 border-red-500/20",
};

export default function TaskInsightsPanel({
  insightData,
  selectedStrategy,
  onApplySuggestedStrategy,
}: TaskInsightsPanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Brain className="w-5 h-5 text-cyan-400" />
        <div>
          <h2 className="text-xl text-white">Asistente inteligente de la tarea</h2>
          <p className="text-slate-400 text-sm">
            Interpreta la tarea y sugiere un enfoque de asignación antes de decidir.
          </p>
        </div>
      </div>

      {insightData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-cyan-400" />
                <p className="text-cyan-400 text-sm">Estrategia sugerida</p>
              </div>
              <p className="text-white">{insightData.suggested_strategy_label}</p>
            </div>

            <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Layers3 className="w-4 h-4 text-purple-400" />
                <p className="text-purple-400 text-sm">Área sugerida</p>
              </div>
              <p className="text-white">{insightData.suggested_area}</p>
            </div>

            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-emerald-400 text-sm">Confianza</p>
              </div>
              <span
                className={`inline-block px-2 py-1 text-sm rounded border ${
                  confidenceStyles[insightData.confidence_level] ??
                  "text-slate-300 bg-slate-800 border-slate-700"
                }`}
              >
                {insightData.confidence_level}
              </span>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-700 rounded-lg">
              <p className="text-slate-400 text-sm mb-2">Acción recomendada</p>
              <button
                onClick={onApplySuggestedStrategy}
                disabled={selectedStrategy === insightData.suggested_strategy}
                className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {selectedStrategy === insightData.suggested_strategy
                  ? "Estrategia ya aplicada"
                  : `Usar ${insightData.suggested_strategy_label}`}
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-300 text-sm">{insightData.explanation}</p>
          </div>

          <div>
            <h3 className="text-white mb-3">Habilidades sugeridas</h3>
            <div className="flex flex-wrap gap-2">
              {insightData.suggested_skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 rounded-full text-sm bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white mb-3">Señales detectadas</h3>
            <ul className="space-y-2">
              {insightData.detected_signals.map((signal, index) => (
                <li
                  key={`${signal}-${index}`}
                  className="text-slate-300 text-sm bg-slate-800/40 rounded-lg px-4 py-3"
                >
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-6 text-slate-400">
          No se pudo cargar el asistente inteligente.
        </div>
      )}
    </div>
  );
}