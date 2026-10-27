/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Floating Pill Navigation (Taskbar)
 * Fixed top-center pill taskbar with spring-physics Framer Motion `layoutId` active indicator,
 * integrated Dark/Light mode toggle, and quick Log Out action.
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Scale,
  Sun,
  Moon,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from './ThemeProvider.tsx';

export interface FloatingNavTab {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  badge?: string;
}

interface FloatingNavbarProps {
  tabs: FloatingNavTab[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onLogout: () => void;
  userName?: string;
}

export const FloatingNavbar: React.FC<FloatingNavbarProps> = ({
  tabs,
  activeTab,
  onSelectTab,
  onLogout,
  userName,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <nav
      aria-label="Primary Floating Taskbar"
      data-testid="floating-pill-navbar"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full px-2 py-2 flex items-center justify-between gap-1 backdrop-blur-xl border bg-white/70 border-zinc-200/60 shadow-lg dark:bg-zinc-950/60 dark:border-white/10 dark:shadow-2xl max-w-[96vw] overflow-x-auto scrollbar-none"
    >
      {/* Brand Mark Pill */}
      <button
        type="button"
        onClick={() => onSelectTab('dashboard')}
        className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-bold tracking-tight text-zinc-900 dark:text-white shrink-0 cursor-pointer"
      >
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
          <Scale className="w-3.5 h-3.5" />
        </span>
        <span className="hidden xl:inline">
          DuesGuard <span className="text-indigo-500 dark:text-indigo-400">AI</span>
        </span>
      </button>

      <div className="h-4 w-px bg-zinc-200 dark:bg-white/10 mx-0.5 shrink-0" />

      {/* Animated Navigation Tabs */}
      <div className="flex items-center gap-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`relative px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'text-zinc-950 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="floating-nav-active-pill"
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 32,
                  }}
                  className="absolute inset-0 rounded-full bg-zinc-900/8 dark:bg-white/12 border border-zinc-900/10 dark:border-white/15"
                />
              )}
              <Icon
                className={`relative z-10 w-3.5 h-3.5 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
              />
              <span className="relative z-10">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="relative z-10 text-[10px] font-mono opacity-65">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-zinc-200 dark:bg-white/10 mx-0.5 shrink-0" />

      {/* Theme Toggle & Log Out Controls */}
      <div className="flex items-center gap-1 pr-1 shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          data-testid="floating-theme-toggle-btn"
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 transition cursor-pointer"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        <button
          type="button"
          onClick={onLogout}
          data-testid="header-logout-btn"
          title={userName ? `Log out (${userName})` : 'Log out'}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </nav>
  );
};
