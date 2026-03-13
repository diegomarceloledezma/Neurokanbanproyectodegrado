import { useNavigate } from "react-router";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="nk-not-found-container flex items-center justify-center min-h-[60vh]">
      <div className="nk-not-found-content text-center">
        <div className="nk-error-icon-wrapper mb-6 flex justify-center">
          <div className="nk-error-icon p-6 bg-slate-800/50 rounded-full border border-slate-700">
            <AlertCircle className="w-16 h-16 text-cyan-400" />
          </div>
        </div>
        
        <h1 className="nk-error-title text-6xl text-white mb-4">404</h1>
        <h2 className="nk-error-subtitle text-2xl text-slate-300 mb-4">
          Página no encontrada
        </h2>
        <p className="nk-error-message text-slate-400 mb-8 max-w-md mx-auto">
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>
        
        <button
          onClick={() => navigate("/")}
          className="nk-button nk-button--primary inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Home className="w-5 h-5" />
          Volver al Dashboard
        </button>
      </div>
    </div>
  );
}
