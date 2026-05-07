import { createBrowserRouter } from "react-router";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Project from "./pages/Project";
import Team from "./pages/Team";
import KanbanProjects from "./pages/KanbanProjects";
import KanbanBoard from "./pages/KanbanBoard";
import CreateTask from "./pages/CreateTask";
import TaskDetail from "./pages/TaskDetail";
import SmartRecommendation from "./pages/SmartRecommendation";
import MemberProfile from "./pages/MemberProfile";
import TeamMetrics from "./pages/TeamMetrics";
import DecisionHistory from "./pages/DecisionHistory";
import ModelIntelligence from "./pages/ModelIntelligence";
import MyTasks from "./pages/MyTasks";
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
      { path: "my-tasks", Component: MyTasks },

      { path: "projects", Component: Projects },
      { path: "projects/:id", Component: Project },
      { path: "project/:id", Component: Project },

      {
        path: "team",
        Component: () => (
          <ProtectedRoute allowedRoles={["admin", "leader"]}>
            <Team />
          </ProtectedRoute>
        ),
      },

      { path: "kanban-projects", Component: KanbanProjects },
      { path: "kanban/:projectId", Component: KanbanBoard },

      {
        path: "task/create/:projectId",
        Component: () => (
          <ProtectedRoute allowedRoles={["admin", "leader"]}>
            <CreateTask />
          </ProtectedRoute>
        ),
      },

      { path: "task/:taskId", Component: TaskDetail },

      {
        path: "recommendation/:taskId",
        Component: () => (
          <ProtectedRoute allowedRoles={["admin", "leader"]}>
            <SmartRecommendation />
          </ProtectedRoute>
        ),
      },

      { path: "member/:memberId", Component: MemberProfile },

      {
        path: "metrics",
        Component: () => (
          <ProtectedRoute allowedRoles={["admin", "leader"]}>
            <TeamMetrics />
          </ProtectedRoute>
        ),
      },
      {
        path: "history",
        Component: () => (
          <ProtectedRoute allowedRoles={["admin", "leader"]}>
            <DecisionHistory />
          </ProtectedRoute>
        ),
      },
      {
        path: "modelo-ia",
        Component: () => (
          <ProtectedRoute allowedRoles={["admin", "leader"]}>
            <ModelIntelligence />
          </ProtectedRoute>
        ),
      },

      { path: "*", Component: NotFound },
    ],
  },
]);