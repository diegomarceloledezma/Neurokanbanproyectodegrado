import { useNavigate } from "react-router";
import { AlertCircle } from "lucide-react";
import { PageState } from "../components/PageState";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <PageState
      icon={AlertCircle}
      eyebrow="Error 404"
      title="Página no encontrada"
      description="La ruta que intentas abrir no existe, fue movida o no pertenece al flujo actual de NeuroKanban."
      actionLabel="Volver al panel principal"
      onAction={() => navigate("/")}
      secondaryActionLabel="Ver proyectos"
      onSecondaryAction={() => navigate("/projects")}
    />
  );
}