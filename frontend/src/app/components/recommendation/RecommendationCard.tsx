import { Sparkles } from "lucide-react";
import type { TaskRecommendationItem } from "../../services/recommendationService";

type RecommendationCardProps = {
  rec: TaskRecommendationItem;
  index: number;
  assigningMemberId: number | null;
  onAssign: (rec: TaskRecommendationItem) => void;
  onViewProfile: (memberId: number) => void;
  roleLabels: Record<string, string>;
  riskColors: Record<string, string>;
  riskLabels: Record<string, string>;
};

export default function RecommendationCard({
  rec,
  index,
  assigningMemberId,
  onAssign,
  onViewProfile,
  roleLabels,
  riskColors,
  riskLabels,
}: RecommendationCardProps) {
  return (
    <div
      className={`bg-slate-900 border rounded-xl p-6 transition-all ${
        index === 0
          ? "border-cyan-500/50 shadow-lg shadow-cyan-500/10"
          : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xl">
              {rec.member.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            {index === 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h3 className="text-xl text-white">{rec.member.full_name}</h3>
              {index === 0 && (
                <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded border border-cyan-500/30">
                  MEJOR COINCIDENCIA
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              {roleLabels[rec.member.role_name] ?? rec.member.role_name}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <div className="text-4xl bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              {rec.score}%
            </div>
          </div>
          <p className="text-slate-400 text-sm">Puntaje de compatibilidad</p>
        </div>
      </div>

      <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
        <p className="text-slate-300 text-sm">{rec.reason}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-slate-800/30 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Disponibilidad</p>
          <p className="text-white">{rec.availability}</p>
        </div>

        <div className="p-3 bg-slate-800/30 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Carga actual</p>
          <p className="text-white">{rec.current_load}</p>
        </div>

        <div className="p-3 bg-slate-800/30 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Nivel de riesgo</p>
          <span
            className={`inline-block text-sm px-2 py-1 rounded border ${
              riskColors[rec.risk_level]
            }`}
          >
            {riskLabels[rec.risk_level]}
          </span>
        </div>

        <div className="p-3 bg-slate-800/30 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Tareas activas</p>
          <p className="text-white">{rec.active_tasks} tareas</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => onAssign(rec)}
          disabled={assigningMemberId === rec.member.id}
          className={`flex-1 py-3 rounded-lg transition-all ${
            index === 0
              ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 shadow-lg shadow-cyan-500/20"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {assigningMemberId === rec.member.id
            ? "Asignando..."
            : `Asignar a ${rec.member.full_name.split(" ")[0]}`}
        </button>

        <button
          onClick={() => onViewProfile(rec.member.id)}
          className="px-4 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
        >
          Ver perfil
        </button>
      </div>
    </div>
  );
}