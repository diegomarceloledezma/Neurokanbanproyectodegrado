import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Clock, CheckCircle } from "lucide-react";
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
import { getAccessToken } from "../services/sessionService";
import {
  getDashboardTeamMetrics,
  type DashboardTeamMetricsResponse,
} from "../services/dashboardService";

const roleLabels: Record<string, string> = {
  leader: "Líder de equipo",
  member: "Integrante del equipo",
  admin: "Administrador",
};

export default function TeamMetrics() {
  const [metrics, setMetrics] = useState<DashboardTeamMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMetrics = async () => {
      const token = getAccessToken();
      if (!token) {
        setError("No hay sesión activa.");
        setLoading(false);
        return;
      }

      try {
        const data = await getDashboardTeamMetrics(token);
        setMetrics(data);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudieron cargar las métricas.");
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, []);

  const safePercentage = (value: number) => {
    if (!metrics || !metrics.total_tasks) return 0;
    return (value / metrics.total_tasks) * 100;
  };

  if (loading) {
    return <div className="text-slate-300">Cargando métricas del equipo...</div>;
  }

  if (error || !metrics) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error || "No se pudieron cargar las métricas del equipo."}
      </div>
    );
  }

  const workloadData = metrics.workload_data.map((item) => ({
    id: item.id,
    name: item.name,
    carga: item.primary_value,
    tareas: item.secondary_value ?? 0,
  }));

  const performanceData = metrics.performance_data.map((item) => ({
    id: item.id,
    name: item.name,
    cumplimiento: item.primary_value,
  }));

  const timeComparisonData = metrics.time_comparison_data.map((item) => ({
    id: item.id,
    name: item.name,
    estimado: item.primary_value,
    real: item.secondary_value ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Métricas del equipo</h1>
        <p className="text-slate-400">
          Vista analítica del rendimiento y la distribución real del trabajo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-3xl text-white">{metrics.completed_tasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas completadas</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-red-500" />
            </div>
            <span className="text-3xl text-white">{metrics.delayed_tasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas retrasadas</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-cyan-500" />
            </div>
            <span className="text-3xl text-white">{Math.round(metrics.average_completion_rate)}%</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tasa de cumplimiento</h3>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-3xl text-white">{metrics.total_tasks}</span>
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
            {metrics.tasks_by_status.map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">{item.name}</span>
                  <span className="text-white">{item.value}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item.id === "done"
                        ? "bg-green-500"
                        : item.id === "in_progress"
                        ? "bg-cyan-500"
                        : item.id === "review"
                        ? "bg-purple-500"
                        : item.id === "blocked"
                        ? "bg-red-500"
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
            {metrics.team_members.map((member) => (
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
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-white">{member.name}</p>
                      <p className="text-slate-400 text-xs">
                        {roleLabels[member.role_name] ?? member.role_name} · {member.active_tasks} tareas activas
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`${
                        member.current_load > 70
                          ? "text-red-400"
                          : member.current_load > 50
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {member.current_load}%
                    </p>
                    <p className="text-slate-500 text-xs">carga</p>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      member.current_load > 70
                        ? "bg-gradient-to-r from-red-500 to-orange-500"
                        : member.current_load > 50
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                        : "bg-gradient-to-r from-cyan-500 to-purple-600"
                    }`}
                    style={{ width: `${member.current_load}%` }}
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