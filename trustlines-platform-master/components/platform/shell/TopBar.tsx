'use client';

import { Bell } from 'lucide-react';
import type { UserRole } from '@/types/database';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[];
  userRole: UserRole;
  userName: string;
  notificationCount?: number;
}

export function TopBar({
  breadcrumbs = [],
  userRole,
  userName,
  notificationCount = 0,
}: TopBarProps) {
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="topbar">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {i > 0 && (
              <span style={{ color: 'var(--fg-faint)', fontSize: '13px' }}>/</span>
            )}
            {crumb.href ? (
              <a
                href={crumb.href}
                style={{
                  fontSize: '13px',
                  color: i === breadcrumbs.length - 1 ? 'var(--fg-default)' : 'var(--fg-subtle)',
                  fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                  textDecoration: 'none',
                }}
              >
                {crumb.label}
              </a>
            ) : (
              <span
                style={{
                  fontSize: '13px',
                  color: i === breadcrumbs.length - 1 ? 'var(--fg-default)' : 'var(--fg-subtle)',
                  fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                }}
              >
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            color: 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Bell size={18} strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '8px',
                height: '8px',
                background: 'var(--brand-orange)',
                borderRadius: '50%',
                border: '1.5px solid white',
              }}
            />
          )}
        </button>

        <div
          style={{
            width: '1px',
            height: '20px',
            background: 'var(--border-subtle)',
          }}
        />

        <div
          className="avatar avatar-sm"
          style={{ cursor: 'pointer' }}
          title={userName}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
