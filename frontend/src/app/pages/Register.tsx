import { useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { register } from "../services/authService";

function validatePassword(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (!/[A-Z]/.test(password)) return "La contraseña debe incluir al menos una mayúscula";
  if (!/[a-z]/.test(password)) return "La contraseña debe incluir al menos una minúscula";
  if (!/[0-9]/.test(password)) return "La contraseña debe incluir al menos un número";
  return null;
}

export default function Register() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordValidationMessage = useMemo(() => validatePassword(password), [password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (passwordValidationMessage) {
      setError(passwordValidationMessage);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);

    try {
      await register({
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        avatar_url: null,
        global_role_id: null,
      });

      setSuccess("Usuario registrado correctamente. Ahora puedes iniciar sesión.");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("No se pudo registrar el usuario");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl text-white mb-2">Crear cuenta</h1>
          <p className="text-slate-400">
            Registra un nuevo usuario para ingresar al sistema.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-slate-300 text-sm mb-2">Nombre completo</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Diego Ledezma"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-slate-300 text-sm mb-2">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: diego.ledezma"
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">Correo</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej: diego@ejemplo.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
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
                placeholder="Crea una contraseña segura"
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
            <p className="text-slate-500 text-xs mt-2">
              Debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Confirmar contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className="w-full pl-10 pr-12 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-600 hover:to-purple-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Registrando..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-sm text-slate-400 mt-6 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}