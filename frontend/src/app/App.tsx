import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { installAuthFetchInterceptor } from "./services/sessionService";

export default function App() {
  useEffect(() => {
    installAuthFetchInterceptor();
  }, []);

  return <RouterProvider router={router} />;
}