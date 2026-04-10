import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { authApi } from "@/api/auth";
import { usersApi } from "@/api/users";
import { attachmentsApi } from "@/api/attachments";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { BookOpen, LayoutDashboard, LogOut, Plus, Camera, Loader2, Menu, X, Search } from "lucide-react";
import { SearchModal } from "@/components/ui/SearchModal";

import { useEffect, useState } from "react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { user, setUser } = useAuthStore();

  // Raccourci clavier "/" pour ouvrir la recherche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [navigate]);
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
    navigate({ to: "/login" });
  };

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar.mutate(file);
    }
  };

  const avatarUrl = user?.avatarUrl ? attachmentsApi.getPublicUrl(user.avatarUrl) : null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed bottom-6 right-6 z-50 p-3.5 bg-indigo-600 text-white rounded-full shadow-2xl md:hidden transition-transform active:scale-95 border-2 border-white"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        "w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out z-40",
        "fixed inset-y-0 left-0 md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600 tracking-tight">Gérard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Home project management</p>
          {/* Barre de recherche */}
          <button
            onClick={() => setShowSearch(true)}
            className="mt-3 w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          >
            <Search size={13} />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-xs px-1 py-0.5 bg-white border border-gray-200 rounded text-gray-400 font-mono">/</kbd>
          </button>
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
            Dashboard
          </Link>

          <Link
            to="/wiki"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100"
              )
            }
          >
            <BookOpen size={16} />
            Wiki
          </Link>

          {/* Projets */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Projects
              </span>
              <Link
                to="/projects/new"
                className="text-gray-400 hover:text-indigo-600 transition-colors"
                title="New project"
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
          <label className="relative group cursor-pointer flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold overflow-hidden border border-gray-100 transition-all group-hover:ring-2 group-hover:ring-indigo-200">
              {uploadAvatar.isPending ? (
                <Loader2 size={14} className="animate-spin text-indigo-600" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]?.toUpperCase() ?? "?"
              )}
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleAvatarChange} 
              disabled={uploadAvatar.isPending} 
            />
          </label>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto min-w-0 relative">{children}</main>

      {/* Search modal */}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </div>
  );
}
