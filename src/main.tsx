import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { RoleProvider } from './contexts/RoleContext';
import { router } from './router';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <RouterProvider router={router} />
      </RoleProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
