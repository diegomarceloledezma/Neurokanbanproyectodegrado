export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  skills: string[];
  experienceLevel: number;
  availability: number;
  activeTasks: number;
  completionRate: number;
  currentLoad: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  complexity: number;
  estimatedHours: number;
  actualHours?: number;
  deadline: string;
  status: 'pending' | 'in-progress' | 'in-review' | 'completed';
  assignee?: TeamMember;
  skills: string[];
  dependencies?: string[];
  projectId: string;
  createdAt: string;
  comments?: Comment[];
  statusHistory?: StatusChange[];
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface StatusChange {
  status: string;
  timestamp: string;
  user: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  members: TeamMember[];
  sprint: string;
  startDate: string;
  endDate: string;
}

export interface Recommendation {
  member: TeamMember;
  score: number;
  reason: string;
  availability: string;
  currentLoad: string;
  matchingSkills: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Ana García',
    email: 'ana.garcia@neurokanban.com',
    role: 'Senior Frontend Developer',
    skills: ['React', 'TypeScript', 'CSS', 'UI/UX'],
    experienceLevel: 8,
    availability: 75,
    activeTasks: 3,
    completionRate: 94,
    currentLoad: 65,
  },
  {
    id: '2',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@neurokanban.com',
    role: 'Backend Developer',
    skills: ['Node.js', 'Python', 'PostgreSQL', 'API Design'],
    experienceLevel: 6,
    availability: 90,
    activeTasks: 2,
    completionRate: 88,
    currentLoad: 45,
  },
  {
    id: '3',
    name: 'María López',
    email: 'maria.lopez@neurokanban.com',
    role: 'Full Stack Developer',
    skills: ['React', 'Node.js', 'MongoDB', 'Docker'],
    experienceLevel: 5,
    availability: 60,
    activeTasks: 4,
    completionRate: 91,
    currentLoad: 80,
  },
  {
    id: '4',
    name: 'Diego Ruiz',
    email: 'diego.ruiz@neurokanban.com',
    role: 'DevOps Engineer',
    skills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD'],
    experienceLevel: 7,
    availability: 85,
    activeTasks: 2,
    completionRate: 96,
    currentLoad: 50,
  },
  {
    id: '5',
    name: 'Laura Fernández',
    email: 'laura.fernandez@neurokanban.com',
    role: 'QA Engineer',
    skills: ['Testing', 'Selenium', 'Jest', 'Cypress'],
    experienceLevel: 4,
    availability: 95,
    activeTasks: 1,
    completionRate: 89,
    currentLoad: 30,
  },
];

export const projects: Project[] = [
  {
    id: 'proj-1',
    name: 'E-commerce Platform',
    description: 'Plataforma de comercio electrónico con pasarela de pagos',
    progress: 67,
    members: [teamMembers[0], teamMembers[1], teamMembers[2]],
    sprint: 'Sprint 8 - Q1 2026',
    startDate: '2026-03-01',
    endDate: '2026-03-15',
  },
  {
    id: 'proj-2',
    name: 'Mobile App Redesign',
    description: 'Rediseño completo de la aplicación móvil',
    progress: 42,
    members: [teamMembers[0], teamMembers[3], teamMembers[4]],
    sprint: 'Sprint 3 - Q1 2026',
    startDate: '2026-03-08',
    endDate: '2026-03-22',
  },
];

