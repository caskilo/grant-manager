import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { theme } from './theme';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './styles/globals.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Surface server-unreachable / 5xx failures so pages don't sit empty
    // silently. 401s are handled by the axios interceptor (refresh → logout).
    onError: (error: any) => {
      const status = error?.response?.status;
      if (status && status < 500) return;
      notifications.show({
        title: 'Connection problem',
        message: 'Could not reach the server — data may be missing or stale.',
        color: 'red',
        autoClose: 8000,
      });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Notifications position="top-center" />
          <App />
          {/* <ReactQueryDevtools initialIsOpen={false} /> */}
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);
