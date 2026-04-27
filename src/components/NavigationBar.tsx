/**
 * NavigationBar - ナビゲーションバー
 *
 * ホーム、レッスン、進捗、設定の4つのナビゲーションリンクを提供する。
 * 現在のルートに応じてアクティブ状態を表示する。
 *
 * Requirements: 全体
 */

import { NavLink } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface NavItem {
  to: string;
  label: string;
  icon: string;
  ariaLabel: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'ホーム', icon: '🏠', ariaLabel: 'ホーム画面' },
  { to: '/lesson', label: 'レッスン', icon: '📖', ariaLabel: 'レッスン画面' },
  { to: '/progress', label: '進捗', icon: '📊', ariaLabel: '進捗画面' },
  { to: '/settings', label: '設定', icon: '⚙️', ariaLabel: '設定画面' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NavigationBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white sm:static sm:border-b sm:border-t-0"
      aria-label="メインナビゲーション"
    >
      <div className="mx-auto flex max-w-2xl items-center justify-around">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 px-2 py-3 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`
            }
            aria-label={item.ariaLabel}
          >
            <span className="text-lg" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
