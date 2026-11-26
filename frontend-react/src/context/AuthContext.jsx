import { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/react';
import api, { setClerkTokenProvider } from '../config/api';
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

  const [userProfile, setUserProfile] = useState(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (isAuthLoaded) {
      setClerkTokenProvider(getToken);
    }
  }, [getToken, isAuthLoaded]);

  const refreshProfile = useCallback(async () => {
    if (!isSignedIn) {
      setUserProfile(null);
      setIsRegistered(false);
      setNeedsOnboarding(false);
      setIsCheckingProfile(false);
      return { success: false, registered: false, needsOnboarding: false, user: null };
    }

    setIsCheckingProfile(true);
    try {
      const res = await api.get('/auth/me');
      const data = res.data;
      if (data?.registered && data?.user) {
        setUserProfile(data.user);
        setIsRegistered(true);
        setNeedsOnboarding(false);
        return { success: true, registered: true, needsOnboarding: false, user: data.user };
      } else {
        setUserProfile(null);
        setIsRegistered(false);
        setNeedsOnboarding(true);
        return {
          success: true,
          registered: false,
          needsOnboarding: true,
          user: null,
          message: data?.message || 'Profile not completed',
        };
      }
    } catch (err) {
      console.error('Failed to verify profile status:', err);
      setUserProfile(null);
      setIsRegistered(false);
      setNeedsOnboarding(true);
      return {
        success: false,
        registered: false,
        needsOnboarding: true,
        user: null,
        error: err?.message || 'Profile status check failed',
      };
    } finally {
      setIsCheckingProfile(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    let isCancelled = false;

    if (isSignedIn) {
      queueMicrotask(() => {
        if (!isCancelled) {
          refreshProfile();
        }
      });
    } else {
      queueMicrotask(() => {
        if (!isCancelled) {
          setUserProfile(null);
          setIsRegistered(false);
          setNeedsOnboarding(false);
          setIsCheckingProfile(false);
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, isSignedIn, refreshProfile]);

  const currentUser = useMemo(() => {
    if (!user) return null;
    const base = {
      ...user,
      uid: user.id,
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      name: user.fullName || user.username || '',
      photoURL: user.imageUrl,
    };

    if (userProfile) {
      return {
        ...base,
        ...userProfile,
        uid: userProfile.uid || userProfile.id || user.id,
        id: userProfile.id || userProfile.uid || user.id,
        photoURL: userProfile.photoUrl || base.photoURL,
        email: userProfile.email || base.email,
        name: userProfile.name || base.name,
      };
    }

    return base;
  }, [user, userProfile]);

  useEffect(() => {
    if (!isSignedIn || !isRegistered || needsOnboarding) return;
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const storageKey = `mindcraft_checkin_${uid}_${todayStr}`;

    if (localStorage.getItem(storageKey)) return;

    let isMounted = true;
    api.post('/streak/checkin')
      .then((res) => {
        if (!isMounted) return;
        localStorage.setItem(storageKey, 'true');
        queryClient.invalidateQueries({ queryKey: ['streak'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['badges'] });
        queryClient.invalidateQueries({ queryKey: ['tokens'] });

        const updatedStreak = res.data?.data?.currentStreak;
        if (typeof updatedStreak === 'number') {
          setUserProfile((prev) => (prev ? { ...prev, currentStreak: updatedStreak } : prev));
        }
      })
      .catch((err) => {
        console.warn('Auto streak check-in skipped/failed:', err?.message);
      });

    return () => {
      isMounted = false;
    };
  }, [isSignedIn, isRegistered, needsOnboarding, currentUser?.uid, currentUser?.id]);

  // Safe fallback auth methods delegating to Clerk's modal or navigation API
  const loginWithGoogle = useCallback(async () => {
    if (clerk?.openSignIn) {
      clerk.openSignIn({});
      return null;
    }
    if (clerk?.redirectToSignIn) {
      await clerk.redirectToSignIn({ redirectUrl: '/' });
      return null;
    }
    return null;
  }, [clerk]);

  const loginWithEmail = useCallback(async () => {
    if (clerk?.openSignIn) {
      clerk.openSignIn({});
      return null;
    }
    if (clerk?.redirectToSignIn) {
      await clerk.redirectToSignIn({ redirectUrl: '/' });
      return null;
    }
    return null;
  }, [clerk]);

  const registerWithEmail = useCallback(async () => {
    if (clerk?.openSignUp) {
      clerk.openSignUp({});
      return null;
    }
    if (clerk?.redirectToSignUp) {
      await clerk.redirectToSignUp({ redirectUrl: '/signup' });
      return null;
    }
    return null;
  }, [clerk]);

  const logout = useCallback(async () => {
    setUserProfile(null);
    setIsRegistered(false);
    setNeedsOnboarding(false);
    setIsCheckingProfile(false);
    await signOut();
    queryClient.clear();
  }, [signOut]);

  const value = useMemo(() => ({
    currentUser,
    userProfile,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    isCheckingProfile,
    isRegistered,
    needsOnboarding,
    refreshProfile,
    clerk,
    getToken,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
  }), [
    currentUser,
    userProfile,
    isLoaded,
    isSignedIn,
    isCheckingProfile,
    isRegistered,
    needsOnboarding,
    refreshProfile,
    clerk,
    getToken,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
