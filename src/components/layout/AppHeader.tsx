import { Group, Title, Button, Text, Box, Menu, Modal, Stack, PasswordInput } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { IconKey, IconLogout, IconChevronDown } from '@tabler/icons-react';

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

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const resetPwForm = () => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      logout();
      navigate('/login');
      notifications.show({ title: 'Success', message: 'Logged out successfully', color: 'teal' });
    } catch (error) {
      console.error('Logout error:', error);
      logout();
      navigate('/login');
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      notifications.show({ color: 'red', title: 'Mismatch', message: 'New passwords do not match.' });
      return;
    }
    if (newPw.length < 6) {
      notifications.show({ color: 'red', title: 'Too short', message: 'New password must be at least 6 characters.' });
      return;
    }
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      notifications.show({ color: 'teal', title: 'Password changed', message: 'Your password has been updated.' });
      setPwModalOpen(false);
      resetPwForm();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to change password.';
      notifications.show({ color: 'red', title: 'Error', message: msg });
    } finally {
      setPwLoading(false);
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
        .ody-user-pill {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(93, 173, 226, 0.2);
          border-radius: 20px;
          padding: 4px 10px 4px 14px;
          cursor: pointer;
          transition: background 150ms ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ody-user-pill:hover {
          background: rgba(255, 255, 255, 0.12);
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

        {/* Right: User menu */}
        <Menu shadow="md" width={180} position="bottom-end" withArrow>
          <Menu.Target>
            <div className="ody-user-pill">
              <Text c="white" size="sm" fw={500} style={{ lineHeight: 1 }}>{user?.name}</Text>
              <IconChevronDown size={13} color="rgba(255,255,255,0.55)" />
            </div>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconKey size={14} />} onClick={() => { resetPwForm(); setPwModalOpen(true); }}>
              Change password
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={handleLogout}>
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Change Password Modal */}
      <Modal
        opened={pwModalOpen}
        onClose={() => { setPwModalOpen(false); resetPwForm(); }}
        title="Change password"
        size="sm"
        centered
      >
        <Stack gap="sm">
          <PasswordInput
            label="Current password"
            placeholder="Enter your current password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.currentTarget.value)}
            autoComplete="current-password"
          />
          <PasswordInput
            label="New password"
            placeholder="At least 6 characters"
            value={newPw}
            onChange={(e) => setNewPw(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            placeholder="Repeat new password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.currentTarget.value)}
            autoComplete="new-password"
            error={confirmPw && newPw !== confirmPw ? 'Passwords do not match' : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
          />
          <Button
            mt="xs"
            onClick={handleChangePassword}
            loading={pwLoading}
            disabled={!currentPw || !newPw || !confirmPw}
            leftSection={<IconKey size={15} />}
          >
            Update password
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
