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
import { DocumentsPage } from "./pages/DocumentsPage";
import McpAuthPage from "./pages/McpAuthPage";

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

const projectIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectKey",
  beforeLoad: async ({ params }) => {
    await authGuard();
    throw redirect({
      to: "/projects/$projectKey/$view",
      params: { projectKey: params.projectKey, view: "board" },
      search: { selectedIssue: undefined },
    });
  },
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectKey/$view",
  beforeLoad: authGuard,
  component: ProjectPage,
  validateSearch: (search: Record<string, unknown>) => ({
    selectedIssue: typeof search.selectedIssue === "string" ? search.selectedIssue : undefined,
  }),
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

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents",
  beforeLoad: authGuard,
  component: DocumentsPage,
});

const mcpAuthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mcp-auth",
  beforeLoad: authGuard,
  component: McpAuthPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  projectIndexRoute,
  projectRoute,
  ticketRoute,
  wikiRoute,
  documentsRoute,
  mcpAuthRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
