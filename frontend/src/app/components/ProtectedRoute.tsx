import { Navigate } from "react-router";
import type { ReactNode } from "react";
import { getAccessToken } from "../services/sessionService";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = getAccessToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}