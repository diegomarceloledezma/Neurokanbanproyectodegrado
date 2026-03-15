import { useParams } from "react-router";
import { Mail, Briefcase, TrendingUp, CheckCircle, Clock, Award } from "lucide-react";
import { teamMembers, tasks } from "../data/mockData";

export default function MemberProfile() {
  const { memberId } = useParams();
  const member = teamMembers.find(m => m.id === memberId);

  if (!member) {
    return (
      <div className="text-white">
        <p>Miembro no encontrado</p>
      </div>
    );
  }

  const memberTasks = tasks.filter(t => t.assignee?.id === member.id);
  const completedTasks = memberTasks.filter(t => t.status === 'completed');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-3xl">
            {member.name.split(' ').map(n => n[0]).join('')}
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl text-white mb-2">{member.name}</h1>
            <div className="flex items-center gap-4 text-slate-400 mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span>{member.role}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{member.email}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Experiencia</p>
                <p className="text-white">{member.experienceLevel} años</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Disponibilidad</p>
                <p className="text-white">{member.availability}%</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Tareas Activas</p>
                <p className="text-white">{member.activeTasks}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Cumplimiento</p>
                <p className="text-white">{member.completionRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Skills */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl text-white mb-4">Habilidades Técnicas</h2>
            <div className="flex flex-wrap gap-2">
              {member.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Current Load */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Carga Actual</h2>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Capacidad utilizada</span>
                <span className="text-white">{member.currentLoad}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    member.currentLoad > 70
                      ? 'bg-gradient-to-r from-red-500 to-orange-500'
                      : member.currentLoad > 50
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-600'
                  }`}
                  style={{ width: `${member.currentLoad}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Estado</p>
                <p className={`text-sm ${
                  member.currentLoad > 70
                    ? 'text-red-400'
                    : member.currentLoad > 50
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }`}>
                  {member.currentLoad > 70
                    ? 'Sobrecargado'
                    : member.currentLoad > 50
                    ? 'Ocupado'
                    : 'Disponible'}
                </p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Capacidad restante</p>
                <p className="text-white text-sm">{100 - member.currentLoad}%</p>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl text-white">Rendimiento</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">Tasa de Cumplimiento</span>
                  <span className="text-green-400">{member.completionRate}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                    style={{ width: `${member.completionRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">Tareas completadas</p>
                  <p className="text-white text-lg">{completedTasks.length}</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">En progreso</p>
                  <p className="text-white text-lg">{member.activeTasks}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Tasks */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl text-white">Tareas Activas</h2>
            </div>

            {memberTasks.filter(t => t.status !== 'completed').length > 0 ? (
              <div className="space-y-3">
                {memberTasks
                  .filter(t => t.status !== 'completed')
                  .map((task) => (
                    <div
                      key={task.id}
                      className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white">{task.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          task.priority === 'critical'
                            ? 'bg-red-500/10 text-red-400'
                            : task.priority === 'high'
                            ? 'bg-orange-500/10 text-orange-400'
                            : task.priority === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {task.priority === 'critical' ? 'Crítica' : task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>Complejidad: {task.complexity}/10</span>
                        <span>•</span>
                        <span>{task.estimatedHours}h estimadas</span>
                        <span>•</span>
                        <span className={task.status === 'in-progress' ? 'text-cyan-400' : 'text-yellow-400'}>
                          {task.status === 'in-progress' ? 'En progreso' : task.status === 'in-review' ? 'En revisión' : 'Pendiente'}
                        </span>
                      </div>

                      {task.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {task.skills.slice(0, 4).map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 bg-slate-800/30 rounded-lg">
                <p className="text-slate-500">No hay tareas activas</p>
              </div>
            )}
          </div>

          {/* Completed Tasks */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h2 className="text-xl text-white">Tareas Completadas Recientemente</h2>
            </div>

            {completedTasks.length > 0 ? (
              <div className="space-y-3">
                {completedTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white">{task.title}</h3>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      {task.actualHours && task.estimatedHours && (
                        <>
                          <span>
                            {task.actualHours}h / {task.estimatedHours}h
                          </span>
                          <span>•</span>
                          <span className={task.actualHours <= task.estimatedHours ? 'text-green-400' : 'text-yellow-400'}>
                            {task.actualHours <= task.estimatedHours ? 'Dentro del tiempo' : 'Tiempo extendido'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 bg-slate-800/30 rounded-lg">
                <p className="text-slate-500">No hay tareas completadas aún</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
