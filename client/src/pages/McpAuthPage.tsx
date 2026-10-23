import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

const McpAuthPage: React.FC = () => {
  const { t } = useTranslation();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ hasToken: boolean }>("/api/auth/mcp-token")
      .then((res) => setHasToken(res.hasToken))
      .catch(() => setError(t("mcpAuth.loadError")));
  }, [t]);

  const createToken = async () => {
    if (hasToken && !confirm(t("mcpAuth.regenerateConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ mcpToken: string }>("/api/auth/mcp-token");
      setToken(res.mcpToken);
      setHasToken(true);
    } catch {
      setError(t("mcpAuth.generateError"));
    } finally {
      setBusy(false);
    }
  };

  if (hasToken === null && !error) return <div className="p-8">{t("common.loading")}</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 mt-10 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">{t("mcpAuth.title")}</h1>
      <p className="mb-6 text-gray-600">{t("mcpAuth.intro")}</p>

      {error && <p className="mb-4 text-red-500">{error}</p>}

      {token ? (
        <>
          <p className="mb-2 text-sm font-medium text-amber-700">{t("mcpAuth.copyNow")}</p>
          <div className="bg-gray-100 p-4 rounded border border-gray-300 mb-6 break-all font-mono text-lg select-all">
            {token}
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <h3 className="font-bold text-blue-800 mb-1">{t("mcpAuth.howTo")}</h3>
            <p className="text-blue-700 text-sm">
              {t("mcpAuth.howToText")}
              <code className="bg-white px-1 rounded border border-blue-200 block mt-2 p-2 break-all">
                claude mcp add --transport http gerard {window.location.origin}/mcp --header "Authorization: Bearer {token}"
              </code>
            </p>
          </div>
        </>
      ) : (
        hasToken !== null && (
          <>
            <p className="mb-4 text-gray-700">{hasToken ? t("mcpAuth.hasToken") : t("mcpAuth.noToken")}</p>
            <button
              type="button"
              onClick={createToken}
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 px-4 text-sm"
            >
              {hasToken ? t("mcpAuth.regenerate") : t("mcpAuth.generate")}
            </button>
          </>
        )
      )}
    </div>
  );
};

export default McpAuthPage;
