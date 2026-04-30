import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BrainCircuit,
  Calendar,
  CheckSquare,
  FolderKanban,
  Plus,
  User,
} from "lucide-react";
import { createTask } from "../services/taskService";
import { getProjectById, getProjectMembers, type ProjectMember, type ProjectResponse } from "../services/projectService";
import { getSkills, type SkillResponse } from "../services/skillService";
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

type SelectedRequiredSkill = {
  skill_id: number;
  required_level: number;
};

export default function CreateTask() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const token = getAccessToken();
  const currentUser = getStoredUser();

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillResponse[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("feature");
  const [priority, setPriority] = useState("medium");
  const [complexity, setComplexity] = useState("3");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<SelectedRequiredSkill[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) {
        setError("No se encontró el identificador del proyecto.");
        setLoading(false);
        return;
      }

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [projectData, membersData, skillsData] = await Promise.all([
          getProjectById(projectId, token),
          getProjectMembers(projectId, token),
          getSkills(token),
        ]);

        setProject(projectData);
        setProjectMembers(membersData);
        setSkillsCatalog(skillsData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar la información necesaria para crear la tarea.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, token, navigate]);

  const sortedMembers = useMemo(() => {
    return [...projectMembers].sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
  }, [projectMembers]);

  const sortedSkills = useMemo(() => {
    return [...skillsCatalog].sort((a, b) => a.name.localeCompare(b.name));
  }, [skillsCatalog]);

  const isSkillSelected = (skillId: number) => {
    return selectedSkills.some((item) => item.skill_id === skillId);
  };

  const toggleSkill = (skillId: number) => {
    setSelectedSkills((prev) => {
      const exists = prev.some((item) => item.skill_id === skillId);

      if (exists) {
        return prev.filter((item) => item.skill_id !== skillId);
      }

      return [...prev, { skill_id: skillId, required_level: 3 }];
    });
  };

  const updateSkillLevel = (skillId: number, requiredLevel: number) => {
    setSelectedSkills((prev) =>
      prev.map((item) =>
        item.skill_id === skillId ? { ...item, required_level: requiredLevel } : item
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectId || !token || !currentUser) return;

    if (!title.trim()) {
      setError("Ingresa el título de la tarea.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await createTask(
        {
          project_id: Number(projectId),
          title: title.trim(),
          description: description.trim() || null,
          task_type: taskType,
          priority,
          complexity: Number(complexity),
          status: "pending",
          estimated_hours: estimatedHours ? Number(estimatedHours) : null,
          due_date: dueDate || null,
          created_by: currentUser.id,
          assigned_to: assignedTo ? Number(assignedTo) : null,
          required_skills: selectedSkills,
        },
        token
      );

      setSuccess("La tarea fue creada correctamente.");

      setTimeout(() => {
        navigate(`/kanban/${projectId}`);
      }, 700);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo crear la tarea.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-slate-300">Cargando formulario de tarea...</div>;
  }

  if (error && !project) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        No se encontró el proyecto.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl text-white">Crear nueva tarea</h1>
            <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-sm border border-cyan-500/20">
              Proyecto #{project.id}
            </span>
          </div>
          <p className="text-slate-300 text-lg">{project.name}</p>
          <p className="text-slate-400 mt-2">
            Registra una nueva actividad para este proyecto y deja lista la información para el tablero Kanban y la recomendación inteligente.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/projects/${project.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al proyecto
          </button>

          <button
            onClick={() => navigate(`/kanban/${project.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <CheckSquare className="w-4 h-4" />
            Ver Kanban
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-4 text-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Información principal</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-2">Título de la tarea</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Diseñar modelo de base de datos del módulo inteligente"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-2">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe claramente el propósito, entregable o detalle operativo de la tarea."
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-2">Tipo de tarea</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    {taskTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-2">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-2">Complejidad</label>
                  <select
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="1">1 - Muy baja</option>
                    <option value="2">2 - Baja</option>
                    <option value="3">3 - Media</option>
                    <option value="4">4 - Alta</option>
                    <option value="5">5 - Muy alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-2">Tiempo estimado (horas)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder="Ej: 8"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-2">Fecha límite</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm mb-2">Responsable inicial (opcional)</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Sin asignar por ahora</option>
                      {sortedMembers.map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.full_name} — {member.project_role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <BrainCircuit className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Habilidades requeridas</h2>
            </div>

            {sortedSkills.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-slate-400 text-sm">
                No hay habilidades registradas en el sistema.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedSkills.map((skill) => {
                  const selected = selectedSkills.find((item) => item.skill_id === skill.id);

                  return (
                    <div
                      key={skill.id}
                      className={`rounded-xl border p-4 transition-all ${
                        selected
                          ? "border-cyan-500/30 bg-cyan-500/5"
                          : "border-slate-800 bg-slate-950/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <label className="inline-flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSkillSelected(skill.id)}
                            onChange={() => toggleSkill(skill.id)}
                            className="mt-1 rounded"
                          />
                          <div>
                            <p className="text-white">{skill.name}</p>
                            <p className="text-slate-400 text-sm">
                              {skill.category || "Sin categoría"}
                            </p>
                          </div>
                        </label>

                        {selected && (
                          <div className="min-w-[180px]">
                            <label className="block text-slate-300 text-xs mb-2">
                              Nivel requerido
                            </label>
                            <select
                              value={selected.required_level}
                              onChange={(e) =>
                                updateSkillLevel(skill.id, Number(e.target.value))
                              }
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="1">1 - Básico</option>
                              <option value="2">2 - Inicial</option>
                              <option value="3">3 - Intermedio</option>
                              <option value="4">4 - Avanzado</option>
                              <option value="5">5 - Experto</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Resumen de registro</h2>

            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Proyecto</p>
                <p className="text-white">{project.name}</p>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Tipo</p>
                <p className="text-white">
                  {taskTypeOptions.find((item) => item.value === taskType)?.label || taskType}
                </p>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Prioridad</p>
                <p className="text-white">
                  {priorityOptions.find((item) => item.value === priority)?.label || priority}
                </p>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Complejidad</p>
                <p className="text-white">{complexity}/5</p>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Habilidades seleccionadas</p>
                <p className="text-white">{selectedSkills.length}</p>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Responsable inicial</p>
                <p className="text-white">
                  {assignedTo
                    ? sortedMembers.find((item) => String(item.user.id) === assignedTo)?.user.full_name || "Seleccionado"
                    : "Sin asignar"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <FolderKanban className="w-5 h-5 text-cyan-400 mt-1" />
              <div>
                <h3 className="text-white mb-2">Preparación para Kanban e IA</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Mientras más clara sea la información de la tarea y mejor definidas estén las habilidades requeridas,
                  más útil será la recomendación inteligente y más ordenado quedará el tablero Kanban del proyecto.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {submitting ? "Creando tarea..." : "Crear tarea"}
          </button>
        </div>
      </form>
    </div>
  );
}