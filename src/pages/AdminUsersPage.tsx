import { useState } from 'react';
import {
  Container, Title, Group, Stack, Table, Badge, Text, Button,
  Modal, PasswordInput, Paper, Loader, Center,
} from '@mantine/core';
import { IconKey, IconShieldLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'red',
  GRANTS_OFFICER: 'blue',
  REVIEWER: 'grape',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  GRANTS_OFFICER: 'Grants Officer',
  REVIEWER: 'Reviewer',
};

interface UserRow {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const { data, isLoading } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  // Self password change
  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Admin reset
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetConfirmPw, setResetConfirmPw] = useState('');
  const [resettingPw, setResettingPw] = useState(false);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      notifications.show({ title: 'Error', message: 'Passwords do not match', color: 'red' });
      return;
    }
    if (newPw.length < 6) {
      notifications.show({ title: 'Error', message: 'Password must be at least 6 characters', color: 'red' });
      return;
    }
    setChangingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      notifications.show({ title: 'Success', message: 'Password changed successfully', color: 'green' });
      setChangeOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to change password',
        color: 'red',
      });
    } finally {
      setChangingPw(false);
    }
  };

  const handleAdminReset = async () => {
    if (!resetTarget) return;
    if (resetPw !== resetConfirmPw) {
      notifications.show({ title: 'Error', message: 'Passwords do not match', color: 'red' });
      return;
    }
    if (resetPw.length < 6) {
      notifications.show({ title: 'Error', message: 'Password must be at least 6 characters', color: 'red' });
      return;
    }
    setResettingPw(true);
    try {
      await api.post(`/auth/admin-reset-password/${resetTarget.id}`, { newPassword: resetPw });
      notifications.show({
        title: 'Success',
        message: `Password reset for ${resetTarget.name}`,
        color: 'green',
      });
      setResetOpen(false);
      setResetTarget(null);
      setResetPw('');
      setResetConfirmPw('');
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to reset password',
        color: 'red',
      });
    } finally {
      setResettingPw(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  // Sort: active first, then by name
  const sortedUsers = (data || [])
    .filter((u) => u.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={1}>User Management</Title>
            <Text size="sm" c="dimmed" mt={4}>
              {sortedUsers.length} active users
            </Text>
          </div>
          <Button
            leftSection={<IconKey size={16} />}
            variant="light"
            onClick={() => setChangeOpen(true)}
          >
            Change My Password
          </Button>
        </Group>

        {isLoading ? (
          <Center py="xl"><Loader size="lg" /></Center>
        ) : (
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Last Login</Table.Th>
                  {isAdmin && <Table.Th>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedUsers.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">{user.name}</Text>
                      <Text size="xs" c="dimmed">{user.email}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">{user.username}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={ROLE_COLORS[user.role] || 'gray'} variant="light">
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{formatDate(user.lastLoginAt)}</Text>
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="orange"
                          leftSection={<IconShieldLock size={14} />}
                          onClick={() => {
                            setResetTarget(user);
                            setResetOpen(true);
                          }}
                        >
                          Reset Password
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>

      {/* Self password change modal */}
      <Modal
        opened={changeOpen}
        onClose={() => setChangeOpen(false)}
        title="Change Your Password"
        centered
      >
        <Stack gap="md">
          <PasswordInput
            label="Current Password"
            placeholder="Enter current password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
          />
          <PasswordInput
            label="New Password"
            placeholder="At least 6 characters"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
          />
          <PasswordInput
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            error={confirmPw && confirmPw !== newPw ? 'Passwords do not match' : undefined}
          />
          <Button
            fullWidth
            onClick={handleChangePassword}
            loading={changingPw}
            disabled={!currentPw || !newPw || !confirmPw || newPw !== confirmPw}
          >
            Change Password
          </Button>
        </Stack>
      </Modal>

      {/* Admin reset password modal */}
      <Modal
        opened={resetOpen}
        onClose={() => { setResetOpen(false); setResetTarget(null); }}
        title={`Reset Password: ${resetTarget?.name || ''}`}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Set a new password for <strong>{resetTarget?.username}</strong>. The user will need to be
            informed of their new password.
          </Text>
          <PasswordInput
            label="New Password"
            placeholder="At least 6 characters"
            value={resetPw}
            onChange={(e) => setResetPw(e.target.value)}
            required
          />
          <PasswordInput
            label="Confirm Password"
            placeholder="Re-enter new password"
            value={resetConfirmPw}
            onChange={(e) => setResetConfirmPw(e.target.value)}
            required
            error={resetConfirmPw && resetConfirmPw !== resetPw ? 'Passwords do not match' : undefined}
          />
          <Button
            fullWidth
            color="orange"
            onClick={handleAdminReset}
            loading={resettingPw}
            disabled={!resetPw || !resetConfirmPw || resetPw !== resetConfirmPw}
          >
            Reset Password
          </Button>
        </Stack>
      </Modal>
    </Container>
  );
}
