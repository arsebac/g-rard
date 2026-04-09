import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { LayoutDashboard, LogOut, Plus, Settings } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
    navigate({ to: "/login" });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600 tracking-tight">Gérard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestion de projets maison</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <Link
            to="/"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100"
              )
            }
          >
            <LayoutDashboard size={16} />
            Tableau de bord
          </Link>

          {/* Projets */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Projets
              </span>
              <Link
                to="/projects/new"
                className="text-gray-400 hover:text-indigo-600 transition-colors"
                title="Nouveau projet"
              >
                <Plus size={14} />
              </Link>
            </div>
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: String(p.id) }}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  )
                }
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-xs text-gray-400">{p._count?.tasks ?? 0}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* User */}
        <div className="border-t border-gray-200 p-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
