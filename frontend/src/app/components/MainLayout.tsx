import { Outlet, NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  FolderOpen,
  KanbanSquare,
  Users,
  BarChart3,
  History,
  BrainCircuit,
  LogOut,
} from "lucide-react";
import { getCurrentUser, clearSession } from "../services/sessionService";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  leader: "Líder de equipo",
  member: "Integrante del equipo",
};

export default function MainLayout() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const displayRole = currentUser?.role_name
    ? roleLabels[currentUser.role_name] ?? currentUser.role_name
    : currentUser?.global_role?.name
    ? roleLabels[currentUser.global_role.name] ?? currentUser.global_role.name
    : "Sin rol";

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const menuItems = [
    {
      to: "/",
      label: "Panel principal",
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: "/projects",
      label: "Proyectos",
      icon: FolderOpen,
    },
    {
      to: "/team",
      label: "Equipo",
      icon: Users,
    },
    {
      to: "/kanban-projects",
      label: "Tablero Kanban",
      icon: KanbanSquare,
    },
    {
      to: "/metrics",
      label: "Métricas",
      icon: BarChart3,
    },
    {
      to: "/history",
      label: "Historial de decisiones",
      icon: History,
    },
    {
      to: "/modelo-ia",
      label: "Modelo IA",
      icon: BrainCircuit,
    },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white flex">
      <aside className="w-64 bg-[#081225] border-r border-slate-800 flex flex-col">
        <div className="px-6 py-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white">NeuroKanban</h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 mb-3">
            <p className="text-white font-semibold">
              {currentUser?.full_name || currentUser?.username || "Usuario"}
            </p>
            <p className="text-slate-400 text-sm">{displayRole}</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all text-slate-200"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1">
        <header className="border-b border-slate-800 px-8 py-5 bg-[#081225]">
          <p className="text-slate-300 text-lg">
            Hola,{" "}
            <span className="text-white font-semibold">
              {currentUser?.full_name || currentUser?.username || "Usuario"}
            </span>
            <span className="text-slate-500"> · {displayRole}</span>
          </p>
        </header>

        <section className="p-8">
          <Outlet />
        </section>
      </main>
    </div>
  );
}