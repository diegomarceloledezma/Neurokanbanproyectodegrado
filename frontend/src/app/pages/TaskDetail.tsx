import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  History,
  Save,
  UserCircle2,
} from "lucide-react";
import { getTaskById, type TaskResponse } from "../services/taskService";
import {
  getTaskOutcome,
  upsertTaskOutcome,
  type TaskOutcomeResponse,
} from "../services/taskOutcomeService";
import {
  getTaskAssignmentHistory,
  type TaskAssignmentHistoryItem,
} from "../services/taskHistoryService";
import { getAccessToken } from "../services/sessionService";

function formatDate(value?: string | null) {
  if (!value) return "No registrada";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function humanizePriority(priority?: string) {
  const map: Record<string, string> = {
    low: "Baja",
    medium: "Media",
    high: "Alta",
    critical: "Crítica",
  };
  return map[priority || ""] ?? priority ?? "No definida";
}

function humanizeStatus(status?: string) {
  const map: Record<string, string> = {
    pending: "Pendiente",
    in_progress: "En progreso",
    review: "En revisión",
    blocked: "Bloqueada",
    done: "Completada",
  };
  return map[status || ""] ?? status ?? "No definido";
}

function humanizeTaskType(taskType?: string) {
  const map: Record<string, string> = {
    feature: "Funcionalidad",
    bug: "Error",
    improvement: "Mejora",
    research: "Investigación",
    documentation: "Documentación",
    design: "Diseño",
    marketing: "Marketing",
    operations: "Operaciones",
    other: "Otro",
  };
  return map[taskType || ""] ?? taskType ?? "No definido";
}

function humanizeStrategy(strategy?: string | null) {
  const map: Record<string, string> = {
    balance: "Balance",
    efficiency: "Eficiencia",
    urgency: "Urgencia",
    learning: "Aprendizaje",
  };
  return map[strategy || ""] ?? strategy ?? "No definida";
}

function humanizeSource(source?: string | null) {
  const map: Record<string, string> = {
    heuristic: "Heurístico",
    hybrid: "Híbrido",
    historical_backfill: "Backfill histórico",
    manual: "Manual",
  };
  return map[source || ""] ?? source ?? "No definida";
}

function humanizeRisk(risk?: string | null) {
  const map: Record<string, string> = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  };
  return map[risk || ""] ?? risk ?? "No definido";
}

function formatPercentNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(2)}%`;
}

function formatPlain(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(2);
}

export default function TaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const token = getAccessToken();

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [outcome, setOutcome] = useState<TaskOutcomeResponse | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<TaskAssignmentHistoryItem[]>([]);

  const [completedAt, setCompletedAt] = useState("");
  const [finishedOnTime, setFinishedOnTime] = useState("true");
  const [delayHours, setDelayHours] = useState("0");
  const [qualityScore, setQualityScore] = useState("5");
  const [hadRework, setHadRework] = useState(false);
  const [reworkCount, setReworkCount] = useState("0");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const latestDecision = useMemo(() => {
    return assignmentHistory.length > 0 ? assignmentHistory[0] : null;
  }, [assignmentHistory]);

  useEffect(() => {
    if (!taskId || !token) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccessMessage("");

        const [taskData, outcomeData, historyData] = await Promise.all([
          getTaskById(taskId, token),
          getTaskOutcome(taskId, token),
          getTaskAssignmentHistory(taskId, token),
        ]);

        setTask(taskData);
        setOutcome(outcomeData);
        setAssignmentHistory(historyData);

        if (outcomeData) {
          setCompletedAt(
            outcomeData.completed_at
              ? new Date(outcomeData.completed_at).toISOString().slice(0, 16)
              : ""
          );
          setFinishedOnTime(
            outcomeData.finished_on_time === false ? "false" : "true"
          );
          setDelayHours(String(outcomeData.delay_hours ?? 0));
          setQualityScore(String(outcomeData.quality_score ?? 5));
          setHadRework(Boolean(outcomeData.had_rework));
          setReworkCount(String(outcomeData.rework_count ?? 0));
          setNotes(outcomeData.notes ?? "");
        }
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar el detalle de la tarea.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [taskId, token]);

  const handleSaveOutcome = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!taskId || !token) return;

    try {
      setSavingOutcome(true);
      setError("");
      setSuccessMessage("");

      const saved = await upsertTaskOutcome(
        taskId,
        {
          completed_at: completedAt ? new Date(completedAt).toISOString() : null,
          finished_on_time: finishedOnTime === "true",
          delay_hours: Number(delayHours || 0),
          quality_score: qualityScore ? Number(qualityScore) : null,
          had_rework: hadRework,
          rework_count: reworkCount ? Number(reworkCount) : 0,
          notes: notes.trim() || null,
        },
        token
      );

      const updatedTask = await getTaskById(taskId, token);

      setOutcome(saved);
      setTask(updatedTask);

      setCompletedAt(
        saved.completed_at
          ? new Date(saved.completed_at).toISOString().slice(0, 16)
          : ""
      );
      setFinishedOnTime(saved.finished_on_time === false ? "false" : "true");
      setDelayHours(String(saved.delay_hours ?? 0));
      setQualityScore(String(saved.quality_score ?? 5));
      setHadRework(Boolean(saved.had_rework));
      setReworkCount(String(saved.rework_count ?? 0));
      setNotes(saved.notes ?? "");

      setSuccessMessage("Resultado de la tarea guardado correctamente.");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo guardar el resultado.");
    } finally {
      setSavingOutcome(false);
    }
  };

  if (loading) {
    return <div className="text-slate-300">Cargando detalle de tarea...</div>;
  }

  if (!task) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
        No se encontró la tarea.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          to={task.project_id ? `/project/${task.project_id}` : "/projects"}
          className="text-cyan-400 hover:text-cyan-300 text-sm"
        >
          ← Volver al proyecto
        </Link>

        <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
          <div>
            <h1 className="text-3xl text-white">{task.title}</h1>
            <p className="text-slate-400 mt-2">
              {task.description || "Esta tarea no tiene descripción registrada."}
            </p>
          </div>

          <button
            onClick={() => navigate(`/recommendation/${task.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all"
          >
            <BrainCircuit className="w-4 h-4" />
            Recomendación inteligente
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardList className="w-5 h-5 text-cyan-400" />
            <h2 className="text-2xl text-white">Información de la tarea</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Tipo</p>
              <p className="text-white">{humanizeTaskType(task.task_type)}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Estado</p>
              <p className="text-white">{humanizeStatus(task.status)}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Prioridad</p>
              <p className="text-white">{humanizePriority(task.priority)}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Complejidad</p>
              <p className="text-white">{task.complexity}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Horas estimadas</p>
              <p className="text-white">{task.estimated_hours ?? "No definidas"}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Fecha límite</p>
              <p className="text-white">{formatDate(task.due_date)}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Creada por</p>
              <p className="text-white">{task.creator?.full_name || "No definido"}</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-slate-400 text-xs mb-1">Asignada a</p>
              <p className="text-white">{task.assignee?.full_name || "Sin asignar"}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-slate-300 mb-3">Habilidades requeridas</p>
            <div className="flex flex-wrap gap-2">
              {task.required_skills && task.required_skills.length > 0 ? (
                task.required_skills.map((item) => (
                  <span
                    key={item.id}
                    className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm"
                  >
                    {item.skill?.name || "Habilidad"} · Nivel {item.required_level}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-sm">
                  No se registraron habilidades requeridas.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserCircle2 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl text-white">Estado del resultado</h2>
          </div>

          {outcome ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Fecha de finalización</p>
                <p className="text-white">{formatDate(outcome.completed_at)}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">¿Terminó a tiempo?</p>
                <p className="text-white">{outcome.finished_on_time ? "Sí" : "No"}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Calidad</p>
                <p className="text-white">{outcome.quality_score ?? "No registrada"}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Retrabajo</p>
                <p className="text-white">
                  {outcome.had_rework ? `Sí (${outcome.rework_count})` : "No"}
                </p>
              </div>

              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                <p className="text-green-300 text-xs mb-1">Puntaje de éxito</p>
                <p className="text-white text-2xl">{outcome.success_score.toFixed(2)}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Notas</p>
                <p className="text-white">{outcome.notes || "Sin observaciones"}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-slate-400 text-sm">
              Todavía no se registró el resultado de esta tarea.
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-5 h-5 text-purple-400" />
          <h2 className="text-2xl text-white">Trazabilidad de la decisión</h2>
        </div>

        {latestDecision ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
              <p className="text-cyan-300 text-sm mb-3">Última decisión registrada</p>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Fuente</p>
                  <p className="text-white">{humanizeSource(latestDecision.source)}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Estrategia</p>
                  <p className="text-white">{humanizeStrategy(latestDecision.strategy)}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Riesgo</p>
                  <p className="text-white">{humanizeRisk(latestDecision.risk_level)}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Puntaje recomendado</p>
                  <p className="text-white">{formatPlain(latestDecision.recommendation_score)}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Skill match score</p>
                  <p className="text-white">{formatPlain(latestDecision.skill_match_score)}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Performance score</p>
                  <p className="text-white">{formatPlain(latestDecision.performance_score)}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Matching ratio</p>
                  <p className="text-white">{formatPlain(latestDecision.matching_ratio)}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-slate-400 text-xs mb-1">Disponibilidad snapshot</p>
                  <p className="text-white">{formatPercentNumber(latestDecision.availability_snapshot)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-slate-400 text-xs mb-1">Justificación de la asignación</p>
                <p className="text-slate-200">
                  {latestDecision.reason || "Sin justificación registrada."}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {assignmentHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-white font-medium">
                        {humanizeSource(item.source)} · {humanizeStrategy(item.strategy)}
                      </p>
                      <p className="text-slate-400 text-sm mt-1">
                        Fecha: {formatDate(item.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200">
                        Riesgo: {humanizeRisk(item.risk_level)}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200">
                        Score: {formatPlain(item.recommendation_score)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Carga snapshot</p>
                      <p className="text-white">{formatPercentNumber(item.current_load_snapshot)}</p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Disponibilidad snapshot</p>
                      <p className="text-white">{formatPercentNumber(item.availability_snapshot)}</p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Habilidades coincidentes</p>
                      <p className="text-white">
                        {item.matching_skills_count ?? 0} / {item.required_skills_count ?? 0}
                      </p>
                    </div>
                  </div>

                  {item.reason && (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-xs mb-1">Motivo</p>
                      <p className="text-slate-200 text-sm">{item.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-slate-400 text-sm">
            Esta tarea todavía no tiene historial de asignación registrado.
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <CalendarClock className="w-5 h-5 text-purple-400" />
          <h2 className="text-2xl text-white">Registrar resultado de la tarea</h2>
        </div>

        <form onSubmit={handleSaveOutcome} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 text-sm mb-2">Fecha de finalización</label>
              <input
                type="datetime-local"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">¿Terminó a tiempo?</label>
              <select
                value={finishedOnTime}
                onChange={(e) => setFinishedOnTime(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">Horas de retraso</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={delayHours}
                onChange={(e) => setDelayHours(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">Calidad (1 a 5)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={qualityScore}
                onChange={(e) => setQualityScore(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">Cantidad de retrabajos</label>
              <input
                type="number"
                min="0"
                value={reworkCount}
                onChange={(e) => setReworkCount(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 w-full">
                <input
                  type="checkbox"
                  checked={hadRework}
                  onChange={(e) => setHadRework(e.target.checked)}
                />
                <span className="text-slate-200">La tarea tuvo retrabajo</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Notas u observaciones</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Describe el resultado final, problemas encontrados o aprendizajes."
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={savingOutcome}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-500 text-slate-950 font-medium hover:bg-cyan-400 transition-all disabled:opacity-60"
          >
            {savingOutcome ? (
              <CheckCircle2 className="w-4 h-4 animate-pulse" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingOutcome ? "Guardando..." : "Guardar resultado"}
          </button>
        </form>
      </div>
    </div>
  );
}