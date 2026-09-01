import {
  Activity,
  BellRing,
  BookOpenCheck,
  Boxes,
  ChevronDown,
  CircleGauge,
  Database,
  FileClock,
  Menu,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: "overview" | "sources" | "targets" | "incidents" | "deliveries" | "audit" | "methodology" | "developer";
}

export interface AppShellProps {
  product: string;
  environment?: string | undefined;
  navigation: readonly NavigationItem[];
  activeHref?: string | undefined;
  utility?: ReactNode;
  children: ReactNode;
}

const icons = {
  overview: CircleGauge,
  sources: Database,
  targets: Boxes,
  incidents: BellRing,
  deliveries: Send,
  audit: FileClock,
  methodology: BookOpenCheck,
  developer: ShieldCheck,
};

export function AppShell({
  product,
  environment,
  navigation,
  activeHref = "/",
  utility,
  children,
}: AppShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ui-shell" data-nav-open={open ? "true" : "false"}>
      <header className="ui-topbar">
        <button
          className="ui-nav-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <a className="ui-wordmark" href="/">
          <Activity aria-hidden="true" size={28} />
          <strong>{product}</strong>
        </a>
        {environment === undefined ? null : (
          <span className="ui-environment">
            {environment} <ChevronDown aria-hidden="true" size={15} />
          </span>
        )}
        <div className="ui-topbar__utility">{utility}</div>
      </header>
      <aside className="ui-sidebar">
        <div className="ui-sidebar__brand">
          <Activity aria-hidden="true" size={34} />
          <div>
            <strong>{product}</strong>
            <span>Data access &amp; API health</span>
          </div>
        </div>
        <nav aria-label="Primary" className="ui-nav">
          {navigation.map((item) => {
            const Icon = icons[item.icon];
            return (
              <a
                className="ui-nav__link"
                data-active={activeHref === item.href ? "true" : "false"}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>
      <main className="ui-main">{children}</main>
    </div>
  );
}
