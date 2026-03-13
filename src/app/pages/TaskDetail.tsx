import { useParams, useNavigate } from "react-router";
import { Calendar, Clock, AlertCircle, User, MessageSquare, Sparkles, TrendingUp } from "lucide-react";
import { tasks } from "../data/mockData";
import { useState } from "react";

export default function TaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const task = tasks.find(t => t.id === taskId);
  const [newComment, setNewComment] = useState("");

  if (!task) {
    return (
      <div className="text-white">
        <p>Tarea no encontrada</p>
      </div>
    );
  }

  const priorityColors = {
    low: 'text-slate-400 bg-slate-500/10',
    medium: 'text-yellow-400 bg-yellow-500/10',
    high: 'text-orange-400 bg-orange-500/10',
    critical: 'text-red-400 bg-red-500/10',
  };

  const priorityLabels = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Crítica',
  };

  const statusLabels = {
    pending: 'Pendiente',
    'in-progress': 'En Progreso',
    'in-review': 'En Revisión',
    completed: 'Completada',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl text-white">{task.title}</h1>
            <span className={`text-sm px-3 py-1 rounded ${priorityColors[task.priority]}`}>
              {priorityLabels[task.priority]}
            </span>
          </div>
          <p className="text-slate-400">{task.description}</p>
        </div>
        <button
          onClick={() => navigate(`/recommendation/${taskId}`)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Sparkles className="w-4 h-4" />
          Nueva Recomendación
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Información de la Tarea</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-slate-400 text-sm mb-1">Prioridad</p>
                <span className={`inline-block text-sm px-3 py-1 rounded ${priorityColors[task.priority]}`}>
                  {priorityLabels[task.priority]}
                </span>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Estado</p>
                <p className="text-white">{statusLabels[task.status]}</p>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Complejidad</p>
                <div className="flex gap-1 items-center">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-4 rounded ${
                        i < task.complexity
                          ? 'bg-gradient-to-t from-cyan-500 to-purple-600'
                          : 'bg-slate-700'
                      }`}
                    ></div>
                  ))}
                  <span className="text-white ml-2">{task.complexity}/10</span>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Tiempo Estimado</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <p className="text-white">{task.estimatedHours}h</p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Fecha Límite</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <p className="text-white">
                    {new Date(task.deadline).toLocaleDateString('es-ES', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>

              {task.actualHours && (
                <div>
                  <p className="text-slate-400 text-sm mb-1">Tiempo Real</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <p className="text-white">{task.actualHours}h</p>
                  </div>
                </div>
              )}
            </div>

            {/* Skills Required */}
            {task.skills.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-slate-400 text-sm mb-3">Skills Requeridas</p>
                <div className="flex flex-wrap gap-2">
                  {task.skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm border border-cyan-500/20"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status History */}
          {task.statusHistory && task.statusHistory.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl text-white mb-4">Historial de Estados</h2>
              <div className="space-y-3">
                {task.statusHistory.map((change, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                    <div className="flex-1">
                      <p className="text-white">{change.status}</p>
                      <p className="text-slate-400 text-sm">{change.user}</p>
                    </div>
                    <p className="text-slate-500 text-sm">
                      {new Date(change.timestamp).toLocaleDateString('es-ES', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Comentarios</h2>
            
            {task.comments && task.comments.length > 0 ? (
              <div className="space-y-4 mb-4">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs">
                        {comment.author.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-white text-sm">{comment.author}</p>
                        <p className="text-slate-500 text-xs">
                          {new Date(comment.timestamp).toLocaleDateString('es-ES', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="text-slate-300 text-sm">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm mb-4">No hay comentarios aún</p>
            )}

            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="Escribe un comentario..."
              />
              <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-all">
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assignee */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Responsable</h3>
            {task.assignee ? (
              <div
                className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-all"
                onClick={() => navigate(`/member/${task.assignee?.id}`)}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white">
                  {task.assignee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-white">{task.assignee.name}</p>
                  <p className="text-slate-400 text-sm">{task.assignee.role}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-4 bg-slate-800/50 rounded-lg">
                <p className="text-slate-500 text-sm">No asignado</p>
              </div>
            )}
          </div>

          {/* Performance Comparison */}
          {task.actualHours && task.estimatedHours && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-white mb-4">Rendimiento</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Tiempo Estimado</span>
                  <span className="text-white">{task.estimatedHours}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Tiempo Real</span>
                  <span className="text-white">{task.actualHours}h</span>
                </div>
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Diferencia</span>
                    <span className={task.actualHours <= task.estimatedHours ? 'text-green-400' : 'text-red-400'}>
                      {task.actualHours <= task.estimatedHours ? '-' : '+'}
                      {Math.abs(task.actualHours - task.estimatedHours)}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-white mb-4">Acciones Rápidas</h3>
            <div className="space-y-2">
              <button className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left">
                Cambiar Estado
              </button>
              <button className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left">
                Editar Tarea
              </button>
              <button className="w-full py-2 px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all text-sm text-left">
                Duplicar Tarea
              </button>
              <button className="w-full py-2 px-4 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-sm text-left">
                Eliminar Tarea
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
