import { useParams, useNavigate } from "react-router";
import { Calendar, Users, TrendingUp, Plus, Sparkles } from "lucide-react";
import { projects, tasks } from "../data/mockData";

export default function Project() {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="text-white">
        <p>Proyecto no encontrado</p>
      </div>
    );
  }

  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
  const totalTasks = projectTasks.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl text-white mb-2">{project.name}</h1>
            <p className="text-slate-400">{project.description}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/task/create/${project.id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              Crear Tarea
            </button>
            <button
              onClick={() => navigate(`/recommendation/task-2`)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Ver Recomendaciones
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Progreso General</p>
              <p className="text-white text-xl">{project.progress}%</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Sprint Actual</p>
              <p className="text-white text-xl">{project.sprint}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Integrantes</p>
              <p className="text-white text-xl">{project.members.length}</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">
              {completedTasks} de {totalTasks} tareas completadas
            </p>
            <p className="text-slate-400 text-sm">{project.progress}%</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600"
              style={{ width: `${project.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Integrantes del Equipo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {project.members.map((member) => (
            <div
              key={member.id}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all cursor-pointer"
              onClick={() => navigate(`/member/${member.id}`)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-white">{member.name}</p>
                  <p className="text-slate-400 text-sm">{member.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{member.activeTasks} tareas activas</span>
                <span className={`${member.currentLoad > 70 ? 'text-red-400' : 'text-cyan-400'}`}>
                  {member.currentLoad}% carga
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sprint Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl text-white mb-4">Resumen del Sprint</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Fecha de Inicio</p>
            <p className="text-white">{new Date(project.startDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg">
            <p className="text-slate-400 text-sm mb-1">Fecha de Fin</p>
            <p className="text-white">{new Date(project.endDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/kanban/${project.id}`)}
          className="w-full mt-6 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
        >
          Ver Tablero Kanban
        </button>
      </div>
    </div>
  );
}
