import type { TaskSimulationItem } from "../../services/recommendationService";

type SimulationCardProps = {
  simulation: TaskSimulationItem;
  index: number;
  roleLabels: Record<string, string>;
  riskColors: Record<string, string>;
  riskLabels: Record<string, string>;
  formatPercent: (value: number) => string;
  getLoadChangeLabel: (simulation: TaskSimulationItem) => string;
  getActiveTasksChangeLabel: (simulation: TaskSimulationItem) => string;
};

export default function SimulationCard({
  simulation,
  index,
  roleLabels,
  riskColors,
  riskLabels,
  formatPercent,
  getLoadChangeLabel,
  getActiveTasksChangeLabel,
}: SimulationCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        index === 0
          ? "border-cyan-500/40 bg-cyan-500/5"
          : "border-slate-800 bg-slate-800/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h3 className="text-white text-lg">
              #{simulation.rank} {simulation.member.full_name}
            </h3>
            {simulation.rank === 1 && (
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded border border-cyan-500/30">
                ESCENARIO RECOMENDADO
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">
            {roleLabels[simulation.member.role_name] ?? simulation.member.role_name}
          </p>
        </div>

        <div className="text-right">
          <p className="text-slate-400 text-sm">Puntaje simulado</p>
          <p className="text-2xl text-white">{simulation.score}%</p>
        </div>
      </div>

      <div className="mb-4 p-4 bg-slate-900/50 rounded-lg">
        <p className="text-slate-300 text-sm">{simulation.reason}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Carga actual</p>
          <p className="text-white">{formatPercent(simulation.current_load)}</p>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Carga proyectada</p>
          <p className="text-white">{formatPercent(simulation.projected_load)}</p>
          <p className="text-cyan-300 text-xs mt-1">
            Impacto: {getLoadChangeLabel(simulation)}
          </p>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Disponibilidad actual</p>
          <p className="text-white">{formatPercent(simulation.current_availability)}</p>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Disponibilidad proyectada</p>
          <p className="text-white">{formatPercent(simulation.projected_availability)}</p>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Tareas activas actuales</p>
          <p className="text-white">{simulation.current_active_tasks}</p>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Tareas activas proyectadas</p>
          <p className="text-white">{simulation.projected_active_tasks}</p>
          <p className="text-cyan-300 text-xs mt-1">
            Impacto: {getActiveTasksChangeLabel(simulation)}
          </p>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Riesgo simulado</p>
          <span
            className={`inline-block text-sm px-2 py-1 rounded border ${
              riskColors[simulation.risk_level]
            }`}
          >
            {riskLabels[simulation.risk_level]}
          </span>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-lg">
          <p className="text-slate-400 text-xs mb-1">Impacto estimado de horas</p>
          <p className="text-white">{simulation.estimated_hours_impact}h</p>
        </div>
      </div>
    </div>
  );
}