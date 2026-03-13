import { Outlet, NavLink, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  Users, 
  BarChart3, 
  History, 
  Settings, 
  Bell,
  LogOut,
} from "lucide-react";
import logo from "figma:asset/1ef90e5cd9e0c309c8c60ba91e7c99fbee854655.png";

const menuItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Proyectos", path: "/project/proj-1", icon: FolderKanban },
  { name: "Tareas", path: "/kanban/proj-1", icon: CheckSquare },
  { name: "Equipo", path: "/member/1", icon: Users },
  { name: "Métricas", path: "/metrics", icon: BarChart3 },
  { name: "Historial", path: "/history", icon: History },
];

export default function MainLayout() {
  const navigate = useNavigate();

  return (
    <div className="nk-layout flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="nk-sidebar w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="nk-sidebar__logo-wrapper p-6 border-b border-slate-800">
          <img src={logo} alt="NeuroKanban" className="nk-logo h-10" />
        </div>
        
        <nav className="nk-sidebar__nav flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
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
          ))}
        </nav>

        <div className="nk-sidebar__footer p-4 border-t border-slate-800">
          <button
            onClick={() => navigate("/login")}
            className="nk-logout-button flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/50 w-full transition-all"
          >
            <LogOut className="nk-logout-button__icon w-5 h-5" />
            <span className="nk-logout-button__text">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="nk-main flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="nk-header h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
          <div className="nk-header__welcome text-slate-400 text-sm">
            Bienvenido, <span className="nk-header__username text-slate-200">Líder de Equipo</span>
          </div>
          
          <div className="nk-header__actions flex items-center gap-4">
            <button className="nk-notification-button relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all">
              <Bell className="nk-notification-button__icon w-5 h-5" />
              <span className="nk-notification-badge absolute top-1 right-1 w-2 h-2 bg-cyan-500 rounded-full"></span>
            </button>
            
            <div className="nk-user-avatar-wrapper flex items-center gap-3">
              <div className="nk-user-avatar w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm">
                LT
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="nk-content flex-1 overflow-auto bg-slate-950 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}