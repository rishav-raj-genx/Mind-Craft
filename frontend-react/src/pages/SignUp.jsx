import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, X, Rocket } from 'lucide-react';
import { userService } from '../services/userService';

const SignUp = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [teachInput, setTeachInput] = useState('');
  const [learnInput, setLearnInput] = useState('');
  const [teaches, setTeaches] = useState(['Calculus 101']);
  const [learns, setLearns] = useState(['Organic Chem']);
  const [error, setError] = useState('');

  const handleGoogleSignup = async (e) => {
    e.preventDefault();
    try {
      setError('');
      // 1. Authenticate with Firebase via Google popup
      const result = await loginWithGoogle();
      
      // 2. Register profile in the backend
      const userData = {
        name,
        college,
        department: "General", // Placeholder for MVP
        year: 2, // Placeholder for MVP
        teaches,
        learns,
      };
      
      await userService.register(userData);
      navigate('/');
    } catch (err) {
      setError('Failed to sign up: ' + err.message);
    }
  };

  const handleAddTeach = (e) => {
    if (e.key === 'Enter' && teachInput.trim()) {
      e.preventDefault();
      setTeaches([...teaches, teachInput.trim()]);
      setTeachInput('');
    }
  };

  const handleAddLearn = (e) => {
    if (e.key === 'Enter' && learnInput.trim()) {
      e.preventDefault();
      setLearns([...learns, learnInput.trim()]);
      setLearnInput('');
    }
  };

  const removeTeach = (topic) => {
    setTeaches(teaches.filter(t => t !== topic));
  };

  const removeLearn = (topic) => {
    setLearns(learns.filter(t => t !== topic));
  };

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop antialiased">
      <main className="w-full max-w-[480px] bg-surface-container rounded-xl p-8 shadow-[0px_10px_30px_rgba(0,0,0,0.4)] border border-surface-raised relative overflow-hidden">
        {/* Decorative Header Elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary-container rounded-full blur-3xl opacity-20"></div>
        <div className="absolute top-20 -left-10 w-24 h-24 bg-primary-container rounded-full blur-2xl opacity-10"></div>

        <header className="text-center mb-8 relative z-10">
          <h1 className="font-headline-xl text-headline-xl text-success-lime tracking-tighter mb-2">Mindcraft</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Level up your learning together.</p>
        </header>

        {error && <div className="text-red-500 mb-4 z-10 relative">{error}</div>}

        <form onSubmit={handleGoogleSignup} className="space-y-6 relative z-10">
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Preferred Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
              <input 
                value={name} onChange={(e) => setName(e.target.value)}
                className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50" 
                placeholder="What should we call you?" 
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">College or Location</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
              <input 
                value={college} onChange={(e) => setCollege(e.target.value)}
                className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50" 
                placeholder="e.g., University of Science" 
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Topics I Can Teach</label>
            <div className="flex flex-wrap gap-2 p-3 bg-background-deep border border-surface-raised rounded-xl min-h-[48px]">
              {teaches.map(t => (
                <div key={t} className="inline-flex items-center gap-1 bg-surface-raised text-on-surface px-3 py-1.5 rounded-full font-label-md text-label-md border border-outline-variant">
                  {t}
                  <X size={14} className="cursor-pointer" onClick={() => removeTeach(t)} />
                </div>
              ))}
              <input 
                value={teachInput} onChange={e => setTeachInput(e.target.value)} onKeyDown={handleAddTeach}
                className="bg-transparent border-none outline-none text-on-surface flex-1 min-w-[100px] py-1 focus:ring-0" 
                placeholder="+ Add topic" 
              />
            </div>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Topics I Want to Learn</label>
            <div className="flex flex-wrap gap-2 p-3 bg-background-deep border border-surface-raised rounded-xl min-h-[48px]">
              {learns.map(l => (
                <div key={l} className="inline-flex items-center gap-1 bg-secondary-container/30 text-secondary-fixed px-3 py-1.5 rounded-full font-label-md text-label-md border border-secondary-container">
                  {l}
                  <X size={14} className="cursor-pointer" onClick={() => removeLearn(l)} />
                </div>
              ))}
              <input 
                value={learnInput} onChange={e => setLearnInput(e.target.value)} onKeyDown={handleAddLearn}
                className="bg-transparent border-none outline-none text-on-surface flex-1 min-w-[100px] py-1 focus:ring-0" 
                placeholder="+ Add topic" 
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-success-lime text-on-primary-fixed font-headline-md text-[18px] rounded-full py-4 px-6 flex items-center justify-center gap-2 tactile-button border-[#b3d266] mt-8 hover:bg-primary-fixed"
          >
            Start Crafting with Google <Rocket size={20} />
          </button>
        </form>

        <div className="text-center mt-6 relative z-10">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Already have an account? <Link to="/login" className="text-success-lime hover:underline font-label-md">Log in here</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignUp;
