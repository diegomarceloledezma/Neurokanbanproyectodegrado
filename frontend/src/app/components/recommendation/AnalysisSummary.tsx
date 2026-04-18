import { BrainCircuit, CheckCircle, Sparkles, TrendingUp } from "lucide-react";

type AnalysisSummaryProps = {
  currentStrategyLabel: string;
  recommendationsCount: number;
  simulationsCount: number;
  urgencyLabel: string;
  modeLabel: string;
  modelActive: boolean;
};

export default function AnalysisSummary({
  currentStrategyLabel,
  recommendationsCount,
  simulationsCount,
  urgencyLabel,
  modeLabel,
  modelActive,
}: AnalysisSummaryProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-xl text-white mb-4">Resumen del análisis</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <p className="text-cyan-400 text-sm">Estrategia actual</p>
          </div>
          <p className="text-white">{currentStrategyLabel}</p>
        </div>

        <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="w-4 h-4 text-purple-400" />
            <p className="text-purple-400 text-sm">Modo de análisis</p>
          </div>
          <p className="text-white">{modeLabel}</p>
        </div>

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <p className="text-emerald-400 text-sm">Recomendados</p>
          </div>
          <p className="text-white">{recommendationsCount} integrantes</p>
        </div>

        <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <p className="text-sky-400 text-sm">Simulación</p>
          </div>
          <p className="text-white">{simulationsCount} escenarios</p>
        </div>

        <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-green-400" />
            <p className="text-green-400 text-sm">Modelo activo</p>
          </div>
          <p className="text-white">{modelActive ? "Sí" : "No"}</p>
          <p className="text-slate-400 text-xs mt-1">{urgencyLabel}</p>
        </div>
      </div>
    </div>
  );
}
