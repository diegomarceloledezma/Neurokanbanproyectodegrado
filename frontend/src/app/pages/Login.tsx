import { useState } from "react";
import { useNavigate } from "react-router";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { loginUser } from "../services/authService";
import { saveSession } from "../services/sessionService";

const logo = new URL("../../assets/1ef90e5cd9e0c309c8c60ba91e7c99fbee854655.png", import.meta.url).href;

export default function Login() {
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const data = await loginUser({
        username_or_email: usernameOrEmail,
        password,
      });

      saveSession(data.access_token, data.user);

      navigate("/");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nk-login-page min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="nk-login-container w-full max-w-md">
        <div className="nk-login-header text-center mb-8">
          <img src={logo} alt="NeuroKanban" className="nk-logo h-16 mx-auto mb-6" />
          <h1 className="nk-login-title text-3xl text-white mb-2">Bienvenido nuevamente</h1>
          <p className="nk-login-subtitle text-slate-400">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <div className="nk-login-card bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="nk-login-form space-y-6">
            <div className="nk-form-group">
              <label className="nk-form-label block text-sm text-slate-300 mb-2">
                Correo o usuario
              </label>
              <div className="nk-input-wrapper relative">
                <Mail className="nk-input-icon absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="nk-input w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  placeholder="tu_correo@empresa.com o tu usuario"
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="nk-input w-full pl-11 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="nk-error-message rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="nk-submit-button w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-600 hover:to-purple-700 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>

          <div className="nk-register-link-wrapper mt-6 text-center">
            <p className="text-slate-400 text-sm">
              ¿No tienes cuenta?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Crear cuenta
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}