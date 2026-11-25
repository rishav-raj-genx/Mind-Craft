import { createContext, useContext, useEffect } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/react';
import { setClerkTokenProvider } from '../config/api';
import { queryClient } from '../config/queryClient';

const AuthContext = createContext({});

// This context intentionally exports its hook alongside the provider for the app's legacy API.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { isLoaded: isAuthLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const clerk = useClerk();

  const isLoaded = isAuthLoaded && isUserLoaded;

  useEffect(() => {
    if (isAuthLoaded) {
      setClerkTokenProvider(getToken);
    }
  }, [getToken, isAuthLoaded]);

  const currentUser = user
    ? {
      ...user,
      uid: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      name: user.fullName || user.username || '',
      photoURL: user.imageUrl,
    }
    : null;

  // Safe fallback auth methods delegating to Clerk's modal or navigation API
  const loginWithGoogle = async () => {
    if (clerk?.openSignIn) {
      clerk.openSignIn({});
      return null;
    }
    if (clerk?.redirectToSignIn) {
      await clerk.redirectToSignIn({ redirectUrl: '/' });
      return null;
    }
    return null;
  };

  const loginWithEmail = async () => {
    if (clerk?.openSignIn) {
      clerk.openSignIn({});
      return null;
    }
    if (clerk?.redirectToSignIn) {
      await clerk.redirectToSignIn({ redirectUrl: '/' });
      return null;
    }
    return null;
  };

  const registerWithEmail = async () => {
    if (clerk?.openSignUp) {
      clerk.openSignUp({});
      return null;
    }
    if (clerk?.redirectToSignUp) {
      await clerk.redirectToSignUp({ redirectUrl: '/signup' });
      return null;
    }
    return null;
  };

  const logout = async () => {
    await signOut();
    queryClient.clear();
  };

  const value = {
    currentUser,
    isLoaded,
    isSignedIn,
    clerk,
    getToken,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {isLoaded ? children : null}
    </AuthContext.Provider>
  );
};
