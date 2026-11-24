import { createContext, useContext, useEffect } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser, useSignIn, useSignUp } from '@clerk/clerk-react';
import { setClerkTokenProvider } from '../config/api';
import { queryClient } from '../config/queryClient';

const AuthContext = createContext({});

// This context intentionally exports its hook alongside the provider for the app's legacy API.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { isLoaded: isAuthLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const { user, isLoaded: isUserLoaded } = useUser();
  const clerk = useClerk();

  const isLoaded = isAuthLoaded && isUserLoaded && isSignInLoaded && isSignUpLoaded;

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

  const setActive = setSignUpActive || setSignInActive || clerk.setActive;

  const loginWithGoogle = async (options = {}) => {
    const isSignUpMode = options.mode === 'sign_up';
    let authTarget;
    if (isSignUpMode) {
      authTarget = (isSignUpLoaded && signUp) || (isSignInLoaded && signIn) || clerk.client?.signUp || clerk.client?.signIn;
    } else {
      authTarget = (isSignInLoaded && signIn) || (isSignUpLoaded && signUp) || clerk.client?.signIn || clerk.client?.signUp;
    }

    if (!authTarget || typeof authTarget.authenticateWithRedirect !== 'function') {
      throw new Error('Authentication service is still initializing. Please wait a moment and try again.');
    }

    await authTarget.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/',
    });
    return null;
  };

  const loginWithEmail = async (email, password) => {
    const clientSignIn = (isSignInLoaded && signIn) || clerk.client?.signIn;
    if (!clientSignIn || typeof clientSignIn.create !== 'function') {
      throw new Error('Sign-in service is still initializing. Please wait a moment and try again.');
    }
    try {
      const result = await clientSignIn.create({ identifier: email, password });
      if (result.status !== 'complete') {
        throw new Error(`Additional sign-in verification is required (${result.status}).`);
      }
      if (setActive) {
        await setActive({ session: result.createdSessionId });
      }
      return { user: { uid: result.createdUserId || user?.id } };
    } catch (err) {
      const clerkErrorMsg = err.errors?.[0]?.message || err.errors?.[0]?.longMessage || err.message;
      const clerkErrorCode = err.errors?.[0]?.code || err.code;
      const customErr = new Error(clerkErrorMsg);
      customErr.code = clerkErrorCode;
      throw customErr;
    }
  };

  const registerWithEmail = async (email, password) => {
    const clientSignUp = (isSignUpLoaded && signUp) || clerk.client?.signUp;
    if (!clientSignUp || typeof clientSignUp.create !== 'function') {
      throw new Error('Sign-up service is still initializing. Please wait a moment and try again.');
    }
    try {
      const result = await clientSignUp.create({ emailAddress: email, password });
      if (result.status !== 'complete') {
        if (result.status === 'missing_requirements' && result.unverifiedFields?.includes('email_address')) {
          await clientSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          throw new Error('Please check your email for a verification code.');
        }
        throw new Error(`Additional sign-up verification is required (${result.status}).`);
      }
      if (setActive) {
        await setActive({ session: result.createdSessionId });
      }
      return { user: { uid: result.createdUserId } };
    } catch (err) {
      const clerkErrorMsg = err.errors?.[0]?.message || err.errors?.[0]?.longMessage || err.message;
      const clerkErrorCode = err.errors?.[0]?.code || err.code;
      const customErr = new Error(clerkErrorMsg);
      customErr.code = clerkErrorCode;
      throw customErr;
    }
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
