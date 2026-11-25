import { useEffect } from 'react';
import { SignIn } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFullProfile } from '../hooks/useUserProfile';
import { clerkAppearance } from '../config/clerkAppearance';

const Login = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data: profileRes, isLoading } = useFullProfile(currentUser?.uid, {
    retry: false,
    enabled: Boolean(currentUser?.uid),
  });

  const isProfileComplete = Boolean(
    profileRes?.data?.profileComplete ??
    profileRes?.data?.user?.profileComplete ??
    profileRes?.profileComplete
  );

  useEffect(() => {
    if (currentUser && !isLoading) {
      if (isProfileComplete) {
        navigate('/');
      } else {
        navigate('/signup');
      }
    }
  }, [currentUser, isLoading, isProfileComplete, navigate]);

  return (
    <div className="bg-background-deep text-on-background min-h-screen flex flex-col justify-center items-center font-body-md overflow-x-hidden relative p-4">
      {/* Decorative Background */}
      <div className="blob-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Brand Logo */}
        <div className="mb-6 flex flex-col items-center">
          <h1 className="font-headline-xl text-headline-xl text-success-lime tracking-tighter mb-1">Mindcraft</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">Your academic playground awaits.</p>
        </div>

        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/signup"
          forceRedirectUrl="/"
          appearance={clerkAppearance}
        />
      </div>
    </div>
  );
};

export default Login;
