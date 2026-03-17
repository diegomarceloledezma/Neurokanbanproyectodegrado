import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Clock, Users, TrendingUp, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { tasks, teamMembers } from "../data/mockData";
import { getCurrentUser, type UserResponse } from "../services/authService";
import { clearSession, getAccessToken } from "../services/sessionService";

export default function Dashboard() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const loadSession = async () => {
      const token = getAccessToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const user = await getCurrentUser(token);
        setCurrentUser(user);
      } catch (error) {
        clearSession();
        setSessionError("Tu sesión expiró o no es válida. Inicia sesión nuevamente.");
        navigate("/login");
      } finally {
        setSessionLoading(false);
      }
    };

    loadSession();
  }, [navigate]);

  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const overdueTasks = tasks.filter((t) => new Date(t.deadline) < new Date() && t.status !== "completed").length;
  const teamLoad = Math.round(teamMembers.reduce((acc, m) => acc + m.currentLoad, 0) / teamMembers.length);

  const recentRecommendations = [
    {
      id: "rec-1",
      task: "Preparar propuesta de presentación institucional",
      recommendation: "Laura Soto (91% de compatibilidad)",
      status: "Asignado",
    },
    {
      id: "rec-2",
      task: "Organizar cronograma de actividades del equipo",
      recommendation: "Carlos Mendoza (89% de compatibilidad)",
      status: "Pendiente",
    },
    {
      id: "rec-3",
      task: "Diseñar material de apoyo para la reunión",
      recommendation: "Ana García (87% de compatibilidad)",
      status: "Pendiente",
    },
  ];

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="nk-dashboard-page space-y-6">
      <div className="nk-page-header">
        <h1 className="nk-page-title text-3xl text-white mb-2">Dashboard</h1>
        <p className="nk-page-subtitle text-slate-400">
          Resumen general del equipo, tareas y recomendaciones recientes
        </p>
      </div>

      {currentUser && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white text-lg mb-1">
            Hola, {currentUser.full_name}
          </h2>
          <p className="text-slate-400 text-sm">
            Usuario: {currentUser.username} · Rol:{" "}
            {currentUser.global_role?.name ?? "Sin rol"}
          </p>
        </div>
      )}

      {sessionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {sessionError}
        </div>
      )}

      <div className="nk-stats-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="nk-stat-card nk-stat-card--pending bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all" data-stat-type="pending-tasks">
          <div className="nk-stat-card__inner flex items-center justify-between mb-4">
            <div className="nk-stat-card__icon-wrapper p-3 bg-yellow-500/10 rounded-lg">
              <Clock className="nk-stat-card__icon w-6 h-6 text-yellow-500" />
            </div>
            <span className="nk-stat-card__value text-2xl text-white" data-value={pendingTasks}>
              {pendingTasks}
            </span>
          </div>
          <h3 className="nk-stat-card__label text-slate-400 text-sm">Tareas pendientes</h3>
        </div>

        <div className="nk-stat-card nk-stat-card--in-progress bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all" data-stat-type="in-progress-tasks">
          <div className="nk-stat-card__inner flex items-center justify-between mb-4">
            <div className="nk-stat-card__icon-wrapper p-3 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="nk-stat-card__icon w-6 h-6 text-cyan-500" />
            </div>
            <span className="nk-stat-card__value text-2xl text-white" data-value={inProgressTasks}>
              {inProgressTasks}
            </span>
          </div>
          <h3 className="nk-stat-card__label text-slate-400 text-sm">En progreso</h3>
        </div>

        <div className="nk-stat-card nk-stat-card--overdue bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all" data-stat-type="overdue-tasks">
          <div className="nk-stat-card__inner flex items-center justify-between mb-4">
            <div className="nk-stat-card__icon-wrapper p-3 bg-red-500/10 rounded-lg">
              <AlertCircle className="nk-stat-card__icon w-6 h-6 text-red-500" />
            </div>
            <span className="nk-stat-card__value text-2xl text-white" data-value={overdueTasks}>
              {overdueTasks}
            </span>
          </div>
          <h3 className="nk-stat-card__label text-slate-400 text-sm">Tareas vencidas</h3>
        </div>

        <div className="nk-stat-card nk-stat-card--team-load bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all" data-stat-type="team-load">
          <div className="nk-stat-card__inner flex items-center justify-between mb-4">
            <div className="nk-stat-card__icon-wrapper p-3 bg-purple-500/10 rounded-lg">
              <Users className="nk-stat-card__icon w-6 h-6 text-purple-500" />
            </div>
            <span className="nk-stat-card__value text-2xl text-white" data-value={teamLoad}>
              {teamLoad}%
            </span>
          </div>
          <h3 className="nk-stat-card__label text-slate-400 text-sm">Carga del equipo</h3>
        </div>
      </div>

      <div className="nk-dashboard-content grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nk-recommendations-section bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="nk-section-header flex items-center gap-3 mb-6">
            <div className="nk-section-icon-wrapper p-2 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg">
              <Sparkles className="nk-section-icon w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="nk-section-title text-xl text-white">Recomendaciones recientes</h2>
          </div>

          <div className="nk-recommendations-list space-y-4">
            {recentRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="nk-recommendation-item p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all cursor-pointer"
                onClick={() => navigate("/recommendation/task-2")}
                data-recommendation-id={rec.id}
              >
                <div className="nk-recommendation-item__header flex items-start justify-between mb-2">
                  <h3 className="nk-recommendation-item__task text-white text-sm">{rec.task}</h3>
                  <span
                    className={`nk-recommendation-item__status text-xs px-2 py-1 rounded ${
                      rec.status === "Asignado"
                        ? "nk-status--assigned bg-green-500/10 text-green-400"
                        : "nk-status--pending bg-yellow-500/10 text-yellow-400"
                    }`}
                    data-status={rec.status}
                  >
                    {rec.status}
                  </span>
                </div>
                <p className="nk-recommendation-item__member text-cyan-400 text-sm">
                  {rec.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="nk-team-metrics-section bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="nk-section-header flex items-center gap-3 mb-6">
            <div className="nk-section-icon-wrapper p-2 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg">
              <CheckCircle className="nk-section-icon w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="nk-section-title text-xl text-white">Métricas del equipo</h2>
          </div>

          <div className="nk-team-members-list space-y-5">
            {teamMembers.slice(0, 4).map((member) => (
              <div key={member.id} className="nk-team-member-item" data-member-id={member.id}>
                <div className="nk-team-member-item__header flex items-center justify-between mb-2">
                  <div className="nk-team-member-item__info flex items-center gap-3">
                    <div className="nk-avatar w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                      {member.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="nk-team-member-item__name text-white text-sm">{member.name}</p>
                      <p className="nk-team-member-item__tasks text-slate-500 text-xs" data-active-tasks={member.activeTasks}>
                        {member.activeTasks} tareas activas
                      </p>
                    </div>
                  </div>
                  <span className="nk-team-member-item__load-value text-slate-300 text-sm" data-load={member.currentLoad}>
                    {member.currentLoad}%
                  </span>
                </div>
                <div className="nk-progress-bar w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`nk-progress-bar__fill h-2 rounded-full ${
                      member.currentLoad > 70
                        ? "nk-progress-bar__fill--high bg-gradient-to-r from-red-500 to-orange-500"
                        : member.currentLoad > 50
                        ? "nk-progress-bar__fill--medium bg-gradient-to-r from-yellow-500 to-orange-500"
                        : "nk-progress-bar__fill--low bg-gradient-to-r from-cyan-500 to-purple-600"
                    }`}
                    style={{ width: `${member.currentLoad}%` }}
                    data-progress={member.currentLoad}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/metrics")}
            className="nk-button nk-button--secondary w-full mt-6 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm"
          >
            Ver todas las métricas
          </button>
        </div>
      </div>
    </div>
  );
}