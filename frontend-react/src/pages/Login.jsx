import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { userService } from '../services/userService';

const Login = () => {
  const { currentUser, loginWithGoogle, loginWithEmail, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  // Handle users who navigate to /login while already authenticated
  useEffect(() => {
    if (currentUser) {
      setLoading('init');
      userService.getFullProfile(currentUser.uid)
        .then(() => {
          navigate('/');
        })
        .catch(async (err) => {
          if (err.response?.status === 404) {
            // Not registered yet, force log out so they can sign up properly
            await logout();
            setError('Account not found. Please sign up instead.');
          }
        })
        .finally(() => setLoading(''));
    }
  }, [currentUser, navigate, logout]);

  const handleGoogleLogin = async () => {
    try {
      setLoading('google');
      const cred = await loginWithGoogle();
      
      try {
        await userService.getFullProfile(cred.user.uid);
        navigate('/');
      } catch (err) {
        await logout();
        if (err.response?.status === 404) {
          setError('Account not found. Please sign up instead.');
        } else {
          setError('Failed to fetch profile. Please try again.');
        }
      }
    } catch {
      setError('Google login is restricted for unverified testers. Please use email and password below.');
    } finally {
      setLoading('');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading('email');
      const cred = await loginWithEmail(email, password);
      
      try {
        await userService.getFullProfile(cred.user.uid);
        navigate('/');
      } catch (err) {
        await logout();
        if (err.response?.status === 404) {
          setError('Account not found. Please sign up instead.');
        } else {
          setError('Failed to fetch profile. Please try again.');
        }
      }
    } catch (err) {
      setError('Failed to log in: ' + err.message);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="bg-background-deep text-on-background min-h-screen flex flex-col justify-center items-center font-body-md overflow-x-hidden relative p-margin-mobile">
      {/* Decorative Background */}
      <div className="blob-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Login Container */}
      <main className="w-full max-w-md bg-surface-container rounded-[2rem] p-8 shadow-[0px_10px_40px_rgba(0,0,0,0.5)] border border-surface-raised relative z-10 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="mb-8 flex flex-col items-center">
          <h1 className="font-headline-xl text-headline-xl text-success-lime tracking-tighter mb-2">Mindcraft</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">Your academic playground awaits.</p>
        </div>

        {error && <div className="text-red-500 mb-4">{error}</div>}

        {/* Social Login */}
        <button 
          onClick={handleGoogleLogin}
          disabled={!!loading}
          className="squish-btn w-full bg-white text-[#131313] font-label-lg text-label-lg rounded-full py-4 px-6 flex items-center justify-center gap-3 border-b-4 border-gray-300 transition-all duration-150 mb-8 hover:bg-gray-50"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
          {loading === 'google' ? <Loader2 size={20} className="animate-spin" /> : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="w-full flex items-center gap-4 mb-8">
          <div className="h-px bg-surface-raised flex-1"></div>
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">or</span>
          <div className="h-px bg-surface-raised flex-1"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailLogin} className="w-full flex flex-col gap-5">
          {/* Email Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="text-on-surface-variant" size={20} />
            </div>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input w-full bg-background-deep rounded-[24px] py-4 pl-12 pr-4 font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant" 
              placeholder="Email Address" 
              required
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="text-on-surface-variant" size={20} />
            </div>
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input w-full bg-background-deep rounded-[24px] py-4 pl-12 pr-12 font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant" 
              placeholder="Password" 
              required
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-focus-purple transition-colors"
            >
              {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end w-full px-2">
            <a className="font-label-md text-label-md text-secondary hover:text-success-lime transition-colors" href="#">Forgot Password?</a>
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={!!loading}
            className="squish-btn w-full bg-success-lime text-[#151f00] font-headline-md text-headline-md rounded-full py-4 mt-2 border-b-4 border-[#b3d266] shadow-[0px_5px_15px_rgba(220,253,139,0.2)] transition-all duration-150"
          >
            {loading === 'email' ? <Loader2 size={22} className="animate-spin mx-auto" /> : 'Log In'}
          </button>
        </form>

        {/* Sign Up Link */}
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-8 text-center">
          Don't have an account? <br className="sm:hidden" />
          <Link to="/signup" className="font-label-lg text-label-lg text-success-lime hover:text-focus-purple transition-colors underline decoration-2 underline-offset-4 ml-1">Sign Up</Link>
        </p>

        {/* Force Logout / Reset */}
        <button 
          onClick={async () => { try { await logout(); } catch { setError('Could not force log out. Please refresh and try again.'); } }}
          className="font-label-sm text-on-surface-variant hover:text-red-500 mt-6 underline text-xs transition-colors"
        >
          Having trouble? Force Log Out
        </button>
      </main>
    </div>
  );
};

export default Login;
