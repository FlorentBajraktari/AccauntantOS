import React from "react";
import { Languages, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LanguageSwitcher() {
  const { lang, changeLang, languages } = useI18n();
  const active = languages.find((l) => l.code === lang) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="language-switcher"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors px-2.5 py-1.5 rounded-md hover:bg-slate-100"
        >
          <Languages className="h-4 w-4" />
          <span className="font-medium">{active.short}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            data-testid={`lang-option-${l.code}`}
            onClick={() => changeLang(l.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>{l.flag}</span> {l.label}
            </span>
            {l.code === lang && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
