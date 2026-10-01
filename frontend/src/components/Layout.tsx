import { Link, NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:text-slate-900'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 font-bold text-white">
              C
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">CivicFlow</span>
            <span className="hidden text-xs font-medium text-teal-700 sm:inline">AI</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/">Dashboard</NavItem>
            <NavItem to="/issues">Issues</NavItem>
            <NavItem to="/ask">Ask</NavItem>
            <Link
              to="/report"
              className="ml-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition active:translate-y-px hover:bg-teal-700"
            >
              Report an issue
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
          CivicFlow doesn't count complaints. It understands the problem behind them.
        </div>
      </footer>
    </div>
  );
}
