import type { ReactNode } from "react";
import {
  Avatar,
  DocsIcon,
  FlaskIcon,
  RepoIcon,
  SettingsIcon,
  SupportIcon,
  UserGlyph,
} from "@/components/icons";
import type { NavId } from "./types";

type IconComponent = (props: { className?: string }) => ReactNode;

const PRIMARY_NAV: { id: NavId; label: string; Icon: IconComponent }[] = [
  { id: "experiments", label: "Experiments", Icon: FlaskIcon },
  { id: "repositories", label: "Repositories", Icon: RepoIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

const BOTTOM_NAV: { id: string; label: string; Icon: IconComponent }[] = [
  { id: "docs", label: "Docs", Icon: DocsIcon },
  { id: "support", label: "Support", Icon: SupportIcon },
];

export function DashboardSidebar({
  activeNav,
  onNavChange,
  onPlaceholderClick,
}: {
  activeNav: NavId;
  onNavChange: (nav: NavId) => void;
  onPlaceholderClick: (label: string) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/60">
      <div className="flex items-center gap-3 px-5 py-5">
        <Avatar size={38} hue={222}>
          <UserGlyph className="h-5 w-5 text-white" />
        </Avatar>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-zinc-900">Optimizer Lab</p>
          <p className="text-xs text-zinc-500">AI Research Studio</p>
        </div>
      </div>

      <nav className="mt-4 flex-1 px-3">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map(({ id, label, Icon }) => {
            const active = activeNav === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onNavChange(id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 pb-5">
        <div className="mb-2 h-px bg-zinc-200" />
        <ul className="space-y-0.5">
          {BOTTOM_NAV.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPlaceholderClick(label)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
