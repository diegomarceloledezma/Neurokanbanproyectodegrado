import { BarChart3, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { teamMembers, tasks } from "../data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

export default function TeamMetrics() {
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const delayedTasks = tasks.filter(t => 
    new Date(t.deadline) < new Date() && t.status !== 'completed'
  ).length;

  // Workload data for chart
  const workloadData = teamMembers.map((m, index) => ({
    id: m.id,
    name: m.name.split(' ')[0],
    carga: m.currentLoad,
    tareas: m.activeTasks,
  }));

  // Performance data
  const performanceData = teamMembers.map((m, index) => ({
    id: m.id,
    name: m.name.split(' ')[0],
    cumplimiento: m.completionRate,
  }));

  // Tasks by status
  const tasksByStatus = [
    { id: 'pending', name: 'Pendiente', value: tasks.filter(t => t.status === 'pending').length },
    { id: 'in-progress', name: 'En Progreso', value: tasks.filter(t => t.status === 'in-progress').length },
    { id: 'in-review', name: 'En Revisión', value: tasks.filter(t => t.status === 'in-review').length },
    { id: 'completed', name: 'Completadas', value: tasks.filter(t => t.status === 'completed').length },
  ];

  // Time comparison data (estimated vs actual)
  const timeComparisonData = tasks
    .filter(t => t.actualHours && t.estimatedHours)
    .map(t => ({
      id: t.id,
      name: t.title.slice(0, 20) + '...',
      estimado: t.estimatedHours,
      real: t.actualHours,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Métricas del Equipo</h1>
        <p className="text-slate-400">Análisis de rendimiento y carga de trabajo</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-3xl text-white">{completedTasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas Completadas</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-red-500" />
            </div>
            <span className="text-3xl text-white">{delayedTasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas Retrasadas</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-cyan-500" />
            </div>
            <span className="text-3xl text-white">
              {Math.round(teamMembers.reduce((acc, m) => acc + m.completionRate, 0) / teamMembers.length)}%
            </span>
          </div>
          <h3 className="text-slate-400 text-sm">Tasa de Cumplimiento</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-3xl text-white">{tasks.length}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Total de Tareas</h3>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Carga de Trabajo por Integrante</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workloadData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="carga" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Rendimiento por Integrante</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="cumplimiento" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Distribución de Tareas</h2>
          <div className="space-y-4">
            {tasksByStatus.map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">{item.name}</span>
                  <span className="text-white">{item.value}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item.name === 'Completadas'
                        ? 'bg-green-500'
                        : item.name === 'En Progreso'
                        ? 'bg-cyan-500'
                        : item.name === 'En Revisión'
                        ? 'bg-purple-500'
                        : 'bg-slate-600'
                    }`}
                    style={{ width: `${(item.value / tasks.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Member Cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Resumen del Equipo</h2>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-white">{member.name}</p>
                      <p className="text-slate-400 text-xs">{member.activeTasks} tareas activas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`${
                      member.currentLoad > 70
                        ? 'text-red-400'
                        : member.currentLoad > 50
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}>
                      {member.currentLoad}%
                    </p>
                    <p className="text-slate-500 text-xs">carga</p>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      member.currentLoad > 70
                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                        : member.currentLoad > 50
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : 'bg-gradient-to-r from-cyan-500 to-purple-600'
                    }`}
                    style={{ width: `${member.currentLoad}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time Comparison Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Comparación: Tiempo Estimado vs Tiempo Real</h2>
        {timeComparisonData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Bar dataKey="estimado" fill="#06b6d4" name="Estimado (hrs)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="real" fill="#a855f7" name="Real (hrs)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] bg-slate-800/30 rounded-lg">
            <p className="text-slate-500">No hay datos de comparación disponibles aún</p>
          </div>
        )}
      </div>
    </div>
  );
}