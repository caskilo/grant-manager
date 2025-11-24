import { Group, Title, Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';
import { notifications } from '@mantine/notifications';

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
        color: 'green',
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      logout();
      navigate('/login');
    }
  };

  return (
    <Group h="100%" px="md" justify="space-between">
      <Title order={3}>Odyssean Grant Manager</Title>
      <Group>
        <span>{user?.name}</span>
        <Button variant="subtle" onClick={handleLogout}>
          Logout
        </Button>
      </Group>
    </Group>
  );
}
