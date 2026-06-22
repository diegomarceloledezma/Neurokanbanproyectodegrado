import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { FolderKanban, Plus, Users, X } from "lucide-react";
import {
  createProject,
  getProjects,
  type CreateProjectPayload,
  type ProjectResponse,
} from "../services/projectService";
import { getAccessToken, getCurrentUser } from "../services/sessionService";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";

const initialProjectForm: CreateProjectPayload = {
  name: "",
  description: "",
  status: "active",
  start_date: "",
  end_date: "",
};

export default function Projects() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUser = getCurrentUser();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectForm, setProjectForm] = useState<CreateProjectPayload>(initialProjectForm);

  const roleName = (
    currentUser?.role_name ||
    currentUser?.global_role?.name ||
    ""
  ).toLowerCase();

  const canCreateProject = roleName === "admin" || roleName === "leader";

  const loadProjects = async () => {
    if (!token) return;

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

  useEffect(() => {
    if (!token) {
      navigate("/login?session=expired", { replace: true });
      return;
    }

    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  const openCreateModal = () => {
    setProjectForm(initialProjectForm);
    setError("");
    setSuccess("");
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creatingProject) return;
    setShowCreateModal(false);
    setProjectForm(initialProjectForm);
  };

  const updateProjectForm = (field: keyof CreateProjectPayload, value: string) => {
    setProjectForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !canCreateProject) return;

    const cleanedName = projectForm.name.trim();
    const cleanedDescription = projectForm.description?.trim() || "";

    if (!cleanedName) {
      setError("Ingresa el nombre del proyecto.");
      return;
    }

    try {
      setCreatingProject(true);
      setError("");
      setSuccess("");

      const createdProject = await createProject(
        {
          ...projectForm,
          name: cleanedName,
          description: cleanedDescription || null,
          status: projectForm.status || "active",
          start_date: projectForm.start_date || null,
          end_date: projectForm.end_date || null,
        },
        token
      );

      setProjects((current) => [createdProject, ...current]);
      setSuccess("Proyecto creado correctamente.");
      setShowCreateModal(false);
      setProjectForm(initialProjectForm);

      navigate(`/projects/${createdProject.id}`);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo crear el proyecto.");
    } finally {
      setCreatingProject(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Cargando proyectos..."
        description="Estamos consultando los proyectos disponibles para tu rol."
      />
    );
  }

  if (error && projects.length === 0 && !showCreateModal) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl text-white">Proyectos</h1>
          <p className="text-slate-400 mt-2">
            Consulta los proyectos registrados y entra al detalle de cada uno.
          </p>
        </div>

        <ErrorState
          message={error}
          actionLabel="Volver al panel principal"
          onAction={() => navigate("/")}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl text-white">Proyectos</h1>
          <p className="text-slate-400 mt-2">
            Consulta, crea y gestiona los proyectos registrados en NeuroKanban.
          </p>
        </div>

        {canCreateProject && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/10 transition-all hover:from-cyan-600 hover:to-purple-700"
          >
            <Plus className="h-4 w-4" />
            Crear proyecto
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No hay proyectos registrados"
          description={
            canCreateProject
              ? "Crea el primer proyecto para poder agregar integrantes, abrir el tablero Kanban y comenzar a registrar tareas."
              : "Cuando un administrador o líder cree proyectos y te agregue como integrante, aparecerán aquí."
          }
          actionLabel={canCreateProject ? "Crear primer proyecto" : "Volver al panel principal"}
          onAction={canCreateProject ? openCreateModal : () => navigate("/")}
          secondaryActionLabel={canCreateProject ? "Volver al panel principal" : undefined}
          onSecondaryAction={canCreateProject ? () => navigate("/") : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 hover:border-cyan-500/40 transition-all"
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
                      {(project.members?.length ?? 0)} integrante
                      {(project.members?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-2xl font-semibold text-white">Crear proyecto</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Registra el primer proyecto para iniciar el flujo de trabajo en Kanban.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creatingProject}
                className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition-all hover:bg-slate-700 disabled:opacity-60"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Nombre del proyecto</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(event) => updateProjectForm("name", event.target.value)}
                  placeholder="Ej: NeuroKanban Producción"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Descripción</label>
                <textarea
                  value={projectForm.description || ""}
                  onChange={(event) => updateProjectForm("description", event.target.value)}
                  placeholder="Describe brevemente el objetivo del proyecto."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Estado</label>
                  <select
                    value={projectForm.status || "active"}
                    onChange={(event) => updateProjectForm("status", event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="planned">Planificado</option>
                    <option value="active">Activo</option>
                    <option value="paused">Pausado</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">Fecha inicio</label>
                  <input
                    type="date"
                    value={projectForm.start_date || ""}
                    onChange={(event) => updateProjectForm("start_date", event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">Fecha fin</label>
                  <input
                    type="date"
                    value={projectForm.end_date || ""}
                    onChange={(event) => updateProjectForm("end_date", event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-200">
                Si no existe un equipo base en la base de datos, el backend creará automáticamente
                un equipo general para asociar el proyecto.
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creatingProject}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:bg-slate-700 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={creatingProject}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/10 transition-all hover:from-cyan-600 hover:to-purple-700 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {creatingProject ? "Creando..." : "Crear proyecto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}