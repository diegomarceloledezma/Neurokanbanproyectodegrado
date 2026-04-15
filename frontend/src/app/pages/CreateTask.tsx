import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Sparkles, Save, AlertCircle, Plus, Trash2 } from "lucide-react";
import { createTask } from "../services/taskService";
import { getAccessToken, getStoredUser } from "../services/sessionService";
import { getSkills, type SkillResponse } from "../services/skillService";

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

type RequiredSkillFormItem = {
  localId: string;
  skill_id: number | "";
  required_level: number;
};

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
    dependencies: "",
  });

  const [requiredSkills, setRequiredSkills] = useState<RequiredSkillFormItem[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillResponse[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = getAccessToken();
  const currentUser = getStoredUser();

  useEffect(() => {
    const loadSkills = async () => {
      if (!token) {
        return;
      }

      try {
        setSkillsLoading(true);
        const data = await getSkills(token);
        setAvailableSkills(data);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar las habilidades disponibles");
      } finally {
        setSkillsLoading(false);
      }
    };

    loadSkills();
  }, [token]);

  const selectedSkillIds = useMemo(
    () =>
      requiredSkills
        .map((item) => item.skill_id)
        .filter((value): value is number => typeof value === "number"),
    [requiredSkills]
  );

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

  const addRequiredSkillRow = () => {
    setRequiredSkills((prev) => [
      ...prev,
      {
        localId: `${Date.now()}-${prev.length}`,
        skill_id: "",
        required_level: 3,
      },
    ]);
  };

  const updateRequiredSkillRow = (
    localId: string,
    field: "skill_id" | "required_level",
    value: string
  ) => {
    setRequiredSkills((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...item,
              [field]: field === "skill_id" ? (value ? Number(value) : "") : Number(value),
            }
          : item
      )
    );
  };

  const removeRequiredSkillRow = (localId: string) => {
    setRequiredSkills((prev) => prev.filter((item) => item.localId !== localId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!projectId) {
      setError("No se encontró el identificador del proyecto");
      return;
    }

    if (!formData.title.trim()) {
      setError("Debes ingresar un título");
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

    if (!token || !currentUser) {
      navigate("/login");
      return;
    }

    const invalidRequiredSkill = requiredSkills.find(
      (item) => item.skill_id === "" || item.required_level < 1 || item.required_level > 5
    );

    if (invalidRequiredSkill) {
      setError("Revisa las habilidades requeridas: todas deben tener una habilidad y un nivel válido");
      return;
    }

    const uniqueSkillIds = new Set(
      requiredSkills
        .map((item) => item.skill_id)
        .filter((value): value is number => typeof value === "number")
    );

    if (uniqueSkillIds.size !== selectedSkillIds.length) {
      setError("No repitas la misma habilidad requerida");
      return;
    }

    setLoading(true);

    try {
      const createdTask = await createTask(
        {
          project_id: Number(projectId),
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          task_type: formData.taskType,
          priority: formData.priority,
          complexity: Number(formData.complexity),
          status: "pending",
          estimated_hours: Number(formData.estimatedHours),
          actual_hours: 0,
          due_date: formData.deadline || undefined,
          created_by: currentUser.id,
          assigned_to: null,
          required_skills: requiredSkills
            .filter((item): item is { localId: string; skill_id: number; required_level: number } => typeof item.skill_id === "number")
            .map((item) => ({
              skill_id: item.skill_id,
              required_level: item.required_level,
            })),
        },
        token
      );

      navigate(`/task/${createdTask.id}`);
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

  const getFilteredOptions = (currentValue: number | "") => {
    return availableSkills.filter(
      (skill) => skill.id === currentValue || !selectedSkillIds.includes(skill.id)
    );
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

          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-white">Habilidades requeridas</h3>
                <p className="text-slate-400 text-sm">
                  Estas habilidades serán usadas por el motor inteligente al recomendar asignaciones.
                </p>
              </div>

              <button
                type="button"
                onClick={addRequiredSkillRow}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                Agregar habilidad
              </button>
            </div>

            {skillsLoading ? (
              <p className="text-slate-400 text-sm">Cargando habilidades disponibles...</p>
            ) : availableSkills.length === 0 ? (
              <p className="text-slate-400 text-sm">No hay habilidades registradas todavía.</p>
            ) : requiredSkills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-600 p-4 text-slate-400 text-sm">
                Aún no agregaste habilidades requeridas. Puedes crear la tarea sin ellas, pero la recomendación será menos precisa.
              </div>
            ) : (
              <div className="space-y-3">
                {requiredSkills.map((item, index) => (
                  <div
                    key={item.localId}
                    className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3 items-end"
                  >
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">
                        Habilidad #{index + 1}
                      </label>
                      <select
                        value={item.skill_id}
                        onChange={(e) => updateRequiredSkillRow(item.localId, "skill_id", e.target.value)}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                      >
                        <option value="">Selecciona una habilidad</option>
                        {getFilteredOptions(item.skill_id).map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.name}
                            {skill.category ? ` · ${skill.category}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-300 mb-2">
                        Nivel requerido
                      </label>
                      <select
                        value={item.required_level}
                        onChange={(e) =>
                          updateRequiredSkillRow(item.localId, "required_level", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                      >
                        <option value="1">1 - Básico</option>
                        <option value="2">2 - Inicial</option>
                        <option value="3">3 - Intermedio</option>
                        <option value="4">4 - Avanzado</option>
                        <option value="5">5 - Experto</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeRequiredSkillRow(item.localId)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              Este campo todavía no está conectado al backend.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-cyan-400" />
            <p className="text-slate-300 text-sm">
              Después de guardar, podrás abrir el detalle y lanzar una recomendación inteligente usando las habilidades registradas.
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