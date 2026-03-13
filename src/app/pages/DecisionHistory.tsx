import { CheckCircle, XCircle, Clock, Sparkles, User } from "lucide-react";
import { decisionHistory } from "../data/mockData";

export default function DecisionHistory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Historial de Decisiones</h1>
        <p className="text-slate-400">Seguimiento de asignaciones y resultados</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-cyan-500" />
            </div>
            <span className="text-3xl text-white">{decisionHistory.length}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Total de Decisiones</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-3xl text-white">
              {decisionHistory.filter(d => d.completedOnTime).length}
            </span>
          </div>
          <h3 className="text-slate-400 text-sm">Completadas a Tiempo</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <User className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-3xl text-white">
              {Math.round((decisionHistory.filter(d => d.systemRecommendation.id === d.leaderChoice.id).length / decisionHistory.length) * 100)}%
            </span>
          </div>
          <h3 className="text-slate-400 text-sm">Siguió la Recomendación</h3>
        </div>
      </div>

      {/* Decision Records */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="text-left p-4 text-slate-300 text-sm">Tarea</th>
                <th className="text-left p-4 text-slate-300 text-sm">Recomendación del Sistema</th>
                <th className="text-left p-4 text-slate-300 text-sm">Elección del Líder</th>
                <th className="text-left p-4 text-slate-300 text-sm">Resultado</th>
                <th className="text-left p-4 text-slate-300 text-sm">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {decisionHistory.map((record) => (
                <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div>
                      <p className="text-white mb-1">{record.task.title}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          record.task.priority === 'critical'
                            ? 'bg-red-500/10 text-red-400'
                            : record.task.priority === 'high'
                            ? 'bg-orange-500/10 text-orange-400'
                            : record.task.priority === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {record.task.priority === 'critical' ? 'Crítica' : 
                           record.task.priority === 'high' ? 'Alta' : 
                           record.task.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                        <span className="text-slate-500 text-xs">
                          Complejidad: {record.task.complexity}/10
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                        {record.systemRecommendation.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-white text-sm">{record.systemRecommendation.name}</p>
                        <p className="text-slate-500 text-xs">{record.systemRecommendation.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                        {record.leaderChoice.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-white text-sm">{record.leaderChoice.name}</p>
                        {record.systemRecommendation.id === record.leaderChoice.id && (
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            <span className="text-cyan-400 text-xs">Siguió recomendación</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {record.completedOnTime ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-green-400 text-sm">A tiempo</p>
                            {record.task.actualHours && record.task.estimatedHours && (
                              <p className="text-slate-500 text-xs">
                                {record.task.actualHours}h / {record.task.estimatedHours}h
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-400" />
                          <p className="text-red-400 text-sm">Retrasado</p>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">
                        {new Date(record.timestamp).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {decisionHistory.length === 0 && (
          <div className="flex items-center justify-center p-12 bg-slate-800/30">
            <p className="text-slate-500">No hay decisiones registradas aún</p>
          </div>
        )}
      </div>

      {/* Detailed Records */}
      <div className="space-y-4">
        <h2 className="text-xl text-white">Detalles y Observaciones</h2>
        {decisionHistory.map((record) => (
          <div key={record.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-white text-lg mb-1">{record.task.title}</h3>
                <p className="text-slate-400 text-sm">
                  {new Date(record.timestamp).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {record.completedOnTime ? (
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-sm border border-green-500/20">
                    ✓ Completada a tiempo
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/20">
                    ✗ Tiempo excedido
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-2">Recomendación del Sistema</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm">
                    {record.systemRecommendation.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-white">{record.systemRecommendation.name}</p>
                    <p className="text-slate-400 text-sm">{record.systemRecommendation.role}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-2">Elección del Líder</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm">
                    {record.leaderChoice.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-white">{record.leaderChoice.name}</p>
                    <p className="text-slate-400 text-sm">{record.leaderChoice.role}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-slate-400 text-xs mb-2">Observaciones</p>
              <p className="text-slate-300 text-sm">{record.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
