import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Users, Mail, Briefcase, FolderKanban } from "lucide-react";
import {
  getProjectMembers,
  getProjects,
  type ProjectMember,
  type ProjectResponse,
} from "../services/projectService";
import { getAccessToken } from "../services/sessionService";

const roleLabels: Record<string, string> = {
  leader: "Líder de equipo",
  member: "Integrante del equipo",
  admin: "Administrador",
};

export default function Team() {
  const navigate = useNavigate();
  const token = getAccessToken();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadInitialData = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const projectList = await getProjects(token);
        setProjects(projectList);

        if (projectList.length > 0) {
          const firstProjectId = String(projectList[0].id);
          setSelectedProjectId(firstProjectId);

          const projectMembers = await getProjectMembers(firstProjectId, token);
          setMembers(projectMembers);
        }
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudo cargar la información del equipo.");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [navigate, token]);

  const handleProjectChange = async (projectId: string) => {
    if (!token) return;

    try {
      setSelectedProjectId(projectId);
      setMembersLoading(true);
      setError("");

      const projectMembers = await getProjectMembers(projectId, token);
      setMembers(projectMembers);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudieron cargar los integrantes del proyecto.");
    } finally {
      setMembersLoading(false);
    }
  };

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
  }, [members]);

  if (loading) {
    return <div className="text-slate-300">Cargando equipo...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-white">Equipo</h1>
        <p className="text-slate-400 mt-2">
          Consulta los integrantes reales de cada proyecto y accede a su perfil.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl text-white">Proyecto seleccionado</h2>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-slate-400">
            No hay proyectos registrados.
          </div>
        ) : (
          <div className="max-w-xl">
            <label className="block text-slate-300 text-sm mb-2">Elegir proyecto</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedProject && (
          <div className="rounded-lg bg-slate-800/40 border border-slate-700 p-4">
            <h3 className="text-white">{selectedProject.name}</h3>
            <p className="text-slate-400 text-sm mt-1">
              {selectedProject.description || "Sin descripción registrada."}
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <Users className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl text-white">Integrantes del proyecto</h2>
          <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-sm border border-slate-700">
            {members.length} integrante{members.length === 1 ? "" : "s"}
          </span>
        </div>

        {membersLoading ? (
          <div className="text-slate-300">Cargando integrantes...</div>
        ) : sortedMembers.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-slate-400">
            Este proyecto no tiene integrantes registrados.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sortedMembers.map((member) => {
              const roleName =
                member.user.global_role?.name
                  ? roleLabels[member.user.global_role.name] ?? member.user.global_role.name
                  : "Sin rol";

              const initials = member.user.full_name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <Link
                  key={member.id}
                  to={`/member/${member.user.id}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-cyan-500/30 hover:bg-slate-800/40 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white">{member.user.full_name}</h3>

                      <div className="mt-2 space-y-1 text-sm text-slate-400">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{member.user.email}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          <span>{roleName}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                          Proyecto: {member.project_role}
                        </span>

                        <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
                          {member.weekly_capacity_hours ?? "N/D"} h/semana
                        </span>

                        <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
                          {member.availability_percentage ?? "N/D"}% disp.
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}