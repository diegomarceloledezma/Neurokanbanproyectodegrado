import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Mail,
  Briefcase,
  TrendingUp,
  Clock,
  Award,
  BrainCircuit,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  addMemberSkill,
  deleteMemberSkill,
  getMemberProfile,
  getMemberSkills,
  updateMemberSkill,
  type MemberProfileResponse,
  type MemberSkillManageItem,
} from "../services/memberService";
import { getAccessToken } from "../services/sessionService";
import { getSkills, type SkillResponse } from "../services/skillService";

const roleLabels: Record<string, string> = {
  leader: "Líder de equipo",
  member: "Integrante del equipo",
  admin: "Administrador",
};

const priorityLabels: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  review: "En revisión",
  done: "Finalizada",
  blocked: "Bloqueada",
};

const levelLabels: Record<number, string> = {
  1: "Básico",
  2: "Inicial",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

export default function MemberProfile() {
  const { memberId } = useParams();
  const navigate = useNavigate();

  const [member, setMember] = useState<MemberProfileResponse | null>(null);
  const [memberSkills, setMemberSkills] = useState<MemberSkillManageItem[]>([]);
  const [allSkills, setAllSkills] = useState<SkillResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [level, setLevel] = useState("3");
  const [yearsExperience, setYearsExperience] = useState("1");
  const [verifiedByLeader, setVerifiedByLeader] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState<number | null>(null);

  const token = getAccessToken();

  useEffect(() => {
    const loadMember = async () => {
      if (!memberId) {
        setError("No se encontró el identificador del integrante");
        setLoading(false);
        return;
      }

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const [profileData, skillsData, catalogData] = await Promise.all([
          getMemberProfile(memberId, token),
          getMemberSkills(memberId, token),
          getSkills(token),
        ]);

        setMember(profileData);
        setMemberSkills(skillsData);
        setAllSkills(catalogData);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error al cargar el perfil");
        }
      } finally {
        setLoading(false);
      }
    };

    loadMember();
  }, [memberId, navigate, token]);

  const refreshData = async () => {
    if (!memberId || !token) return;

    const [profileData, skillsData] = await Promise.all([
      getMemberProfile(memberId, token),
      getMemberSkills(memberId, token),
    ]);

    setMember(profileData);
    setMemberSkills(skillsData);
  };

  const resetSkillForm = () => {
    setSelectedSkillId("");
    setLevel("3");
    setYearsExperience("1");
    setVerifiedByLeader(false);
    setEditingSkillId(null);
  };

  const handleSubmitSkill = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!memberId || !token) return;

    if (!selectedSkillId) {
      setError("Selecciona una habilidad.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        skill_id: Number(selectedSkillId),
        level: Number(level),
        years_experience: Number(yearsExperience),
        verified_by_leader: verifiedByLeader,
      };

      if (editingSkillId) {
        await updateMemberSkill(memberId, editingSkillId, payload, token);
        setSuccess("Habilidad actualizada correctamente.");
      } else {
        await addMemberSkill(memberId, payload, token);
        setSuccess("Habilidad registrada correctamente.");
      }

      await refreshData();
      resetSkillForm();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo guardar la habilidad.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSkill = (skill: MemberSkillManageItem) => {
    setSelectedSkillId(String(skill.skill_id));
    setLevel(String(skill.level));
    setYearsExperience(String(skill.years_experience));
    setVerifiedByLeader(skill.verified_by_leader);
    setEditingSkillId(skill.id);
    setSuccess("");
    setError("");
  };

  const handleDeleteSkill = async (skill: MemberSkillManageItem) => {
    if (!memberId || !token) return;

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la habilidad ${skill.skill_name}?`
    );

    if (!confirmed) return;

    try {
      setDeletingSkillId(skill.id);
      setError("");
      setSuccess("");

      await deleteMemberSkill(memberId, skill.id, token);
      await refreshData();

      if (editingSkillId === skill.id) {
        resetSkillForm();
      }

      setSuccess("Habilidad eliminada correctamente.");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo eliminar la habilidad.");
    } finally {
      setDeletingSkillId(null);
    }
  };

  const sortedMemberSkills = useMemo(() => {
    return [...memberSkills].sort((a, b) => a.skill_name.localeCompare(b.skill_name));
  }, [memberSkills]);

  if (loading) {
    return <div className="text-slate-300">Cargando perfil del integrante...</div>;
  }

  if (error && !member) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!member) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        Integrante no encontrado
      </div>
    );
  }

  const displayRole = roleLabels[member.role_name] ?? member.role_name;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-3xl">
            {member.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className="flex-1 min-w-[280px]">
            <h1 className="text-3xl text-white mb-2">{member.full_name}</h1>
            <div className="flex items-center gap-4 text-slate-400 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span>{displayRole}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{member.email}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Experiencia promedio</p>
                <p className="text-white">
                  {member.experience_level !== null && member.experience_level !== undefined
                    ? `${member.experience_level} años`
                    : "No definida"}
                </p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Disponibilidad</p>
                <p className="text-white">{member.availability}%</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Tareas activas</p>
                <p className="text-white">{member.active_tasks}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Cumplimiento</p>
                <p className="text-white">{member.completion_rate}%</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Capacidad semanal</p>
                <p className="text-white">
                  {member.project_capacity_hours !== null && member.project_capacity_hours !== undefined
                    ? `${member.project_capacity_hours} h`
                    : "No definida"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Resumen del integrante</h2>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Rol en la plataforma</p>
                <p className="text-white">{displayRole}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Nombre de usuario</p>
                <p className="text-white">{member.username}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Habilidades registradas</p>
                <p className="text-white">{memberSkills.length}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Total de tareas</p>
                <p className="text-white">{member.total_tasks}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Carga actual</h2>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Capacidad utilizada</span>
                <span className="text-white">{member.current_load}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    member.current_load > 70
                      ? "bg-gradient-to-r from-red-500 to-orange-500"
                      : member.current_load > 50
                      ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                      : "bg-gradient-to-r from-cyan-500 to-purple-600"
                  }`}
                  style={{ width: `${member.current_load}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Estado operativo</p>
                <p
                  className={`text-sm ${
                    member.current_load > 70
                      ? "text-red-400"
                      : member.current_load > 50
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {member.current_load > 70
                    ? "Sobrecargado"
                    : member.current_load > 50
                    ? "Ocupado"
                    : "Disponible"}
                </p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Capacidad restante</p>
                <p className="text-white text-sm">{member.availability}%</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl text-white">Rendimiento</h2>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">Tasa de cumplimiento</span>
                  <span className="text-green-400">{member.completion_rate}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                    style={{ width: `${member.completion_rate}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">Tareas completadas</p>
                  <p className="text-white text-lg">{member.completed_tasks}</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">Tareas en curso</p>
                  <p className="text-white text-lg">{member.active_tasks}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <BrainCircuit className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Gestión de habilidades</h2>
            </div>

            <form onSubmit={handleSubmitSkill} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="md:col-span-2">
                <label className="block text-slate-300 text-sm mb-2">Habilidad</label>
                <select
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  <option value="">Selecciona una habilidad</option>
                  {allSkills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name} {skill.category ? `— ${skill.category}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-2">Nivel</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="1">1 - Básico</option>
                  <option value="2">2 - Inicial</option>
                  <option value="3">3 - Intermedio</option>
                  <option value="4">4 - Avanzado</option>
                  <option value="5">5 - Experto</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-2">Años de experiencia</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-3 text-slate-300 text-sm">
                  <input
                    type="checkbox"
                    checked={verifiedByLeader}
                    onChange={(e) => setVerifiedByLeader(e.target.checked)}
                    className="rounded"
                  />
                  Marcar como verificada por líder
                </label>
              </div>

              <div className="md:col-span-2 flex gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  {submitting
                    ? "Guardando..."
                    : editingSkillId
                    ? "Actualizar habilidad"
                    : "Agregar habilidad"}
                </button>

                {editingSkillId && (
                  <button
                    type="button"
                    onClick={resetSkillForm}
                    className="px-5 py-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>

            {sortedMemberSkills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedMemberSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white">{skill.skill_name}</p>
                        <p className="text-slate-400 text-sm">{skill.category || "Sin categoría"}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                        Nivel {skill.level}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm text-slate-400 flex-wrap gap-2">
                      <span>{levelLabels[skill.level] ?? "No definido"}</span>
                      <span>{skill.years_experience} años</span>
                      <span className={skill.verified_by_leader ? "text-green-400" : "text-yellow-400"}>
                        {skill.verified_by_leader ? "Verificada" : "Pendiente"}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditSkill(skill)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(skill)}
                        disabled={deletingSkillId === skill.id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingSkillId === skill.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 bg-slate-800/30 rounded-lg">
                <p className="text-slate-500">No hay habilidades registradas todavía</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Tareas activas</h2>
            </div>

            {member.active_task_items.length > 0 ? (
              <div className="space-y-3">
                {member.active_task_items.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all cursor-pointer"
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <h3 className="text-white">{task.title}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          task.priority === "critical"
                            ? "bg-red-500/10 text-red-400"
                            : task.priority === "high"
                            ? "bg-orange-500/10 text-orange-400"
                            : task.priority === "medium"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {priorityLabels[task.priority] ?? task.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                      <span>Estado: {statusLabels[task.status] ?? task.status}</span>
                      <span>Complejidad: {task.complexity}</span>
                      <span>
                        Estimado: {task.estimated_hours !== null && task.estimated_hours !== undefined
                          ? `${task.estimated_hours} h`
                          : "No definido"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 bg-slate-800/30 rounded-lg">
                <p className="text-slate-500">No tiene tareas activas actualmente</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}