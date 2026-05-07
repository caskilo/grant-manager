import { useMemo, useState } from 'react';
import {
  Container, Title, Group, Stack, Table, Badge, Text, Button,
  Modal, PasswordInput, Paper, Loader, Center, SegmentedControl,
  TextInput, Select, Menu, ActionIcon, Alert, List, Tooltip, CopyButton,
} from '@mantine/core';
import {
  IconKey, IconShieldLock, IconUserPlus, IconDots, IconUserOff, IconUserCheck,
  IconTrash, IconAlertTriangle, IconRefresh, IconCopy, IconCheck,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

type StatusFilter = 'all' | 'active' | 'inactive';

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'GRANTS_OFFICER', label: 'Grants Officer' },
  { value: 'REVIEWER', label: 'Reviewer' },
];

const generatePassword = (length = 16) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const arr = new Uint32Array(length);
  (window.crypto || (window as any).msCrypto).getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
};

const extractError = (err: any, fallback: string) => {
  const data = err?.response?.data;
  if (typeof data?.message === 'string') return data.message;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return fallback;
};

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  // ---- Filters ----
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // ---- Self password change ----
  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // ---- Admin reset ----
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetConfirmPw, setResetConfirmPw] = useState('');
  const [resettingPw, setResettingPw] = useState(false);

  // ---- Create user ----
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<string>('GRANTS_OFFICER');
  const [newUserPw, setNewUserPw] = useState('');
  const [newUserPwConfirm, setNewUserPwConfirm] = useState('');

  // ---- Deactivate confirm ----
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  // ---- Reactivate confirm ----
  const [reactivateTarget, setReactivateTarget] = useState<UserRow | null>(null);

  // ---- Hard delete confirm ----
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string; username: string; role: string; password: string;
    }) => {
      const res = await api.post('/users', payload);
      return res.data as UserRow;
    },
    onSuccess: (user) => {
      notifications.show({ title: 'User created', message: `${user.name} (${user.username})`, color: 'green' });
      invalidateUsers();
      resetCreateForm();
      setCreateOpen(false);
    },
    onError: (err: any) => {
      notifications.show({ title: 'Failed to create user', message: extractError(err, 'Unknown error'), color: 'red' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: (_d, id) => {
      const target = data?.find((u) => u.id === id);
      notifications.show({ title: 'User deactivated', message: target?.name ?? '', color: 'orange' });
      invalidateUsers();
      setDeactivateTarget(null);
    },
    onError: (err: any) => {
      notifications.show({ title: 'Failed to deactivate', message: extractError(err, 'Unknown error'), color: 'red' });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/users/${id}/reactivate`);
    },
    onSuccess: (_d, id) => {
      const target = data?.find((u) => u.id === id);
      notifications.show({ title: 'User reactivated', message: target?.name ?? '', color: 'green' });
      invalidateUsers();
      setReactivateTarget(null);
    },
    onError: (err: any) => {
      notifications.show({ title: 'Failed to reactivate', message: extractError(err, 'Unknown error'), color: 'red' });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}/permanent`);
    },
    onSuccess: (_d, id) => {
      const target = data?.find((u) => u.id === id);
      notifications.show({
        title: 'User permanently deleted',
        message: target ? `${target.name} (${target.username})` : '',
        color: 'red',
      });
      invalidateUsers();
      setDeleteTarget(null);
      setDeleteConfirmText('');
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const refs = data?.references as Record<string, number> | undefined;
      const message = refs
        ? `${data?.message || 'Cannot delete'} References: ${Object.entries(refs)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`
        : extractError(err, 'Unknown error');
      notifications.show({ title: 'Failed to permanently delete', message, color: 'red', autoClose: 8000 });
    },
  });

  const resetCreateForm = () => {
    setNewName('');
    setNewUsername('');
    setNewRole('GRANTS_OFFICER');
    setNewUserPw('');
    setNewUserPwConfirm('');
  };

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
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to change password'), color: 'red' });
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
      notifications.show({ title: 'Success', message: `Password reset for ${resetTarget.name}`, color: 'green' });
      setResetOpen(false);
      setResetTarget(null);
      setResetPw('');
      setResetConfirmPw('');
    } catch (err: any) {
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to reset password'), color: 'red' });
    } finally {
      setResettingPw(false);
    }
  };

  // ---- Validation derived state ----
  const usernameValid = /^[a-zA-Z0-9_.-]{3,32}$/.test(newUsername);
  const createPwOk = newUserPw.length >= 6 && newUserPw === newUserPwConfirm;
  const createCanSubmit = newName.trim() && usernameValid && newRole && createPwOk;

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const filteredUsers = useMemo(() => {
    const list = data || [];
    const filtered = statusFilter === 'all'
      ? list
      : list.filter((u) => (statusFilter === 'active' ? u.isActive : !u.isActive));
    return filtered.slice().sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [data, statusFilter]);

  const counts = useMemo(() => {
    const list = data || [];
    return {
      total: list.length,
      active: list.filter((u) => u.isActive).length,
      inactive: list.filter((u) => !u.isActive).length,
    };
  }, [data]);

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={1}>User Management</Title>
            <Text size="sm" c="dimmed" mt={4}>
              {counts.total} total · {counts.active} active · {counts.inactive} inactive
            </Text>
          </div>
          <Group gap="sm">
            <Button
              leftSection={<IconKey size={16} />}
              variant="light"
              onClick={() => setChangeOpen(true)}
            >
              Change My Password
            </Button>
            {isAdmin && (
              <Button
                leftSection={<IconUserPlus size={16} />}
                onClick={() => setCreateOpen(true)}
              >
                New User
              </Button>
            )}
          </Group>
        </Group>

        <Group justify="space-between">
          <SegmentedControl
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            data={[
              { label: `Active (${counts.active})`, value: 'active' },
              { label: `Inactive (${counts.inactive})`, value: 'inactive' },
              { label: `All (${counts.total})`, value: 'all' },
            ]}
          />
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
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Login</Table.Th>
                  {isAdmin && <Table.Th style={{ width: 60 }}>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredUsers.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={isAdmin ? 6 : 5}>
                      <Text c="dimmed" ta="center" py="md">No users match this filter.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {filteredUsers.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  const dimmed = !user.isActive;
                  return (
                    <Table.Tr key={user.id} style={dimmed ? { opacity: 0.55 } : undefined}>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Text fw={500} size="sm">{user.name}</Text>
                          {isSelf && <Badge size="xs" variant="outline">You</Badge>}
                        </Group>
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
                        <Badge color={user.isActive ? 'green' : 'gray'} variant={user.isActive ? 'light' : 'outline'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{formatDate(user.lastLoginAt)}</Text>
                      </Table.Td>
                      {isAdmin && (
                        <Table.Td>
                          <Menu shadow="md" position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon variant="subtle" aria-label="User actions">
                                <IconDots size={18} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconShieldLock size={14} />}
                                onClick={() => { setResetTarget(user); setResetOpen(true); }}
                              >
                                Reset password
                              </Menu.Item>
                              {user.isActive ? (
                                <Menu.Item
                                  color="orange"
                                  leftSection={<IconUserOff size={14} />}
                                  disabled={isSelf}
                                  onClick={() => setDeactivateTarget(user)}
                                >
                                  Deactivate
                                </Menu.Item>
                              ) : (
                                <Menu.Item
                                  color="green"
                                  leftSection={<IconUserCheck size={14} />}
                                  onClick={() => setReactivateTarget(user)}
                                >
                                  Reactivate
                                </Menu.Item>
                              )}
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                disabled={isSelf || user.isActive}
                                onClick={() => { setDeleteTarget(user); setDeleteConfirmText(''); }}
                              >
                                Permanently delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  );
                })}
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

      {/* Create user modal */}
      <Modal
        opened={createOpen}
        onClose={() => { if (!createMutation.isPending) { setCreateOpen(false); resetCreateForm(); } }}
        title="Create New User"
        centered
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Full Name"
            placeholder="Jane Doe"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Username"
            placeholder="jane.doe"
            value={newUsername}
            onChange={(e) => setNewUsername(e.currentTarget.value)}
            description="3-32 chars; letters, numbers, dot, dash, underscore"
            error={newUsername && !usernameValid ? 'Invalid username' : undefined}
            required
          />
          <Select
            label="Role"
            data={ROLE_OPTIONS}
            value={newRole}
            onChange={(v) => setNewRole(v || 'GRANTS_OFFICER')}
            allowDeselect={false}
            required
          />
          <Group gap="xs" align="flex-end">
            <PasswordInput
              label="Initial Password"
              placeholder="At least 6 characters"
              value={newUserPw}
              onChange={(e) => setNewUserPw(e.currentTarget.value)}
              style={{ flex: 1 }}
              required
            />
            <Tooltip label="Generate a strong password">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={() => {
                  const pw = generatePassword();
                  setNewUserPw(pw);
                  setNewUserPwConfirm(pw);
                }}
                aria-label="Generate password"
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            {newUserPw && (
              <CopyButton value={newUserPw}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied' : 'Copy password'}>
                    <ActionIcon variant="light" size="lg" color={copied ? 'green' : undefined} onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            )}
          </Group>
          <PasswordInput
            label="Confirm Password"
            placeholder="Re-enter password"
            value={newUserPwConfirm}
            onChange={(e) => setNewUserPwConfirm(e.currentTarget.value)}
            error={newUserPwConfirm && newUserPwConfirm !== newUserPw ? 'Passwords do not match' : undefined}
            required
          />
          <Alert color="blue" variant="light">
            Share this initial password with the user via a secure channel. They can change it from
            their own &quot;Change My Password&quot; menu after first login.
          </Alert>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => { setCreateOpen(false); resetCreateForm(); }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!createCanSubmit}
              onClick={() => createMutation.mutate({
                name: newName.trim(),
                username: newUsername.trim(),
                role: newRole,
                password: newUserPw,
              })}
            >
              Create User
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Deactivate confirm modal */}
      <Modal
        opened={!!deactivateTarget}
        onClose={() => { if (!deactivateMutation.isPending) setDeactivateTarget(null); }}
        title="Deactivate User"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Deactivate <strong>{deactivateTarget?.name}</strong> ({deactivateTarget?.username})?
            They will be unable to log in. This is reversible — you can reactivate them later.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setDeactivateTarget(null)}
              disabled={deactivateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="orange"
              loading={deactivateMutation.isPending}
              onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
            >
              Deactivate
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Reactivate confirm modal */}
      <Modal
        opened={!!reactivateTarget}
        onClose={() => { if (!reactivateMutation.isPending) setReactivateTarget(null); }}
        title="Reactivate User"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Reactivate <strong>{reactivateTarget?.name}</strong> ({reactivateTarget?.username})?
            They will be able to log in again with their existing password.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setReactivateTarget(null)}
              disabled={reactivateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="green"
              loading={reactivateMutation.isPending}
              onClick={() => reactivateTarget && reactivateMutation.mutate(reactivateTarget.id)}
            >
              Reactivate
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Permanent delete modal (type-username confirm) */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => { if (!hardDeleteMutation.isPending) { setDeleteTarget(null); setDeleteConfirmText(''); } }}
        title="Permanently Delete User"
        centered
      >
        <Stack gap="md">
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
            This action <strong>cannot be undone</strong>. The user record will be removed from the
            database. Audit history referencing them will be retained but anonymised.
          </Alert>
          <Text size="sm">
            If this user owns active applications, tasks, reviews, template usages, or attachments,
            deletion will be refused. Deactivate them instead in that case.
          </Text>
          <List size="sm" spacing={2} c="dimmed">
            <List.Item><strong>Name:</strong> {deleteTarget?.name}</List.Item>
            <List.Item><strong>Username:</strong> {deleteTarget?.username}</List.Item>
            <List.Item><strong>Role:</strong> {deleteTarget && (ROLE_LABELS[deleteTarget.role] || deleteTarget.role)}</List.Item>
          </List>
          <TextInput
            label={`Type "${deleteTarget?.username || ''}" to confirm`}
            placeholder={deleteTarget?.username || ''}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.currentTarget.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
              disabled={hardDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={hardDeleteMutation.isPending}
              disabled={!deleteTarget || deleteConfirmText !== deleteTarget.username}
              onClick={() => deleteTarget && hardDeleteMutation.mutate(deleteTarget.id)}
            >
              Permanently delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
