import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Clock, Users, TrendingUp, Sparkles, FolderKanban } from "lucide-react";
import { useNavigate } from "react-router";
import { tasks, teamMembers } from "../data/mockData";
import { getCurrentUser, type UserResponse } from "../services/authService";
import { clearSession, getAccessToken } from "../services/sessionService";
import { getProjects, type ProjectResponse } from "../services/projectService";

export default function Dashboard() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
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
        const [user, projectList] = await Promise.all([
          getCurrentUser(token),
          getProjects(token),
        ]);

        setCurrentUser(user);
        setProjects(projectList);
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
        <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
            <span className="text-2xl text-white">{pendingTasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas pendientes</h3>
        </div>

        <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-cyan-500" />
            </div>
            <span className="text-2xl text-white">{inProgressTasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">En progreso</h3>
        </div>

        <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <span className="text-2xl text-white">{overdueTasks}</span>
          </div>
          <h3 className="text-slate-400 text-sm">Tareas vencidas</h3>
        </div>

        <div className="nk-stat-card bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-2xl text-white">{teamLoad}%</span>
          </div>
          <h3 className="text-slate-400 text-sm">Carga del equipo</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg">
              <FolderKanban className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl text-white">Proyectos</h2>
          </div>

          {projects.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No hay proyectos registrados todavía.
            </p>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="text-white text-base">{project.name}</h3>
                      <p className="text-slate-400 text-sm">
                        {project.description || "Sin descripción"}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400">
                      {project.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-3">
                    <span>Área: {project.area?.name ?? "No definida"}</span>
                    <span>Responsable: {project.creator?.full_name ?? "No disponible"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl text-white">Recomendaciones recientes</h2>
          </div>

          <div className="space-y-4">
            {recentRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all cursor-pointer"
                onClick={() => navigate("/recommendation/task-2")}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white text-sm">{rec.task}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      rec.status === "Asignado"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
                <p className="text-cyan-400 text-sm">{rec.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg">
            <CheckCircle className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl text-white">Métricas del equipo</h2>
        </div>

        <div className="space-y-5">
          {teamMembers.slice(0, 4).map((member) => (
            <div key={member.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                    {member.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-white text-sm">{member.name}</p>
                    <p className="text-slate-500 text-xs">
                      {member.activeTasks} tareas activas
                    </p>
                  </div>
                </div>
                <span className="text-slate-300 text-sm">{member.currentLoad}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
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

        <button
          onClick={() => navigate("/metrics")}
          className="w-full mt-6 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm"
        >
          Ver todas las métricas
        </button>
      </div>
    </div>
  );
}