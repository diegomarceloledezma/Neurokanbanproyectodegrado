import { useParams, useNavigate } from "react-router";
import { Plus, AlertCircle } from "lucide-react";
import { tasks } from "../data/mockData";

const columns = [
  { id: 'pending', name: 'Pendiente', color: 'border-slate-600' },
  { id: 'in-progress', name: 'En Progreso', color: 'border-cyan-500' },
  { id: 'in-review', name: 'En Revisión', color: 'border-purple-500' },
  { id: 'completed', name: 'Finalizada', color: 'border-green-500' },
];

const priorityColors = {
  low: 'bg-slate-600',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const priorityLabels = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export default function KanbanBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const projectTasks = tasks.filter(t => t.projectId === projectId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-white mb-2">Tablero Kanban</h1>
          <p className="text-slate-400">Gestiona el flujo de trabajo de tu proyecto</p>
        </div>
        <button
          onClick={() => navigate(`/task/create/${projectId}`)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          Nueva Tarea
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => {
          const columnTasks = projectTasks.filter(t => t.status === column.id);
          
          return (
            <div key={column.id} className="flex flex-col">
              <div className={`bg-slate-900 border-t-4 ${column.color} border-x border-slate-800 rounded-t-xl p-4`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-white">{column.name}</h2>
                  <span className="text-slate-400 text-sm bg-slate-800 px-2 py-1 rounded">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 bg-slate-900/50 border-x border-b border-slate-800 rounded-b-xl p-4 space-y-3 min-h-[500px]">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all cursor-pointer group"
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    {/* Priority indicator */}
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-xs px-2 py-1 rounded ${priorityColors[task.priority]} bg-opacity-20 text-${task.priority === 'low' ? 'slate' : task.priority === 'medium' ? 'yellow' : task.priority === 'high' ? 'orange' : 'red'}-400`}>
                        {priorityLabels[task.priority]}
                      </span>
                      {task.priority === 'critical' && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>

                    {/* Task title */}
                    <h3 className="text-white mb-2 group-hover:text-cyan-400 transition-colors">
                      {task.title}
                    </h3>

                    {/* Task metadata */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Complejidad:</span>
                        <div className="flex gap-1">
                          {[...Array(10)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-3 rounded ${
                                i < task.complexity
                                  ? 'bg-gradient-to-t from-cyan-500 to-purple-600'
                                  : 'bg-slate-700'
                              }`}
                            ></div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Tiempo estimado:</span>
                        <span className="text-slate-300">{task.estimatedHours}h</span>
                      </div>

                      {task.assignee && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                            {task.assignee.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-slate-300 text-sm">{task.assignee.name}</span>
                        </div>
                      )}

                      {/* Skills tags */}
                      {task.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {task.skills.slice(0, 3).map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                          {task.skills.length > 3 && (
                            <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded">
                              +{task.skills.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-slate-600">
                    <p className="text-sm">No hay tareas</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
