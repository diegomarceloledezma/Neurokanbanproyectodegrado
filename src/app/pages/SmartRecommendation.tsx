import { useParams, useNavigate } from "react-router";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, User } from "lucide-react";
import { tasks, getRecommendations } from "../data/mockData";

export default function SmartRecommendation() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const task = tasks.find(t => t.id === taskId);
  const recommendations = getRecommendations(taskId || '');

  if (!task) {
    return (
      <div className="text-white">
        <p>Tarea no encontrada</p>
      </div>
    );
  }

  const riskColors = {
    low: 'text-green-400 bg-green-500/10 border-green-500/20',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    high: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  const riskLabels = {
    low: 'Riesgo Bajo',
    medium: 'Riesgo Medio',
    high: 'Riesgo Alto',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border border-cyan-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl text-white">Recomendación Inteligente</h1>
            <p className="text-cyan-300">Análisis impulsado por IA</p>
          </div>
        </div>
      </div>

      {/* Task Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Tarea Seleccionada</h2>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-white mb-2">{task.title}</h3>
          <p className="text-slate-400 text-sm mb-4">{task.description}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-500 text-xs mb-1">Prioridad</p>
              <p className="text-white text-sm capitalize">{task.priority}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Complejidad</p>
              <p className="text-white text-sm">{task.complexity}/10</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Tiempo Estimado</p>
              <p className="text-white text-sm">{task.estimatedHours}h</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Deadline</p>
              <p className="text-white text-sm">
                {new Date(task.deadline).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          {task.skills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-xs mb-2">Skills Requeridas</p>
              <div className="flex flex-wrap gap-2">
                {task.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded text-xs border border-cyan-500/20"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Análisis de la Tarea</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <p className="text-cyan-400 text-sm">Demanda de Skills</p>
            </div>
            <p className="text-white">Alta coincidencia en el equipo</p>
          </div>

          <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-purple-400" />
              <p className="text-purple-400 text-sm">Disponibilidad</p>
            </div>
            <p className="text-white">3 miembros disponibles</p>
          </div>

          <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-green-400" />
              <p className="text-green-400 text-sm">Urgencia</p>
            </div>
            <p className="text-white">
              {Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} días restantes
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-white">Top 3 Integrantes Recomendados</h2>
          <button
            onClick={() => navigate(`/task/${taskId}`)}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Asignación manual
          </button>
        </div>

        {recommendations.map((rec, index) => (
          <div
            key={rec.member.id}
            className={`bg-slate-900 border rounded-xl p-6 transition-all ${
              index === 0
                ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xl">
                    {rec.member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  {index === 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl text-white">{rec.member.name}</h3>
                    {index === 0 && (
                      <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded border border-cyan-500/30">
                        MEJOR MATCH
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{rec.member.role}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <div className="text-4xl bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                    {rec.score}%
                  </div>
                </div>
                <p className="text-slate-400 text-sm">Score de Compatibilidad</p>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
              <p className="text-slate-300 text-sm">{rec.reason}</p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Disponibilidad</p>
                <p className="text-white">{rec.availability}</p>
              </div>

              <div className="p-3 bg-slate-800/30 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Carga Actual</p>
                <p className="text-white">{rec.currentLoad}</p>
              </div>

              <div className="p-3 bg-slate-800/30 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Nivel de Riesgo</p>
                <span className={`inline-block text-sm px-2 py-1 rounded border ${riskColors[rec.riskLevel]}`}>
                  {riskLabels[rec.riskLevel]}
                </span>
              </div>

              <div className="p-3 bg-slate-800/30 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Tareas Activas</p>
                <p className="text-white">{rec.member.activeTasks} tareas</p>
              </div>
            </div>

            {/* Matching Skills */}
            {rec.matchingSkills.length > 0 && (
              <div className="mb-4">
                <p className="text-slate-400 text-xs mb-2">Habilidades Coincidentes</p>
                <div className="flex flex-wrap gap-2">
                  {rec.matchingSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs border border-green-500/20"
                    >
                      ✓ {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={() => {
                navigate(`/task/${taskId}`);
              }}
              className={`w-full py-3 rounded-lg transition-all ${
                index === 0
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              Asignar a {rec.member.name.split(' ')[0]}
            </button>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-cyan-400 mt-1" />
          <div>
            <h3 className="text-white mb-2">Sobre las Recomendaciones</h3>
            <p className="text-slate-400 text-sm">
              El sistema analiza múltiples factores incluyendo: habilidades técnicas, experiencia previa, 
              carga de trabajo actual, disponibilidad, rendimiento histórico y complejidad de la tarea 
              para generar estas recomendaciones. El score de compatibilidad se calcula mediante un 
              algoritmo de machine learning entrenado con datos históricos del equipo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
