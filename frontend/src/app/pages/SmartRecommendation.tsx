import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, User } from "lucide-react";
import { getTaskById, assignTask, type TaskResponse } from "../services/taskService";
import {
  getTaskRecommendations,
  type TaskRecommendationResponse,
  type TaskRecommendationItem,
} from "../services/recommendationService";
import { getAccessToken, getStoredUser } from "../services/sessionService";

const strategyOptions = [
  { value: "balance", label: "Balance" },
  { value: "efficiency", label: "Eficiencia" },
  { value: "urgency", label: "Urgencia" },
  { value: "learning", label: "Aprendizaje" },
];

export default function SmartRecommendation() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [recommendationData, setRecommendationData] =
    useState<TaskRecommendationResponse | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState("balance");
  const [loading, setLoading] = useState(true);
  const [reloadingRecommendations, setReloadingRecommendations] = useState(false);
  const [assigningMemberId, setAssigningMemberId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTask = async () => {
      if (!taskId) {
        setError("No se encontró el identificador de la tarea");
        setLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const taskData = await getTaskById(taskId, token);
        setTask(taskData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("Ocurrió un error al cargar la tarea");
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [taskId, navigate]);

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!taskId) return;

      const token = getAccessToken();
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setReloadingRecommendations(true);
        const recommendations = await getTaskRecommendations(taskId, token, selectedStrategy);
        setRecommendationData(recommendations);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("Ocurrió un error al cargar la recomendación");
      } finally {
        setReloadingRecommendations(false);
      }
    };

    loadRecommendations();
  }, [taskId, selectedStrategy, navigate]);

  const handleAssign = async (rec: TaskRecommendationItem) => {
    if (!taskId || !recommendationData) return;

    const token = getAccessToken();
    const currentUser = getStoredUser();

    if (!token || !currentUser) {
      navigate("/login");
      return;
    }

    setError("");
    setAssigningMemberId(rec.member.id);

    try {
      await assignTask(
        taskId,
        {
          assigned_to: rec.member.id,
          assigned_by: currentUser.id,
          source: "recommendation",
          strategy: recommendationData.strategy,
          recommendation_score: rec.score,
          risk_level: rec.risk_level,
          reason: rec.reason,
        },
        token
      );

      navigate(`/task/${taskId}`);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo asignar la tarea");
    } finally {
      setAssigningMemberId(null);
    }
  };

  const riskColors: Record<string, string> = {
    low: "text-green-400 bg-green-500/10 border-green-500/20",
    medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    high: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const riskLabels: Record<string, string> = {
    low: "Riesgo bajo",
    medium: "Riesgo medio",
    high: "Riesgo alto",
  };

  const priorityLabels: Record<string, string> = {
    low: "Baja",
    medium: "Media",
    high: "Alta",
    critical: "Crítica",
  };

  const roleLabels: Record<string, string> = {
    leader: "Líder de equipo",
    member: "Integrante del equipo",
    admin: "Administrador",
  };

  const strategyDescriptions: Record<string, string> = {
    balance: "Busca equilibrio entre carga, disponibilidad y desempeño.",
    efficiency: "Prioriza el mejor rendimiento disponible para ejecutar la tarea.",
    urgency: "Favorece rapidez de respuesta y menor saturación.",
    learning: "Promueve desarrollo del equipo con riesgo controlado.",
  };

  const daysRemaining = (dueDate?: string | null) => {
    if (!dueDate) return "Sin fecha límite";
    const diff = new Date(dueDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Fecha vencida";
    return `${days} días restantes`;
  };

  if (loading) {
    return <div className="text-slate-300">Cargando recomendación...</div>;
  }

  if (error && (!task || !recommendationData)) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        No se pudo cargar la tarea
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border border-cyan-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl text-white">Recomendación inteligente</h1>
            <p className="text-cyan-300">
              Análisis automático para apoyar la asignación de la tarea
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Tarea seleccionada</h2>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-white mb-2">{task.title}</h3>
          <p className="text-slate-400 text-sm mb-4">
            {task.description || "Esta tarea no tiene descripción registrada."}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-500 text-xs mb-1">Prioridad</p>
              <p className="text-white text-sm">
                {priorityLabels[task.priority] ?? task.priority}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Complejidad</p>
              <p className="text-white text-sm">{task.complexity}/5</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Tiempo estimado</p>
              <p className="text-white text-sm">
                {task.estimated_hours ? `${task.estimated_hours}h` : "No definido"}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Fecha límite</p>
              <p className="text-white text-sm">{daysRemaining(task.due_date)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:justify-between">
          <div>
            <h2 className="text-xl text-white mb-2">Estrategia de asignación</h2>
            <p className="text-slate-400 text-sm">
              Elige el enfoque con el que quieres calcular la recomendación.
            </p>
          </div>

          <div className="min-w-[240px]">
            <label className="block text-sm text-slate-300 mb-2">Estrategia</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            >
              {strategyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-slate-300 text-sm">
            {strategyDescriptions[selectedStrategy]}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Resumen del análisis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <p className="text-cyan-400 text-sm">Estrategia actual</p>
            </div>
            <p className="text-white capitalize">
              {recommendationData?.strategy ?? selectedStrategy}
            </p>
          </div>

          <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-purple-400" />
              <p className="text-purple-400 text-sm">Integrantes evaluados</p>
            </div>
            <p className="text-white">
              {recommendationData?.recommendations.length ?? 0} recomendados
            </p>
          </div>

          <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-green-400" />
              <p className="text-green-400 text-sm">Urgencia</p>
            </div>
            <p className="text-white">{daysRemaining(task.due_date)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-white">Top 3 integrantes recomendados</h2>
          {reloadingRecommendations && (
            <span className="text-sm text-slate-400">Actualizando recomendaciones...</span>
          )}
        </div>

        {recommendationData?.recommendations.map((rec, index) => (
          <div
            key={rec.member.id}
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
                        MEJOR MATCH
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
                <p className="text-slate-400 text-sm">Score de compatibilidad</p>
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
                onClick={() => handleAssign(rec)}
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
                onClick={() => navigate(`/member/${rec.member.id}`)}
                className="px-4 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
              >
                Ver perfil
              </button>
            </div>
          </div>
        )) ?? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-6 text-slate-400">
            No hay recomendaciones disponibles.
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-cyan-400 mt-1" />
          <div>
            <h3 className="text-white mb-2">Sobre esta recomendación</h3>
            <p className="text-slate-400 text-sm">
              Esta versión permite elegir distintas estrategias de asignación para priorizar equilibrio,
              eficiencia, urgencia o aprendizaje. En siguientes fases se incorporarán habilidades reales,
              simulación de escenarios, trazabilidad más rica y alertas de desbalance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}