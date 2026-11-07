import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import ErrorBoundary from './components/ErrorBoundary';
import ClerkSetupScreen from './components/ClerkSetupScreen';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isPlaceholderKey =
  !clerkPublishableKey ||
  clerkPublishableKey === 'pk_test_replace_me' ||
  !clerkPublishableKey.startsWith('pk_');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isPlaceholderKey ? (
        <ClerkSetupScreen />
      ) : (
        <ClerkProvider publishableKey={clerkPublishableKey}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </QueryClientProvider>
        </ClerkProvider>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
