import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { login } from "../services/authService";
import { isAuthenticated } from "../services/sessionService";
import BrandLogo from "../components/BrandLogo";

type LocationState = {
  from?: string;
};

function sanitizeRedirectTarget(target?: string | null): string {
  if (!target) return "/";
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  if (target.startsWith("/login")) return "/";
  return target;
}

function getSessionMessage(reason?: string | null): string {
  if (reason === "expired") {
    return "Tu sesión expiró. Vuelve a iniciar sesión para continuar trabajando en NeuroKanban.";
  }

  if (reason === "invalid") {
    return "Tu sesión ya no es válida. Por seguridad, inicia sesión nuevamente.";
  }

  return "";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const redirectTarget = useMemo(() => {
    const stateTarget = (location.state as LocationState | null)?.from;
    const queryTarget = searchParams.get("from");
    return sanitizeRedirectTarget(queryTarget ?? stateTarget ?? "/");
  }, [location.state, searchParams]);

  const sessionMessage = getSessionMessage(searchParams.get("session"));

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login({
        username_or_email: usernameOrEmail.trim(),
        password,
      });

      navigate(redirectTarget, { replace: true });
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl shadow-cyan-950/20">
        <div className="mb-8">
          <BrandLogo variant="auth" centered className="mb-7" />

          <div className="text-center">
            <h1 className="text-3xl text-white mb-2">Iniciar sesión</h1>
            <p className="text-slate-400">
              Accede a NeuroKanban con tu usuario o correo institucional.
            </p>
          </div>
        </div>

        {sessionMessage && (
          <div className="mb-5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-cyan-200 text-sm">
            {sessionMessage}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-slate-300 text-sm mb-2">Usuario o correo</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Ingresa tu usuario o correo"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                className="w-full pl-10 pr-12 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="text-sm text-slate-400 mt-6 text-center">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-cyan-400 hover:text-cyan-300">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
