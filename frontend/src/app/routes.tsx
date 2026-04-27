import { createBrowserRouter } from "react-router";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Project from "./pages/Project";
import KanbanBoard from "./pages/KanbanBoard";
import CreateTask from "./pages/CreateTask";
import TaskDetail from "./pages/TaskDetail";
import SmartRecommendation from "./pages/SmartRecommendation";
import MemberProfile from "./pages/MemberProfile";
import TeamMetrics from "./pages/TeamMetrics";
import DecisionHistory from "./pages/DecisionHistory";
import MainLayout from "./components/MainLayout";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/",
    Component: () => (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
      { path: "projects", Component: Projects },
      { path: "projects/:projectId", Component: Project },
      { path: "kanban/:projectId", Component: KanbanBoard },
      { path: "task/create/:projectId", Component: CreateTask },
      { path: "task/:taskId", Component: TaskDetail },
      { path: "recommendation/:taskId", Component: SmartRecommendation },
      { path: "member/:memberId", Component: MemberProfile },
      { path: "metrics", Component: TeamMetrics },
      { path: "history", Component: DecisionHistory },
      { path: "*", Component: NotFound },
    ],
  },
]);