export const tasks: Task[] = [
  {
    id: 'task-1',
    title: 'Implementar autenticación OAuth',
    description: 'Integrar sistema de autenticación con Google y GitHub',
    priority: 'high',
    complexity: 7,
    estimatedHours: 16,
    actualHours: 12,
    deadline: '2026-03-18',
    status: 'in-progress',
    assignee: teamMembers[1],
    skills: ['Node.js', 'OAuth', 'API Design'],
    projectId: 'proj-1',
    createdAt: '2026-03-10',
    comments: [
      {
        id: 'c1',
        author: 'Carlos Mendoza',
        content: 'Ya tengo configurado el cliente de Google OAuth',
        timestamp: '2026-03-12T10:30:00',
      },
    ],
    statusHistory: [
      { status: 'pending', timestamp: '2026-03-10T09:00:00', user: 'System' },
      { status: 'in-progress', timestamp: '2026-03-11T14:00:00', user: 'Carlos Mendoza' },
    ],
  },
  {
    id: 'task-2',
    title: 'Diseñar componente de carrito de compras',
    description: 'Crear componente responsive para el carrito con animaciones',
    priority: 'medium',
    complexity: 5,
    estimatedHours: 12,
    deadline: '2026-03-20',
    status: 'pending',
    skills: ['React', 'TypeScript', 'CSS'],
    projectId: 'proj-1',
    createdAt: '2026-03-11',
  },
  {
    id: 'task-3',
    title: 'Optimizar queries de base de datos',
    description: 'Revisar y optimizar queries lentas identificadas en producción',
    priority: 'critical',
    complexity: 8,
    estimatedHours: 20,
    deadline: '2026-03-16',
    status: 'in-review',
    assignee: teamMembers[1],
    skills: ['PostgreSQL', 'Performance'],
    projectId: 'proj-1',
    createdAt: '2026-03-09',
  },
  {
    id: 'task-4',
    title: 'Configurar CI/CD pipeline',
    description: 'Implementar pipeline de integración continua con GitHub Actions',
    priority: 'high',
    complexity: 6,
    estimatedHours: 10,
    deadline: '2026-03-19',
    status: 'pending',
    skills: ['Docker', 'CI/CD', 'AWS'],
    projectId: 'proj-2',
    createdAt: '2026-03-12',
  },
  {
    id: 'task-5',
    title: 'Crear suite de tests E2E',
    description: 'Desarrollar tests end-to-end para flujos críticos',
    priority: 'medium',
    complexity: 6,
    estimatedHours: 14,
    deadline: '2026-03-22',
    status: 'in-progress',
    assignee: teamMembers[4],
    skills: ['Testing', 'Cypress'],
    projectId: 'proj-2',
    createdAt: '2026-03-10',
  },
  {
    id: 'task-6',
    title: 'Implementar sistema de notificaciones',
    description: 'Sistema real-time de notificaciones con WebSockets',
    priority: 'low',
    complexity: 7,
    estimatedHours: 18,
    deadline: '2026-03-25',
    status: 'pending',
    skills: ['Node.js', 'WebSocket', 'React'],
    projectId: 'proj-1',
    createdAt: '2026-03-13',
  },
  {
    id: 'task-7',
    title: 'Migrar a TypeScript',
    description: 'Migrar componentes legacy a TypeScript',
    priority: 'medium',
    complexity: 5,
    estimatedHours: 24,
    deadline: '2026-03-28',
    status: 'completed',
    assignee: teamMembers[0],
    skills: ['TypeScript', 'React'],
    projectId: 'proj-2',
    createdAt: '2026-02-28',
    actualHours: 22,
  },
];

export const getRecommendations = (taskId: string): Recommendation[] => {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return [];

  return [
    {
      member: teamMembers[1],
      score: 92,
      reason: 'Tiene el 100% de las skills requeridas y excelente disponibilidad',
      availability: '90% disponible',
      currentLoad: '45% de carga actual',
      matchingSkills: task.skills.filter(s => teamMembers[1].skills.includes(s)),
      riskLevel: 'low',
    },
    {
      member: teamMembers[4],
      score: 78,
      reason: 'Alta disponibilidad y baja carga de trabajo, aunque le faltan algunas skills',
      availability: '95% disponible',
      currentLoad: '30% de carga actual',
      matchingSkills: task.skills.filter(s => teamMembers[4].skills.includes(s)),
      riskLevel: 'medium',
    },
    {
      member: teamMembers[0],
      score: 65,
      reason: 'Skills coinciden parcialmente, pero tiene alta carga de trabajo actual',
      availability: '75% disponible',
      currentLoad: '65% de carga actual',
      matchingSkills: task.skills.filter(s => teamMembers[0].skills.includes(s)),
      riskLevel: 'medium',
    },
  ];
};

export interface DecisionRecord {
  id: string;
  task: Task;
  systemRecommendation: TeamMember;
  leaderChoice: TeamMember;
  completedOnTime: boolean;
  notes: string;
  timestamp: string;
}

export const decisionHistory: DecisionRecord[] = [
  {
    id: 'dec-1',
    task: tasks[6],
    systemRecommendation: teamMembers[0],
    leaderChoice: teamMembers[0],
    completedOnTime: true,
    notes: 'Siguió la recomendación del sistema. Excelente resultado.',
    timestamp: '2026-02-28T09:00:00',
  },
  {
    id: 'dec-2',
    task: tasks[0],
    systemRecommendation: teamMembers[1],
    leaderChoice: teamMembers[1],
    completedOnTime: true,
    notes: 'Sistema recomendó correctamente basándose en skills de backend.',
    timestamp: '2026-03-11T14:00:00',
  },
];
