import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import {
  clearSession,
  getAccessToken,
  getCurrentUser,
} from "../services/sessionService";

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: string[];
};

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const location = useLocation();
  const token = getAccessToken();
  const currentUser = getCurrentUser();

  const redirectState = {
    from: `${location.pathname}${location.search}`,
  };

  if (!token) {
    return <Navigate to="/login?session=expired" replace state={redirectState} />;
  }

  if (!currentUser) {
    clearSession();
    return <Navigate to="/login?session=invalid" replace state={redirectState} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const currentRole = (
      currentUser.role_name ||
      currentUser.global_role?.name ||
      ""
    ).toLowerCase();

    const normalizedAllowedRoles = allowedRoles.map((role) => role.toLowerCase());

    if (!normalizedAllowedRoles.includes(currentRole)) {
      return (
        <Navigate
          to="/sin-acceso"
          replace
          state={{
            from: `${location.pathname}${location.search}`,
            requiredRoles: allowedRoles,
          }}
        />
      );
    }
  }

  return <>{children}</>;
}