import { useEffect, useState } from "react";
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
  X,
  ClipboardList,
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const roleName = (
    currentUser?.role_name ||
    currentUser?.global_role?.name ||
    ""
  ).toLowerCase();

  const displayRole = currentUser?.role_name
    ? roleLabels[currentUser.role_name] ?? currentUser.role_name
    : currentUser?.global_role?.name
    ? roleLabels[currentUser.global_role.name] ?? currentUser.global_role.name
    : "Sin rol";

  const openLogoutConfirm = () => {
    setShowLogoutConfirm(true);
  };

  const closeLogoutConfirm = () => {
    setShowLogoutConfirm(false);
  };

  const confirmLogout = () => {
    clearSession();
    navigate("/login");
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowLogoutConfirm(false);
      }
    };

    if (showLogoutConfirm) {
      window.addEventListener("keydown", handleEscape);
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showLogoutConfirm]);

  const menuItems = [
    {
      to: "/",
      label: "Panel principal",
      icon: LayoutDashboard,
      end: true,
      roles: ["admin", "leader", "member"],
    },
    {
      to: "/my-tasks",
      label: "Mis tareas",
      icon: ClipboardList,
      roles: ["admin", "leader", "member"],
    },
    {
      to: "/projects",
      label: "Proyectos",
      icon: FolderOpen,
      roles: ["admin", "leader", "member"],
    },
    {
      to: "/team",
      label: "Equipo",
      icon: Users,
      roles: ["admin", "leader"],
    },
    {
      to: "/kanban-projects",
      label: "Tablero Kanban",
      icon: KanbanSquare,
      roles: ["admin", "leader", "member"],
    },
    {
      to: "/metrics",
      label: "Métricas",
      icon: BarChart3,
      roles: ["admin", "leader"],
    },
    {
      to: "/history",
      label: "Historial de decisiones",
      icon: History,
      roles: ["admin", "leader"],
    },
    {
      to: "/modelo-ia",
      label: "Modelo IA",
      icon: BrainCircuit,
      roles: ["admin", "leader"],
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => item.roles.includes(roleName));

  return (
    <div className="h-screen bg-[#020617] text-white overflow-hidden">
      <aside className="fixed left-0 top-0 z-30 h-screen w-64 bg-[#081225] border-r border-slate-800 flex flex-col">
        <div className="px-6 py-6 border-b border-slate-800 shrink-0">
          <h1 className="text-2xl font-bold text-white">NeuroKanban</h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${ isActive ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "text-slate-300 hover:bg-slate-800/60" }` } >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 pb-4 pt-3 border-t border-slate-800 shrink-0 bg-[#081225]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 mb-3">
            <p className="text-white font-semibold">
              {currentUser?.full_name || currentUser?.username || "Usuario"}
            </p>
            <p className="text-slate-400 text-sm">{displayRole}</p>
          </div>

          <button onClick={openLogoutConfirm} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all text-slate-200" >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="ml-64 h-screen overflow-y-auto">
        <header className="border-b border-slate-800 px-8 py-5 bg-[#081225] sticky top-0 z-20">
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

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#081225] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
              <h2 className="text-xl font-semibold text-white">
                Confirmar cierre de sesión
              </h2>

              <button onClick={closeLogoutConfirm} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all" >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-slate-300 leading-relaxed">
                ¿Estás seguro de que deseas cerrar sesión?
              </p>
              <p className="text-slate-500 text-sm mt-2">
                Tendrás que volver a iniciar sesión para entrar nuevamente.
              </p>
            </div>

            <div className="px-6 py-5 border-t border-slate-800 flex items-center justify-end gap-3">
              <button onClick={closeLogoutConfirm} className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all" >
                Cancelar
              </button>

              <button onClick={confirmLogout} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all" >
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}