import { useState } from "react";
import { useNavigate } from "react-router";
import { Mail, Lock } from "lucide-react";
import logo from "../../assets/1ef90e5cd9e0c309c8c60ba91e7c99fbee854655.png";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/");
  };

  return (
    <div className="nk-login-page min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="nk-login-container w-full max-w-md">
        <div className="nk-login-header text-center mb-8">
          <img src={logo} alt="NeuroKanban" className="nk-logo h-16 mx-auto mb-6" />
          <h1 className="nk-login-title text-3xl text-white mb-2">Bienvenido de vuelta</h1>
          <p className="nk-login-subtitle text-slate-400">Ingresa tus credenciales para continuar</p>
        </div>

        <div className="nk-login-card bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="nk-login-form space-y-6">
            <div className="nk-form-group">
              <label className="nk-form-label block text-sm text-slate-300 mb-2">
                Correo o Usuario
              </label>
              <div className="nk-input-wrapper relative">
                <Mail className="nk-input-icon absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="nk-input w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            <div className="nk-form-group">
              <label className="nk-form-label block text-sm text-slate-300 mb-2">
                Contraseña
              </label>
              <div className="nk-input-wrapper relative">
                <Lock className="nk-input-icon absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="nk-input w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="nk-button nk-button--primary w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20"
            >
              Iniciar Sesión
            </button>
          </form>

          <div className="nk-login-footer mt-6 text-center">
            <p className="nk-login-register-text text-slate-400 text-sm">
              ¿No tienes cuenta?{" "}
              <button
                onClick={() => navigate("/register")}
                className="nk-login-register-link text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Regístrate aquí
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}