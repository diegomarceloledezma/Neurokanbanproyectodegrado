import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckSquare, FolderKanban, Users } from "lucide-react";
import { getProjects, type ProjectResponse } from "../services/projectService";
import { getAccessToken } from "../services/sessionService";

export default function KanbanProjects() {
  const navigate = useNavigate();
  const token = getAccessToken();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProjects = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await getProjects(token);
        setProjects(data);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("No se pudieron cargar los proyectos.");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [token, navigate]);

  if (loading) {
    return <div className="text-slate-300">Cargando proyectos para Kanban...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-white">Tableros Kanban</h1>
        <p className="text-slate-400 mt-2">
          Selecciona el proyecto cuyo tablero deseas visualizar.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-400">
          No hay proyectos registrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 mb-3">
                    <FolderKanban className="w-5 h-5" />
                    <span className="text-sm">Proyecto #{project.id}</span>
                  </div>

                  <h2 className="text-xl text-white">{project.name}</h2>
                  <p className="text-slate-400 mt-2">
                    {project.description || "Sin descripción registrada."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700">
                      Estado: {project.status}
                    </span>

                    <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 inline-flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      {project.members?.length ?? 0} integrante
                      {(project.members?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3 flex-wrap">
                <Link
                  to={`/kanban/${project.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all"
                >
                  <CheckSquare className="w-4 h-4" />
                  Ver tablero Kanban
                </Link>

                <Link
                  to={`/projects/${project.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all"
                >
                  <FolderKanban className="w-4 h-4" />
                  Ver proyecto
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}