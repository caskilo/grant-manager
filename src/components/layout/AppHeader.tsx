import { Group, Title, Button, Text, Box } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import { notifications } from '@mantine/notifications';

/** Crow's Nest Logo - A stylized ship's lookout tower spotting the horizon */
function CrowsNestLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    >
      {/* Crow's nest */}
      <ellipse cx="20" cy="22" rx="10" ry="6" fill="none" stroke="#85C1E2" strokeWidth="2" />
      {/* Support ropes */}
      <line x1="10" y1="22" x2="8" y2="32" stroke="#85C1E2" strokeWidth="2.5" opacity="0.7" />
      <line x1="30" y1="22" x2="32" y2="32" stroke="#85C1E2" strokeWidth="2.5" opacity="0.7" />
      {/* Horizon/search arc */}
      <path
        d="M8 14 Q20 8 32 14"
        fill="none"
        stroke="#2874A6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* The spotter/dot on horizon */}
      <circle cx="20" cy="11" r="2" fill="#3498DB" />
    </svg>
  );
}

export default function AppHeader() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      logout();
      navigate('/login');
      notifications.show({
        title: 'Success',
        message: 'Logged out successfully',
        color: 'grain',
      });
    } catch (error) {
      console.error('Logout error:', error);
      logout();
      navigate('/login');
    }
  };

  return (
    <>
      <style>{`
        .ody-header {
          background: linear-gradient(90deg, #1e3a5f 0%, #13263F 50%, #1e3a5f 100%);
          border-bottom: 1px solid rgba(93, 173, 226, 0.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .ody-header-title {
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 0%, #85C1E2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ody-header-subtitle {
          color: rgba(133, 193, 226, 0.7);
          font-size: 11px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .ody-user-pill {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(93, 173, 226, 0.2);
          border-radius: 20px;
          padding: 4px 14px;
          transition: background 150ms ease;
        }
        .ody-user-pill:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .ody-logout-btn {
          color: rgba(255, 255, 255, 0.7) !important;
          font-weight: 500;
          transition: color 150ms ease, background 150ms ease;
        }
        .ody-logout-btn:hover {
          color: #ffffff !important;
          background: rgba(133, 193, 226, 0.15) !important;
        }
      `}</style>

      <Group
        h="100%"
        px="lg"
        justify="space-between"
        data-testid="app-header"
        className="ody-header"
        style={{ width: '100%' }}
      >
        {/* Left: Logo + Title */}
        <Group gap="sm">
          <CrowsNestLogo size={40} />
          <Box>
            <Title order={3} className="ody-header-title" style={{ fontSize: '1.25rem', lineHeight: 1.5 }}>
              Odyssean Grant Manager
            </Title>
          </Box>
        </Group>

        {/* Right: User + Logout */}
        <Group gap="md">
          <Text className="ody-user-pill" c="white" size="sm" fw={500}>
            {user?.name}
          </Text>
          <Button
            variant="subtle"
            className="ody-logout-btn"
            onClick={handleLogout}
            size="sm"
            radius="md"
          >
            Logout
          </Button>
        </Group>
      </Group>
    </>
  );
}
