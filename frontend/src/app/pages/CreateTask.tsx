import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Sparkles, Save, AlertCircle } from "lucide-react";
import { createTask } from "../services/taskService";
import { getAccessToken, getStoredUser } from "../services/sessionService";

const priorityOptions = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const taskTypeOptions = [
  { value: "feature", label: "Funcionalidad" },
  { value: "bug", label: "Corrección" },
  { value: "improvement", label: "Mejora" },
  { value: "research", label: "Investigación" },
  { value: "documentation", label: "Documentación" },
  { value: "design", label: "Diseño" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operaciones" },
  { value: "other", label: "Otro" },
];

export default function CreateTask() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    complexity: 3,
    estimatedHours: 8,
    deadline: "",
    taskType: "",
    skills: "",
    dependencies: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "complexity" || name === "estimatedHours"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!projectId) {
      setError("No se encontró el identificador del proyecto");
      return;
    }

    if (!formData.taskType) {
      setError("Debes seleccionar un tipo de tarea");
      return;
    }

    if (formData.complexity < 1 || formData.complexity > 5) {
      setError("La complejidad debe estar entre 1 y 5");
      return;
    }

    const token = getAccessToken();
    const currentUser = getStoredUser();

    if (!token || !currentUser) {
      navigate("/login");
      return;
    }

    setLoading(true);

    try {
      await createTask(
        {
          project_id: Number(projectId),
          title: formData.title,
          description: formData.description || undefined,
          task_type: formData.taskType,
          priority: formData.priority,
          complexity: Number(formData.complexity),
          status: "pending",
          estimated_hours: Number(formData.estimatedHours),
          actual_hours: 0,
          due_date: formData.deadline || undefined,
          created_by: currentUser.id,
          assigned_to: null,
        },
        token
      );

      navigate(`/kanban/${projectId}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error al crear la tarea");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Crear nueva tarea</h1>
        <p className="text-slate-400">
          Define la información principal de la tarea para incorporarla al proyecto
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Título de la tarea *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="Ej: Preparar informe de avance"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
              placeholder="Describe los detalles de la tarea..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Prioridad *
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Tipo de tarea *
              </label>
              <select
                name="taskType"
                value={formData.taskType}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              >
                <option value="">Selecciona un tipo</option>
                {taskTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Complejidad (1-5) *
              </label>
              <input
                type="number"
                name="complexity"
                value={formData.complexity}
                onChange={handleChange}
                min="1"
                max="5"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Tiempo estimado (hrs) *
              </label>
              <input
                type="number"
                name="estimatedHours"
                value={formData.estimatedHours}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Fecha límite
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Habilidades requeridas
            </label>
            <input
              type="text"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="Ej: redacción, análisis, coordinación"
            />
            <p className="text-slate-500 text-xs mt-1">
              Este campo aún no está conectado al backend, pero se conservará para la siguiente fase.
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Dependencias
            </label>
            <input
              type="text"
              name="dependencies"
              value={formData.dependencies}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="Identificadores de tareas relacionadas"
            />
            <p className="text-slate-500 text-xs mt-1">
              Este campo aún no está conectado al backend, pero se incorporará más adelante.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-cyan-400" />
            <p className="text-slate-300 text-sm">
              En la siguiente etapa podrás analizar la tarea y obtener recomendaciones inteligentes de asignación.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? "Guardando..." : "Guardar tarea"}
            </button>

            <button
              type="button"
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-500 rounded-lg border border-slate-700 cursor-not-allowed"
              disabled
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Analizar tarea
            </button>

            <button
              type="button"
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-500 rounded-lg border border-slate-700 cursor-not-allowed"
              disabled
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              Recomendar asignación
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}