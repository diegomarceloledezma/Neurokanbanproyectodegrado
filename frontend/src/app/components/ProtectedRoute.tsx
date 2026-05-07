import { Navigate } from "react-router";
import type { ReactNode } from "react";
import { getAccessToken, getCurrentUser } from "../services/sessionService";

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: string[];
};

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const token = getAccessToken();
  const currentUser = getCurrentUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const currentRole = (
      currentUser?.role_name ||
      currentUser?.global_role?.name ||
      ""
    ).toLowerCase();

    const normalizedAllowedRoles = allowedRoles.map((role) => role.toLowerCase());

    if (!normalizedAllowedRoles.includes(currentRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}