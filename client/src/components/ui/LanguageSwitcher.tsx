import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, SupportedLocale } from "@/i18n";

/**
 * Drop-in language switcher. Shows flags/codes for each supported locale.
 * Usage: <LanguageSwitcher /> anywhere in the layout.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.split("-")[0] as SupportedLocale;

  return (
    <div className="flex items-center gap-1">
      {SUPPORTED_LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          title={label}
          className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
            current === code
              ? "bg-indigo-100 text-indigo-700"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
