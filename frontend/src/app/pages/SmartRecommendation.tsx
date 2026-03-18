import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, User } from "lucide-react";
import { getTaskById, type TaskResponse } from "../services/taskService";
import {
  getTaskRecommendations,
  type TaskRecommendationResponse,
} from "../services/recommendationService";
import { getAccessToken } from "../services/sessionService";

export default function SmartRecommendation() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [recommendationData, setRecommendationData] =
    useState<TaskRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
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
        const [taskData, recommendations] = await Promise.all([
          getTaskById(taskId, token),
          getTaskRecommendations(taskId, token),
        ]);

        setTask(taskData);
        setRecommendationData(recommendations);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error al cargar la recomendación");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [taskId, navigate]);

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

  if (error || !task || !recommendationData) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error || "No se pudo cargar la recomendación"}
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Resumen del análisis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <p className="text-cyan-400 text-sm">Estrategia actual</p>
            </div>
            <p className="text-white capitalize">{recommendationData.strategy}</p>
          </div>

          <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-purple-400" />
              <p className="text-purple-400 text-sm">Integrantes evaluados</p>
            </div>
            <p className="text-white">{recommendationData.recommendations.length} recomendados</p>
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
          <button
            onClick={() => navigate(`/task/${taskId}`)}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Volver a la tarea
          </button>
        </div>

        {recommendationData.recommendations.map((rec, index) => (
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
                  <p className="text-slate-400 text-sm">{rec.member.role_name}</p>
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

            {rec.matching_skills.length > 0 && (
              <div className="mb-4">
                <p className="text-slate-400 text-xs mb-2">Habilidades coincidentes</p>
                <div className="flex flex-wrap gap-2">
                  {rec.matching_skills.map((skill, i) => (
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

            <button
              onClick={() => navigate(`/member/${rec.member.id}`)}
              className={`w-full py-3 rounded-lg transition-all ${
                index === 0
                  ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              Ver perfil de {rec.member.full_name.split(" ")[0]}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-cyan-400 mt-1" />
          <div>
            <h3 className="text-white mb-2">Sobre esta recomendación</h3>
            <p className="text-slate-400 text-sm">
              Esta primera versión utiliza una lógica de recomendación basada en datos reales del sistema:
              carga actual, disponibilidad, cumplimiento histórico, cantidad de tareas activas,
              prioridad y complejidad. En una siguiente fase se incorporarán habilidades, simulación
              de escenarios, trazabilidad de decisiones y alertas de desbalance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}