import { Box, Tooltip, Stack, Text, UnstyledButton } from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { type ComponentType } from 'react';
import { useAuthStore } from '../../stores/authStore';
import {
  IconLayoutDashboard,
  IconBuildingBank,
  IconBulb,
  IconFileDescription,
  IconTemplate,
  IconAddressBook,
  IconMessages,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconBuildingCommunity,
  IconBook,
} from '@tabler/icons-react';

interface NavItemDef {
  testid?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: ComponentType<any>;
  label: string;
  path: string;
}

const PRIMARY: NavItemDef[] = [
  { testid: 'nav-dashboard',     Icon: IconLayoutDashboard, label: 'Dashboard',     path: '/dashboard' },
  { testid: 'nav-funders',       Icon: IconBuildingBank,    label: 'Funders',       path: '/funders' },
  { testid: 'nav-opportunities', Icon: IconBulb,            label: 'Opportunities', path: '/opportunities' },
  { testid: 'nav-applications',  Icon: IconFileDescription, label: 'Applications',  path: '/applications' },
];

const SECONDARY: NavItemDef[] = [
  { Icon: IconTemplate,    label: 'Templates',    path: '/templates' },
  { Icon: IconAddressBook, label: 'Contacts',     path: '/contacts' },
  { Icon: IconMessages,    label: 'Interactions', path: '/interactions' },
  // Import page hidden from navbar (2026-05-15) — page is underdeveloped.
  // Route /import is preserved in App.tsx until the import flow is rebuilt.
  // { Icon: IconUpload,   label: 'Import',       path: '/import' },
];

interface NavItemProps extends NavItemDef {
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
}

function NavItem({ Icon, label, testid, collapsed, active, onClick }: NavItemProps) {
  const btn = (
    <UnstyledButton
      data-testid={testid}
      data-active={active || undefined}
      onClick={onClick}
      className="ody-nav-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 12,
        padding: collapsed ? '10px 0' : '10px 14px',
        borderRadius: 8,
        width: '100%',
      }}
    >
      <Icon size={20} />
      {!collapsed && <Text size="sm" className="ody-nav-label">{label}</Text>}
    </UnstyledButton>
  );

  return collapsed
    ? <Tooltip label={label} position="right" withArrow transitionProps={{ duration: 80 }}>{btn}</Tooltip>
    : btn;
}

export interface AppNavbarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenGuide: () => void;
}

export default function AppNavbar({ collapsed, onToggle, onOpenGuide }: AppNavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isActive = (path: string) => location.pathname.startsWith(path);

  const navGroup = (items: NavItemDef[]) =>
    items.map(item => (
      <NavItem
        key={item.path}
        {...item}
        collapsed={collapsed}
        active={isActive(item.path)}
        onClick={() => navigate(item.path)}
      />
    ));

  return (
    <>
      <style>{`
        .ody-nav-item { color: rgba(255,255,255,0.65); transition: background 140ms, color 140ms; }
        .ody-nav-item:hover { background: rgba(255,255,255,0.09) !important; color: rgba(255,255,255,0.95) !important; }
        .ody-nav-item[data-active] { background: rgba(52,152,219,0.22) !important; color: #85C1E2 !important; box-shadow: inset 3px 0 0 0 #5DADE2; }
        .ody-nav-label { color: inherit; font-size: 14px; }
        .ody-nav-section { color: rgba(255,255,255,0.28); font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 4px 14px 2px; }
        .ody-nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 6px 4px; }
        .ody-nav-toggle { color: rgba(255,255,255,0.35); transition: background 140ms, color 140ms; }
        .ody-nav-toggle:hover { background: rgba(255,255,255,0.09) !important; color: rgba(255,255,255,0.7) !important; }
      `}</style>

      <Box style={{
        height: '100%',
        background: 'linear-gradient(175deg, #1e3a5f 0%, #13263F 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 8px',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}>
        <Stack gap={2} style={{ flex: 1 }}>
          {!collapsed && <div className="ody-nav-section">Core</div>}
          {navGroup(PRIMARY)}

          <div className="ody-nav-divider" />

          {!collapsed && <div className="ody-nav-section">Tools</div>}
          {navGroup(SECONDARY)}

          {user?.role === 'ADMIN' && (
            <>
              <div className="ody-nav-divider" />
              {!collapsed && <div className="ody-nav-section">Admin</div>}
              <NavItem
                Icon={IconSettings}
                label="Users"
                path="/admin/users"
                collapsed={collapsed}
                active={isActive('/admin/users')}
                onClick={() => navigate('/admin/users')}
              />
              <NavItem
                Icon={IconBuildingCommunity}
                label="Organisation"
                path="/admin/organisation"
                collapsed={collapsed}
                active={isActive('/admin/organisation')}
                onClick={() => navigate('/admin/organisation')}
              />
            </>
          )}
        </Stack>

        {/* Bottom: guide + collapse toggle */}
        <Box mt={8}>
          <div className="ody-nav-divider" />
          <Tooltip label="User Guide" position="right" withArrow disabled={!collapsed}>
            <UnstyledButton
              onClick={onOpenGuide}
              className="ody-nav-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 14px',
                borderRadius: 8,
                width: '100%',
              }}
            >
              <IconBook size={20} />
              {!collapsed && <Text size="sm" className="ody-nav-label">User Guide</Text>}
            </UnstyledButton>
          </Tooltip>
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right" withArrow>
            <UnstyledButton
              onClick={onToggle}
              className="ody-nav-toggle"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '10px 0' : '10px 14px',
                borderRadius: 8,
                width: '100%',
              }}
            >
              {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
              {!collapsed && <Text size="xs" style={{ color: 'inherit' }}>Collapse</Text>}
            </UnstyledButton>
          </Tooltip>
        </Box>
      </Box>
    </>
  );
}
