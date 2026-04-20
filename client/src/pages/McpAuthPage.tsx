import React, { useEffect, useState } from "react";
import { api } from "../api/client";

const McpAuthPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ mcpToken: string }>("/api/auth/mcp-token")
      .then((res) => {
        setToken(res.mcpToken);
      })
      .catch(() => {
        setError("Impossible de récupérer le token MCP. Veuillez vous connecter.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 mt-10 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Authentification MCP</h1>
      <p className="mb-6 text-gray-600">
        Utilisez le token ci-dessous pour configurer votre client MCP (ex: Claude Code).
      </p>

      <div className="bg-gray-100 p-4 rounded border border-gray-300 mb-6 break-all font-mono text-lg select-all cursor-pointer" title="Cliquez pour copier">
        {token}
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <h3 className="font-bold text-blue-800 mb-1">Comment l'utiliser ?</h3>
        <p className="text-blue-700 text-sm">
          Configurez votre client MCP avec l'URL suivante :
          <br />
          <code className="bg-white px-1 rounded border border-blue-200 block mt-2 p-2">
            {window.location.origin}/mcp?token={token}
          </code>
        </p>
      </div>
    </div>
  );
};

export default McpAuthPage;
