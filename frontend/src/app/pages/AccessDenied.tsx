import { useLocation, useNavigate } from "react-router";
import { ShieldAlert } from "lucide-react";
import { PageState } from "../components/PageState";

type AccessDeniedState = {
  from?: string;
  requiredRoles?: string[];
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  leader: "Líder de equipo",
  member: "Integrante del equipo",
};

export default function AccessDenied() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as AccessDeniedState;

  const requiredRoles = state.requiredRoles
    ?.map((role) => roleLabels[role] ?? role)
    .join(", ");

  return (
    <PageState
      icon={ShieldAlert}
      eyebrow="Permisos insuficientes"
      title="No tienes acceso a esta sección"
      description="Tu rol actual no tiene permisos para entrar a este módulo. Esto protege las funciones administrativas, analíticas y de recomendación del sistema."
      actionLabel="Volver al panel principal"
      onAction={() => navigate("/")}
      secondaryActionLabel="Ir a mis tareas"
      onSecondaryAction={() => navigate("/my-tasks")}
      variant="warning"
    >
      {requiredRoles && (
        <p>
          Roles permitidos para esta vista: <span className="text-white">{requiredRoles}</span>
        </p>
      )}
      {state.from && (
        <p className="mt-2 text-slate-500">Ruta solicitada: {state.from}</p>
      )}
    </PageState>
  );
}