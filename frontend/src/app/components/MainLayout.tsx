import { Outlet, NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  BarChart3,
  History,
  Bell,
  LogOut,
} from "lucide-react";
import { useMemo } from "react";
import { clearSession, getStoredUser } from "../services/sessionService";

export default function MainLayout() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  const menuItems = useMemo(
    () => [
      { name: "Panel principal", path: "/", icon: LayoutDashboard, disabled: false },
      { name: "Proyectos", path: "/projects", icon: FolderKanban, disabled: false },
      { name: "Tablero Kanban", path: "/kanban", icon: CheckSquare, disabled: false },
      { name: "Equipo", path: "/team", icon: Users, disabled: false },
      { name: "Métricas", path: "/metrics", icon: BarChart3, disabled: false },
      { name: "Historial de decisiones", path: "/history", icon: History, disabled: false },
    ],
    []
  );

  const displayName = currentUser?.full_name ?? "Usuario";

  const roleLabels: Record<string, string> = {
    leader: "Líder de equipo",
    member: "Integrante del equipo",
    admin: "Administrador",
  };

  const rawRole =
    currentUser?.global_role?.name ??
    currentUser?.role_name ??
    null;

  const displayRole = rawRole
    ? roleLabels[rawRole] ?? rawRole
    : "Sin rol";

  const initials = displayName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    const confirmed = window.confirm("¿Estás seguro de que deseas cerrar sesión?");

    if (!confirmed) return;

    clearSession();
    navigate("/login");
  };

  return (
    <div className="nk-layout flex h-screen bg-slate-950">
      <aside className="nk-sidebar w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="nk-sidebar__logo-wrapper p-6 border-b border-slate-800">
          <img
            src={new URL("../../assets/1ef90e5cd9e0c309c8c60ba91e7c99fbee854655.png", import.meta.url).href}
            alt="NeuroKanban"
            className="nk-logo h-10"
          />
        </div>

        <nav className="nk-sidebar__nav flex-1 p-4 space-y-1">
          {menuItems.map((item) =>
            item.disabled ? (
              <button
                key={item.name}
                type="button"
                disabled
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 cursor-not-allowed"
              >
                <item.icon className="nk-nav-item__icon w-5 h-5" />
                <span className="nk-nav-item__text">{item.name}</span>
              </button>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `nk-nav-item flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "nk-nav-item--active bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 border border-cyan-500/20"
                      : "nk-nav-item--inactive text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`
                }
              >
                <item.icon className="nk-nav-item__icon w-5 h-5" />
                <span className="nk-nav-item__text">{item.name}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className="nk-sidebar__footer p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="nk-logout-button flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/50 w-full transition-all"
          >
            <LogOut className="nk-logout-button__icon w-5 h-5" />
            <span className="nk-logout-button__text">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="nk-main flex-1 flex flex-col overflow-hidden">
        <header className="nk-header h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
          <div className="nk-header__welcome text-slate-400 text-sm">
            Hola, <span className="nk-header__username text-slate-200">{displayName}</span>
            <span className="text-slate-500"> · {displayRole}</span>
          </div>

          <div className="nk-header__actions flex items-center gap-4">
            <button
              aria-label="Notificaciones"
              className="nk-notification-button relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            >
              <Bell className="nk-notification-button__icon w-5 h-5" />
              <span className="nk-notification-badge absolute top-1 right-1 w-2 h-2 bg-cyan-500 rounded-full"></span>
            </button>

            <div className="nk-user-avatar-wrapper flex items-center gap-3">
              <div className="nk-user-avatar w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="nk-content flex-1 overflow-auto bg-slate-950 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}