import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Calendar, Users, TrendingUp, Plus, Sparkles } from "lucide-react";
import { getProjectById, type ProjectResponse } from "../services/projectService";
import { getAccessToken } from "../services/sessionService";

const formatDate = (date?: string | null) => {
  if (!date) return "No definida";

  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const statusLabels: Record<string, string> = {
  planned: "Planificado",
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function Project() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        setError("No se encontró el identificador del proyecto");
        setLoading(false);
        return;
      }

      const token = getAccessToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const data = await getProjectById(id, token);
        setProject(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error al cargar el proyecto");
        }
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="text-slate-300">
        Cargando proyecto...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-red-300">
        {error || "Proyecto no encontrado"}
      </div>
    );
  }

  const displayStatus = statusLabels[project.status] ?? project.status;
  const areaName = project.area?.name ?? "No definida";
  const creatorName = project.creator?.full_name ?? "No disponible";
  const creatorRole = project.creator?.global_role?.name ?? "Sin rol";

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl text-white mb-2">{project.name}</h1>
            <p className="text-slate-400">
              {project.description || "Este proyecto aún no tiene una descripción registrada."}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/task/create/${project.id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              Crear tarea
            </button>

            <button
              onClick={() => navigate(`/recommendation/task-2`)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Ver recomendaciones
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Estado del proyecto</p>
              <p className="text-white text-xl">{displayStatus}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Área del proyecto</p>
              <p className="text-white text-xl">{areaName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Creado por</p>
              <p className="text-white text-xl">{creatorName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Información general</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Fecha de inicio</p>
            <p className="text-white">{formatDate(project.start_date)}</p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Fecha de finalización</p>
            <p className="text-white">{formatDate(project.end_date)}</p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Responsable de creación</p>
            <p className="text-white">{creatorName}</p>
            <p className="text-slate-500 text-sm mt-1">{creatorRole}</p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Registro del proyecto</p>
            <p className="text-white">{formatDate(project.created_at)}</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/kanban/${project.id}`)}
          className="w-full mt-6 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
        >
          Ver tablero Kanban
        </button>
      </div>
    </div>
  );
}