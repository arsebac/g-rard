import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import { Zap } from "lucide-react";

type Mode = "login" | "register";

export function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (e: string, p: string) => {
    const user = await authApi.login(e, p);
    setUser(user);
    navigate({ to: "/" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await doLogin(email, password);
      } else {
        const user = await authApi.register(name, email, password);
        setUser(user);
        navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await doLogin("test@test.com", "test");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600 mb-1">Gérard</h1>
          <p className="text-sm text-gray-400">Gestion de projets maison</p>
        </div>

        {/* Onglets */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6 gap-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marie"
                autoComplete="given-name"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@gerard.local"
              autoComplete="email"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 6 : undefined}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {mode === "register" && (
              <p className="text-xs text-gray-400 mt-1">6 caractères minimum</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors mt-1"
          >
            {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        {/* Accès rapide test */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg py-2 px-3 transition-colors disabled:opacity-50"
          >
            <Zap size={14} />
            Accès rapide — compte test
          </button>
        </div>
      </div>
    </div>
  );
}
