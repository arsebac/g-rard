import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { authApi } from "./api/auth";
import { useAuthStore } from "./store/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectPage } from "./pages/ProjectPage";
import { TicketPage } from "./pages/TicketPage";
import { WikiPage } from "./pages/WikiPage";

const rootRoute = createRootRoute({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const authGuard = async () => {
  const { user, setUser } = useAuthStore.getState();
  if (user) return;
  try {
    const me = await authApi.me();
    setUser(me);
  } catch {
    throw redirect({ to: "/login" });
  }
};

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: authGuard,
  component: DashboardPage,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  beforeLoad: authGuard,
  component: ProjectPage,
});

const ticketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets/$ref",
  beforeLoad: authGuard,
  component: TicketPage,
});

const wikiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wiki",
  beforeLoad: authGuard,
  component: WikiPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  projectRoute,
  ticketRoute,
  wikiRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
