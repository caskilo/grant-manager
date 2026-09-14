import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Box,
  useMantineTheme,
} from '@mantine/core';
import { IconCompass } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);
  const setTokens = useAuthStore((state) => state.setTokens);
  const navigate = useNavigate();
  const theme = useMantineTheme();

  // Show a notification if the user was redirected due to session expiry
  useEffect(() => {
    const expired = sessionStorage.getItem('session_expired');
    if (expired) {
      sessionStorage.removeItem('session_expired');
      notifications.show({
        title: 'Session Expired',
        message: 'Your session has expired. Please sign in again.',
        color: 'orange',
        autoClose: 8000,
      });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { user, accessToken, refreshToken } = response.data;
      
      setUser(user);
      setTokens(accessToken, refreshToken);
      
      notifications.show({
        title: 'Welcome back',
        message: `Signed in as ${user.name}`,
        color: 'teal',
      });
      navigate('/dashboard');
    } catch (error: any) {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.message;

      let title = 'Authentication failed';
      let message = 'An unexpected error occurred. Please try again.';
      let color = 'red';

      if (!error.response) {
        title = 'Connection error';
        message = 'Could not reach the server. Please check your internet connection.';
        color = 'orange';
      } else if (status === 401) {
        message = serverMsg || 'Invalid username or password. Please try again.';
      } else if (status === 403) {
        title = 'Account disabled';
        message = serverMsg || 'Your account has been disabled. Please contact an administrator.';
      } else if (status && status >= 500) {
        title = 'Server error';
        message = 'The server encountered an error. Please try again later.';
        color = 'orange';
      } else {
        message = serverMsg || message;
      }

      notifications.show({ title, message, color });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.other.gradients.login,
        backgroundSize: '400% 400%',
        animation: 'oceanShift 20s ease infinite',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle wave overlay */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.06,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23ffffff' d='M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,154.7C672,149,768,171,864,186.7C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'bottom',
          backgroundSize: '100% 200px',
        }}
      />

      <Paper
        shadow="xl"
        p={40}
        radius="lg"
        style={{
          width: 400,
          maxWidth: '90vw',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Stack align="center" gap={4} mb="xl">
          <IconCompass size={44} stroke={1.5} color={theme.colors.odyssean[5]} />
          <Title order={2} ta="center" style={{ color: theme.colors.odyssean[9], letterSpacing: '-0.5px' }}>
            Odyssean Institute
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Grant Management System
          </Text>
        </Stack>

        <form onSubmit={handleLogin}>
          <Stack gap="md">
            <TextInput
              data-testid="login-username"
              label="Username"
              placeholder="Enter your username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              styles={{
                input: { borderColor: '#d0d5dd', '&:focus': { borderColor: theme.colors.odyssean[5] } },
              }}
            />

            <PasswordInput
              data-testid="login-password"
              label="Password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              styles={{
                input: { borderColor: '#d0d5dd', '&:focus': { borderColor: theme.colors.odyssean[5] } },
              }}
            />

            <Button
              data-testid="login-submit"
              type="submit"
              fullWidth
              loading={loading}
              size="md"
              style={{
                background: theme.other.gradients.loginButton,
                marginTop: 8,
              }}
            >
              Sign In
            </Button>
          </Stack>
        </form>
      </Paper>

      <style>{`
        @keyframes oceanShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </Box>
  );
}
