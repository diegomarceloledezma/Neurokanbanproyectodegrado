import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Sparkles, Save, AlertCircle } from "lucide-react";

const priorityOptions = [
  { value: 'low', label: 'Baja', color: 'text-slate-400' },
  { value: 'medium', label: 'Media', color: 'text-yellow-400' },
  { value: 'high', label: 'Alta', color: 'text-orange-400' },
  { value: 'critical', label: 'Crítica', color: 'text-red-400' },
];

export default function CreateTask() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    complexity: 5,
    estimatedHours: 8,
    deadline: "",
    taskType: "",
    skills: "",
    dependencies: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/kanban/${projectId}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Crear Nueva Tarea</h1>
        <p className="text-slate-400">Define los detalles de la tarea y obtén recomendaciones inteligentes</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Título de la Tarea *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="Ej: Implementar sistema de autenticación"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
              placeholder="Describe los detalles de la tarea..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Prioridad *
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              >
                {priorityOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Task Type */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Tipo de Tarea
              </label>
              <select
                name="taskType"
                value={formData.taskType}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              >
                <option value="">Selecciona un tipo</option>
                <option value="feature">Nueva Funcionalidad</option>
                <option value="bug">Corrección de Bug</option>
                <option value="refactor">Refactorización</option>
                <option value="testing">Testing</option>
                <option value="documentation">Documentación</option>
                <option value="devops">DevOps</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Complexity */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Complejidad (1-10) *
              </label>
              <input
                type="number"
                name="complexity"
                value={formData.complexity}
                onChange={handleChange}
                min="1"
                max="10"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              />
            </div>

            {/* Estimated Hours */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Tiempo Estimado (hrs) *
              </label>
              <input
                type="number"
                name="estimatedHours"
                value={formData.estimatedHours}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Fecha Límite *
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                required
              />
            </div>
          </div>

          {/* Skills Required */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Skills Requeridas
            </label>
            <input
              type="text"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="Ej: React, TypeScript, Node.js (separadas por coma)"
            />
            <p className="text-slate-500 text-xs mt-1">Separa cada skill con una coma</p>
          </div>

          {/* Dependencies */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Dependencias
            </label>
            <input
              type="text"
              name="dependencies"
              value={formData.dependencies}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="IDs de tareas de las que depende esta tarea"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-cyan-400" />
            <p className="text-slate-300 text-sm">
              Usa el análisis inteligente para obtener recomendaciones de asignación
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Save className="w-4 h-4" />
              Guardar Tarea
            </button>

            <button
              type="button"
              onClick={() => navigate(`/recommendation/task-2`)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Analizar Tarea
            </button>

            <button
              type="button"
              onClick={() => navigate(`/recommendation/task-2`)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              Recomendar Asignación
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
