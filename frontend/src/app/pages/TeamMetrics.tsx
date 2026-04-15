import { BarChart3, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { teamMembers, tasks } from "../data/mockData";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function TeamMetrics() {
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const delayedTasks = tasks.filter(
    (task) => new Date(task.deadline) < new Date() && task.status !== "completed"
  ).length;

  const workloadData = teamMembers.map((member) => ({
    id: member.id,
    name: member.name.split(" ")[0],
    carga: member.currentLoad,
    tareas: member.activeTasks,
  }));

  const performanceData = teamMembers.map((member) => ({
    id: member.id,
    name: member.name.split(" ")[0],
    cumplimiento: member.completionRate,
  }));

  const tasksByStatus = [
    { id: "pending", name: "Pendientes", value: tasks.filter((task) => task.status === "pending").length },
    { id: "in-progress", name: "En progreso", value: tasks.filter((task) => task.status === "in-progress").length },
    { id: "in-review", name: "En revisión", value: tasks.filter((task) => task.status === "in-review").length },
    { id: "completed", name: "Completadas", value: tasks.filter((task) => task.status === "completed").length },
  ];

  const timeComparisonData = tasks
    .filter((task) => task.actualHours && task.estimatedHours)
    .map((task) => ({
      id: task.id,
      name: `${task.title.slice(0, 20)}...`,
      estimado: task.estimatedHours,
      real: task.actualHours,
    }));

  const averageCompletionRate = teamMembers.length
    ? Math.round(teamMembers.reduce((acc, member) => acc + member.completionRate, 0) / teamMembers.length)
    : 0;

  const safePercentage = (value: number) => {
    if (!tasks.length) return 0;
    return (value / tasks.length) * 100;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Métricas del equipo</h1>
        <p className="text-slate-400">Vista analítica del rendimiento y la distribución de trabajo</p>
        <p className="text-slate-500 text-sm mt-2">
          Esta vista todavía utiliza datos de demostración mientras completamos la integración total con el backend.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-3xl text-white">{completedTasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas completadas</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-red-500" />
            </div>
            <span className="text-3xl text-white">{delayedTasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas retrasadas</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-cyan-500" />
            </div>
            <span className="text-3xl text-white">{averageCompletionRate}%</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tasa de cumplimiento</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-3xl text-white">{tasks.length}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Total de tareas</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Carga de trabajo por integrante</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workloadData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
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

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Rendimiento por integrante</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="cumplimiento" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Distribución de tareas</h2>
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
                      item.name === "Completadas"
                        ? "bg-green-500"
                        : item.name === "En progreso"
                        ? "bg-cyan-500"
                        : item.name === "En revisión"
                        ? "bg-purple-500"
                        : "bg-slate-600"
                    }`}
                    style={{ width: `${safePercentage(item.value)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl text-white mb-4">Resumen del equipo</h2>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-white">{member.name}</p>
                      <p className="text-slate-400 text-xs">{member.activeTasks} tareas activas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`${
                        member.currentLoad > 70
                          ? "text-red-400"
                          : member.currentLoad > 50
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {member.currentLoad}%
                    </p>
                    <p className="text-slate-500 text-xs">carga</p>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      member.currentLoad > 70
                        ? "bg-gradient-to-r from-red-500 to-orange-500"
                        : member.currentLoad > 50
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                        : "bg-gradient-to-r from-cyan-500 to-purple-600"
                    }`}
                    style={{ width: `${member.currentLoad}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Comparación entre tiempo estimado y tiempo real</h2>
        {timeComparisonData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Legend />
              <Bar dataKey="estimado" fill="#06b6d4" name="Estimado (h)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="real" fill="#a855f7" name="Real (h)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] bg-slate-800/30 rounded-lg">
            <p className="text-slate-500">Todavía no hay datos de comparación disponibles</p>
          </div>
        )}
      </div>
    </div>
  );
}