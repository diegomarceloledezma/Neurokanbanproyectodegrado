import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { UserPlus, UserX, Users, CheckSquare } from "lucide-react";
import {
  addMemberToProject,
  getAvailableUsersForProject,
  getProjectById,
  getProjectMembers,
  removeMemberFromProject,
  type AvailableProjectUser,
  type ProjectMember,
  type ProjectResponse,
} from "../services/projectService";
import { getAccessToken } from "../services/sessionService";

export default function Project() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableProjectUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [projectRole, setProjectRole] = useState("");
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState("");
  const [availabilityPercentage, setAvailabilityPercentage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = getAccessToken();

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!projectId) {
      navigate("/projects", { replace: true });
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [projectData, membersData, availableUsersData] = await Promise.all([
          getProjectById(projectId, token),
          getProjectMembers(projectId, token),
          getAvailableUsersForProject(projectId, token),
        ]);

        setProject(projectData);
        setMembers(membersData);
        setAvailableUsers(availableUsersData);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar el proyecto");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, token, navigate]);

  const memberCount = members.length;

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
  }, [members]);

  const refreshProjectData = async () => {
    if (!projectId || !token) return;

    const [projectData, membersData, availableUsersData] = await Promise.all([
      getProjectById(projectId, token),
      getProjectMembers(projectId, token),
      getAvailableUsersForProject(projectId, token),
    ]);

    setProject(projectData);
    setMembers(membersData);
    setAvailableUsers(availableUsersData);
  };

  const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectId || !token) return;

    if (!selectedUserId || !projectRole.trim()) {
      setError("Selecciona un usuario e ingresa el rol del proyecto.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await addMemberToProject(
        projectId,
        {
          user_id: Number(selectedUserId),
          project_role: projectRole.trim(),
          weekly_capacity_hours: weeklyCapacityHours ? Number(weeklyCapacityHours) : null,
          availability_percentage: availabilityPercentage ? Number(availabilityPercentage) : null,
        },
        token
      );

      await refreshProjectData();

      setSelectedUserId("");
      setProjectRole("");
      setWeeklyCapacityHours("");
      setAvailabilityPercentage("");
      setSuccess("Integrante agregado correctamente al proyecto.");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo agregar el integrante.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    if (!projectId || !token) return;

    const confirmed = window.confirm(
      `¿Seguro que deseas quitar a ${member.user.full_name} del proyecto?`
    );

    if (!confirmed) return;

    try {
      setRemovingMemberId(member.id);
      setError("");
      setSuccess("");

      await removeMemberFromProject(projectId, member.id, token);
      await refreshProjectData();

      setSuccess("Integrante removido del proyecto correctamente.");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo quitar el integrante.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (loading) {
    return <div className="text-slate-300">Cargando proyecto...</div>;
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        No se encontró el proyecto.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Link to="/projects" className="text-cyan-400 hover:text-cyan-300 text-sm">
          ← Volver a proyectos
        </Link>

        <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
          <div>
            <h1 className="text-3xl text-white">{project.name}</h1>
            <p className="text-slate-400 mt-2">
              {project.description || "Sin descripción registrada para este proyecto."}
            </p>
          </div>

          <button
            onClick={() => navigate(`/kanban/${project.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all"
          >
            <CheckSquare className="w-4 h-4" />
            Ver tablero Kanban
          </button>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl text-white">Integrantes del proyecto</h2>
            <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-sm border border-slate-700">
              {memberCount} integrante{memberCount === 1 ? "" : "s"}
            </span>
          </div>

          {sortedMembers.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-slate-400">
              Este proyecto todavía no tiene integrantes.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedMembers.map((member) => (
                <div
                  key={member.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex items-start justify-between gap-4 flex-wrap"
                >
                  <div>
                    <h3 className="text-white">{member.user.full_name}</h3>
                    <p className="text-slate-400 text-sm">
                      @{member.user.username} · {member.user.email}
                    </p>
                    <p className="text-slate-300 text-sm mt-2">
                      Rol en proyecto: {member.project_role}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      Rol global: {member.user.global_role?.description || member.user.global_role?.name || "Sin rol"}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      Capacidad semanal: {member.weekly_capacity_hours ?? "No definida"} h ·
                      Disponibilidad: {member.availability_percentage ?? "No definida"}%
                    </p>
                  </div>

                  <button
                    onClick={() => handleRemoveMember(member)}
                    disabled={removingMemberId === member.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-60"
                  >
                    <UserX className="w-4 h-4" />
                    {removingMemberId === member.id ? "Quitando..." : "Quitar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <UserPlus className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl text-white">Agregar integrante</h2>
          </div>

          {availableUsers.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-slate-400 text-sm">
              No hay usuarios disponibles para agregar a este proyecto.
            </div>
          ) : (
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-2">Usuario</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} — {user.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-2">Rol en el proyecto</label>
                <input
                  type="text"
                  value={projectRole}
                  onChange={(e) => setProjectRole(e.target.value)}
                  placeholder="Ej: Investigador, Backend Support, Diseñador UX"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-2">Capacidad semanal (horas)</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={weeklyCapacityHours}
                  onChange={(e) => setWeeklyCapacityHours(e.target.value)}
                  placeholder="Ej: 20"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-2">Disponibilidad (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={availabilityPercentage}
                  onChange={(e) => setAvailabilityPercentage(e.target.value)}
                  placeholder="Ej: 80"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all disabled:opacity-60"
              >
                {submitting ? "Agregando..." : "Agregar al proyecto"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}