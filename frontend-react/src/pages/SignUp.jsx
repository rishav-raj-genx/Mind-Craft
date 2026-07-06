import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, X, Rocket, Code, ChevronDown, ChevronUp, GraduationCap, Building2, Moon, Sun, Camera, Edit2, Loader2, CheckCircle2, Link2 } from 'lucide-react';
import { userService } from '../services/userService';
import { useAppContext } from '../context/AppContext';

const GithubIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.2-3.8s-1.2-.4-3.9 1.4a13.3 13.3 0 0 0-7 0C6.2 1.6 5 2 5 2a5.5 5.5 0 0 0-.2 3.8A5.5 5.5 0 0 0 3 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path><path d="M9 18c-4.5 1.5-5-2.5-7-3"></path></svg>
);

const LinkedinIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

const LeetCodeIcon = ({ size = 18, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z"/>
  </svg>
);

const CodeforcesIcon = ({ size = 18, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4.5 7.5C5.328 7.5 6 8.172 6 9v10.5c0 .828-.672 1.5-1.5 1.5h-3C.672 21 0 20.328 0 19.5V9c0-.828.672-1.5 1.5-1.5h3zm9-4.5c.828 0 1.5.672 1.5 1.5v15c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5v-15c0-.828.672-1.5 1.5-1.5h3zm9 7.5c.828 0 1.5.672 1.5 1.5v7.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V12c0-.828.672-1.5 1.5-1.5h3z"/>
  </svg>
);

const CodeChefIcon = ({ size = 18, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.257.004c-.513.039-1.07.205-1.632.53-.89.515-1.387 1.237-1.727 1.977-.228.498-.384 1.023-.52 1.478-.093.312-.18.588-.268.781-.09.198-.156.263-.21.304-.114.088-.358.164-.96.164H5.534c-.237 0-.467.018-.694.045C2.82 5.52 1.166 7.06.502 9.104c-.207.635-.3 1.323-.324 1.965-.023.643.018 1.244.037 1.67L.222 12.8c.003.066.015.304.015.304l.075 1.16c.063.754.173 1.61.442 2.44.537 1.656 1.68 3.194 3.76 3.95C5.59 21.022 6.927 21.42 8.386 21.63c.467.067.944.113 1.427.14.396 1.16 1.206 2.223 2.607 2.223h.16c1.4 0 2.21-1.063 2.606-2.223.483-.027.96-.073 1.427-.14 1.46-.21 2.797-.608 3.873-.975 2.08-.756 3.222-2.294 3.76-3.95.268-.83.378-1.686.44-2.44l.076-1.16s.013-.238.016-.304l.007-.06c.02-.427.06-1.028.037-1.671-.024-.642-.117-1.33-.324-1.965-.664-2.044-2.318-3.583-4.34-3.82a5.93 5.93 0 0 0-.694-.045h-.406c-.602 0-.846-.076-.96-.164-.054-.04-.12-.106-.21-.304-.088-.193-.175-.469-.268-.78-.136-.456-.292-.98-.52-1.48-.34-.74-.838-1.46-1.727-1.976A3.32 3.32 0 0 0 12.58 0c-.223 0-.445.017-.66.036l-.663-.032z"/>
  </svg>
);

// ─── Image Compression via Canvas ──────────────────────────────────────
const compressImage = (file, maxDimension = 480, maxBytes = 180 * 1024) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        while (dataUrl.length * 0.75 > maxBytes && quality > 0.42) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/webp', quality);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

const SocialLinksModal = ({ socials, onSave, onClose }) => {
  const [links, setLinks] = useState(socials);
  const [error, setError] = useState('');

  const validateLink = (val, domain) => {
    if (!val) return true;
    try {
      const url = new URL(val.startsWith('http') ? val : `https://${val}`);
      return url.hostname.toLowerCase().includes(domain);
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    if (links.linkedin && !validateLink(links.linkedin, 'linkedin.com')) return setError('Invalid LinkedIn URL (must be a proper linkedin.com link)');
    if (links.github && !validateLink(links.github, 'github.com')) return setError('Invalid GitHub URL (must be a proper github.com link)');
    if (links.leetcode && !validateLink(links.leetcode, 'leetcode.com')) return setError('Invalid LeetCode URL (must be a proper leetcode.com link)');
    if (links.codeforces && !validateLink(links.codeforces, 'codeforces.com')) return setError('Invalid Codeforces URL (must be a proper codeforces.com link)');
    if (links.codechef && !validateLink(links.codechef, 'codechef.com')) return setError('Invalid CodeChef URL (must be a proper codechef.com link)');
    
    // Extract usernames from full URLs to save to DB
    const extract = (val) => {
      if (!val) return '';
      try {
        const u = new URL(val.startsWith('http') ? val : `https://${val}`);
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1]; // E.g., 'in/username' -> 'username' for LinkedIn might be tricky, but works for most. For robust extraction, we just assume the last part is the username.
      } catch {
        return val.trim();
      }
    };

    onSave({
      linkedinUsername: extract(links.linkedin),
      githubUsername: extract(links.github),
      leetcodeUsername: extract(links.leetcode),
      codeforcesUsername: extract(links.codeforces),
      codechefUsername: extract(links.codechef),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-surface-container rounded-3xl p-6 w-full max-w-sm flex flex-col relative animate-[slideUp_0.2s_ease-out]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 dark:text-on-surface hover:text-gray-900 dark:hover:text-white"
        >
          <X size={20} />
        </button>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Add Social Profiles</h3>
        
        {error && <div className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">{error}</div>}

        <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] pb-4 hide-scrollbar">
          <div className="relative">
            <LinkedinIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0077B5]" size={18} />
            <input 
              value={links.linkedin} onChange={(e) => setLinks({...links, linkedin: e.target.value})}
              className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 text-sm" 
              placeholder="https://linkedin.com/in/username" 
            />
          </div>
          <div className="relative">
            <GithubIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface" size={18} />
            <input 
              value={links.github} onChange={(e) => setLinks({...links, github: e.target.value})}
              className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 text-sm" 
              placeholder="https://github.com/username" 
            />
          </div>
          <div className="relative">
            <LeetCodeIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={18} />
            <input 
              value={links.leetcode} onChange={(e) => setLinks({...links, leetcode: e.target.value})}
              className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 text-sm" 
              placeholder="https://leetcode.com/u/username" 
            />
          </div>
          <div className="relative">
            <CodeforcesIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={18} />
            <input 
              value={links.codeforces} onChange={(e) => setLinks({...links, codeforces: e.target.value})}
              className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 text-sm" 
              placeholder="https://codeforces.com/profile/username" 
            />
          </div>
          <div className="relative">
            <CodeChefIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-700" size={18} />
            <input 
              value={links.codechef} onChange={(e) => setLinks({...links, codechef: e.target.value})}
              className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 text-sm" 
              placeholder="https://www.codechef.com/users/username" 
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="w-full mt-4 bg-success-lime text-[#151f00] font-bold py-3 rounded-xl hover:bg-[#b3d266] transition-colors"
        >
          Save Profiles
        </button>
      </div>
    </div>
  );
};

const SignUp = () => {
  const { loginWithGoogle } = useAuth();
  const { isDark, setIsDark } = useAppContext();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [gender, setGender] = useState('');
  const [college, setCollege] = useState('');
  const [collegeLocation, setCollegeLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [teachInput, setTeachInput] = useState('');
  const [learnInput, setLearnInput] = useState('');
  const [teaches, setTeaches] = useState([]);
  const [learns, setLearns] = useState([]);
  const [linkedinUsername, setLinkedinUsername] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [leetcodeUsername, setLeetcodeUsername] = useState('');
  const [codeforcesUsername, setCodeforcesUsername] = useState('');
  const [codechefUsername, setCodechefUsername] = useState('');
  const [showSocials, setShowSocials] = useState(false);
  const [error, setError] = useState('');
  const [collegeOptions, setCollegeOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);

  // Fetch global college/department suggestions
  useEffect(() => {
    userService.getMetadataOptions()
      .then(res => {
        if (res.data) {
          setCollegeOptions(res.data.colleges || []);
          setDepartmentOptions(res.data.departments || []);
        }
      })
      .catch(() => { /* silent - suggestions just won't show */ });
  }, []);

  const photoInputRef = useRef(null);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressedDataUrl = await compressImage(file);
      setPhotoUrl(compressedDataUrl);
    } catch (err) {
      setError('Failed to process image');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleGoogleSignup = async (e) => {
    e.preventDefault();
    if (!college.trim() || !collegeLocation.trim() || !department.trim() || !year.trim() || !gender) {
      setError('Please fill in all required fields: Gender, College, Location, Department, and Year.');
      return;
    }
    if (teaches.length === 0 || learns.length === 0) {
      setError('Please add at least one topic you teach and one you want to learn.');
      return;
    }
    try {
      setError('');
      const result = await loginWithGoogle();
      
      let finalPhotoUrl = photoUrl || result.user.photoURL;
      if (!photoUrl) {
        // Fallback to cute avatars based on gender if no photo uploaded
        const encodedName = encodeURIComponent(name || 'User');
        if (gender === 'Male') {
          finalPhotoUrl = `https://avatar.iran.liara.run/public/boy?username=${encodedName}`;
        } else if (gender === 'Female') {
          finalPhotoUrl = `https://avatar.iran.liara.run/public/girl?username=${encodedName}`;
        } else {
          finalPhotoUrl = `https://avatar.iran.liara.run/public?username=${encodedName}`;
        }
      }

      const userData = {
        name,
        photoUrl: finalPhotoUrl,
        gender,
        college,
        collegeLocation,
        department,
        year,
        teaches,
        learns,
        linkedinUsername,
        githubUsername,
        leetcodeUsername,
        codeforcesUsername,
        codechefUsername,
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
      if (!teaches.includes(teachInput.trim())) {
        setTeaches([...teaches, teachInput.trim()]);
      }
      setTeachInput('');
    }
  };

  const handleAddLearn = (e) => {
    if (e.key === 'Enter' && learnInput.trim()) {
      e.preventDefault();
      if (!learns.includes(learnInput.trim())) {
        setLearns([...learns, learnInput.trim()]);
      }
      setLearnInput('');
    }
  };

  const removeTeach = (topic) => setTeaches(teaches.filter(t => t !== topic));
  const removeLearn = (topic) => setLearns(learns.filter(t => t !== topic));

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

        {error && <div className="text-red-500 mb-4 z-10 relative text-sm">{error}</div>}

        <form onSubmit={handleGoogleSignup} className="space-y-5 relative z-10">
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          
          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden border-[3px] border-success-lime shadow-[0_0_15px_rgba(220,253,139,0.2)] bg-surface-raised flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={32} className="text-on-surface-variant/50" />
                )}
              </div>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-success-lime rounded-full flex items-center justify-center border-2 border-surface-container shadow-md hover:bg-[#b3d266] transition-colors"
              >
                {uploadingPhoto ? <Loader2 size={14} className="text-[#151f00] animate-spin" /> : <Edit2 size={14} className="text-[#151f00]" />}
              </button>
            </div>
            <span className="text-xs font-label-sm text-on-surface-variant mt-2">Add Profile Picture</span>
          </div>

          {/* Name */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Preferred Name *</label>
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

          {/* Gender */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Gender *</label>
            <div className="flex gap-2">
              {['Male', 'Female', 'Other'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-full text-sm font-semibold border transition-all ${
                    gender === g
                      ? 'bg-success-lime text-[#151f00] border-success-lime shadow-[0_0_10px_rgba(220,253,139,0.3)]'
                      : 'bg-background-deep text-on-surface-variant border-surface-raised hover:border-success-lime/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* College Name with autocomplete */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">College Name *</label>
            <div className="relative">
              <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
              <input 
                list="college-options"
                value={college} onChange={(e) => setCollege(e.target.value)}
                className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50" 
                placeholder="e.g., IIT Delhi" 
                required
              />
              <datalist id="college-options">
                {collegeOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* College Location */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">College Location *</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
              <input 
                value={collegeLocation} onChange={(e) => setCollegeLocation(e.target.value)}
                className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50" 
                placeholder="e.g., New Delhi, India" 
                required
              />
            </div>
          </div>

          {/* Department with autocomplete */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Department *</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
              <input 
                list="department-options"
                value={department} onChange={(e) => setDepartment(e.target.value)}
                className="glass-input w-full rounded-full py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50" 
                placeholder="e.g., Computer Science" 
                required
              />
              <datalist id="department-options">
                {departmentOptions.map(d => <option key={d} value={d} />)}
              </datalist>
            </div>
          </div>

          {/* Year */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Year *</label>
            <div className="flex gap-2">
              {['1', '2', '3', '4'].map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={`flex-1 py-2.5 rounded-full text-sm font-semibold border transition-all ${
                    year === y
                      ? 'bg-success-lime text-[#151f00] border-success-lime shadow-[0_0_10px_rgba(220,253,139,0.3)]'
                      : 'bg-background-deep text-on-surface-variant border-surface-raised hover:border-success-lime/50'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Topics I Can Teach */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Topics I Can Teach *</label>
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

          {/* Topics I Want to Learn */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 pl-1">Topics I Want to Learn *</label>
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

          {/* Social Profiles */}
          <div className="pt-2 border-t border-surface-raised mt-4 relative z-10">
            <button
              type="button"
              onClick={() => setShowSocials(true)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-success-lime text-success-lime font-bold hover:bg-success-lime/10 transition-colors shadow-[0_0_15px_rgba(220,253,139,0.1)]"
            >
              <Link2 size={20} /> Add Social Profiles (Optional)
            </button>
            
            {showSocials && (
              <SocialLinksModal 
                socials={{
                  linkedin: linkedinUsername ? `https://linkedin.com/in/${linkedinUsername}` : '',
                  github: githubUsername ? `https://github.com/${githubUsername}` : '',
                  leetcode: leetcodeUsername ? `https://leetcode.com/u/${leetcodeUsername}` : '',
                  codeforces: codeforcesUsername ? `https://codeforces.com/profile/${codeforcesUsername}` : '',
                  codechef: codechefUsername ? `https://www.codechef.com/users/${codechefUsername}` : '',
                }}
                onSave={(extracted) => {
                  setLinkedinUsername(extracted.linkedinUsername);
                  setGithubUsername(extracted.githubUsername);
                  setLeetcodeUsername(extracted.leetcodeUsername);
                  setCodeforcesUsername(extracted.codeforcesUsername);
                  setCodechefUsername(extracted.codechefUsername);
                  setShowSocials(false);
                }}
                onClose={() => setShowSocials(false)}
              />
            )}
          </div>

          {/* Theme Selection */}
          <div className="pt-2 border-t border-surface-raised mt-4 relative z-10">
            <label className="text-sm font-label-md text-on-surface-variant block mb-3">Choose your vibe</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsDark(false)}
                className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${!isDark ? 'border-success-lime bg-success-lime/10' : 'border-surface-raised bg-surface-container'}`}
              >
                <Sun size={24} className={!isDark ? 'text-success-lime' : 'text-on-surface-variant'} />
                <span className={`font-label-md ${!isDark ? 'text-success-lime font-bold' : 'text-on-surface-variant'}`}>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDark(true)}
                className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${isDark ? 'border-success-lime bg-success-lime/10' : 'border-surface-raised bg-surface-container'}`}
              >
                <Moon size={24} className={isDark ? 'text-success-lime' : 'text-on-surface-variant'} />
                <span className={`font-label-md ${isDark ? 'text-success-lime font-bold' : 'text-on-surface-variant'}`}>Dark</span>
              </button>
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
