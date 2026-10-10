import { createContext, useContext, useEffect } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/clerk-react';
import { setClerkTokenProvider } from '../config/api';
import { queryClient } from '../config/queryClient';

const AuthContext = createContext({});

// This context intentionally exports its hook alongside the provider for the app's legacy API.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { isLoaded, isSignedIn, signIn, signUp, getToken, signOut, setActive } = useClerkAuth();
  const { user } = useUser();
  const clerk = useClerk();
  useEffect(() => {
    if (isLoaded) {
      setClerkTokenProvider(getToken);
    }
  }, [getToken, isLoaded]);

  const currentUser = user
    ? {
      ...user,
      uid: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      name: user.fullName || user.username || '',
      photoURL: user.imageUrl,
    }
    : null;

  const loginWithGoogle = async () => {
    await signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/login/sso-callback',
      redirectUrlComplete: '/',
    });
    return null;
  };

  const loginWithEmail = async (email, password) => {
    const result = await signIn.create({ identifier: email, password });
    if (result.status !== 'complete') {
      throw new Error('Additional sign-in verification is required.');
    }
    await setActive({ session: result.createdSessionId });
    return { user: { uid: result.createdUserId || user?.id } };
  };

  const registerWithEmail = async (email, password) => {
    const result = await signUp.create({ emailAddress: email, password });
    if (result.status !== 'complete') {
      throw new Error('Additional sign-up verification is required.');
    }
    await setActive({ session: result.createdSessionId });
    return { user: { uid: result.createdUserId } };
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
