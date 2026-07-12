import { useEffect, useState, useRef } from 'react';
import { updateProfile } from 'firebase/auth';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { gamificationService } from '../services/gamificationService';
import {
  Edit2, UserPlus, MessageSquare, BookOpen, GraduationCap,
  Flame, Users, Star, Clock, BarChart2, Medal,
  X, Save, Loader2, ChevronRight,
  Code, MapPin, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';

const GithubIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.2-3.8s-1.2-.4-3.9 1.4a13.3 13.3 0 0 0-7 0C6.2 1.6 5 2 5 2a5.5 5.5 0 0 0-.2 3.8A5.5 5.5 0 0 0 3 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path><path d="M9 18c-4.5 1.5-5-2.5-7-3"></path></svg>
);

const LinkedinIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

// ─── Topics Modal ("Show All" popup) ──────────────────────────────────
const TopicsModal = ({ title, topics, color, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#1C1C2E] rounded-3xl shadow-2xl z-10 overflow-hidden" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <X size={16} />
          </button>
        </header>
        <div className="p-6 flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto">
          {topics.map(t => (
            <span key={t} className={`px-3 py-1.5 text-xs font-semibold rounded-full ${color}`}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

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

// ─── Edit Profile Modal ───────────────────────────────────────────────
const EditProfileModal = ({ user, skillGraph, onClose, onSave, uploadingPhoto, onPhotoUpload }) => {
  const [name, setName] = useState(user.name || '');
  const [gender, setGender] = useState(user.gender || '');
  const [department, setDepartment] = useState(user.department || '');
  const [college, setCollege] = useState(user.college || '');
  const [collegeLocation, setCollegeLocation] = useState(user.collegeLocation || '');
  const [year, setYear] = useState(user.year || '');
  const [teaches, setTeaches] = useState(user?.teaches || skillGraph?.teaches || []);
  const [learns, setLearns] = useState(user?.learns || skillGraph?.learns || []);
  const [linkedinUsername, setLinkedinUsername] = useState(user.linkedinUsername || '');
  const [githubUsername, setGithubUsername] = useState(user.githubUsername || '');
  const [leetcodeUsername, setLeetcodeUsername] = useState(user.leetcodeUsername || '');
  const [codeforcesUsername, setCodeforcesUsername] = useState(user.codeforcesUsername || '');
  const [codechefUsername, setCodechefUsername] = useState(user.codechefUsername || '');
  const [teachInput, setTeachInput] = useState('');
  const [learnInput, setLearnInput] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    let finalTeaches = [...teaches];
    let finalLearns = [...learns];
    if (teachInput.trim() && !finalTeaches.includes(teachInput.trim())) {
      finalTeaches.push(teachInput.trim());
    }
    if (learnInput.trim() && !finalLearns.includes(learnInput.trim())) {
      finalLearns.push(learnInput.trim());
    }
    try {
      await onSave({ 
        name, gender, department, college, collegeLocation, year, 
        teaches: finalTeaches, learns: finalLearns,
        linkedinUsername, githubUsername, leetcodeUsername, codeforcesUsername, codechefUsername
      });
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const addTeach = (e) => {
    if (e.key === 'Enter' && teachInput.trim()) {
      e.preventDefault();
      if (!teaches.includes(teachInput.trim())) setTeaches([...teaches, teachInput.trim()]);
      setTeachInput('');
    }
  };

  const addLearn = (e) => {
    if (e.key === 'Enter' && learnInput.trim()) {
      e.preventDefault();
      if (!learns.includes(learnInput.trim())) setLearns([...learns, learnInput.trim()]);
      setLearnInput('');
    }
  };

  return (
    <div className="fixed inset-x-0 top-[76px] bottom-0 z-[1000] flex flex-col justify-end sm:items-center sm:justify-center bg-black/80 backdrop-blur-sm p-0 pb-[92px] sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-[#1C1C2E] rounded-t-[32px] sm:rounded-3xl shadow-2xl z-10 flex flex-col max-h-[calc(100dvh-188px)] sm:max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="shrink-0 flex flex-col items-center pt-3 pb-4 px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 sm:hidden mb-4" />
          <div className="w-full flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 dark:text-white">Edit Profile</h2>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6">
          
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#DCFD8B] shadow-lg relative z-10">
                <img
                  className="w-full h-full object-cover"
                  src={user.photoUrl || (user.gender === 'Male' ? `https://avatar.iran.liara.run/public/boy?username=${encodeURIComponent(user.name)}` : user.gender === 'Female' ? `https://avatar.iran.liara.run/public/girl?username=${encodeURIComponent(user.name)}` : `https://avatar.iran.liara.run/public?username=${encodeURIComponent(user.name)}`)}
                  alt={user.name}
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 w-9 h-9 bg-[#7C3AED] rounded-full flex items-center justify-center border-[3px] border-white dark:border-[#1C1C2E] shadow-md hover:bg-[#6D28D9] transition-colors z-20 text-white"
              >
                {uploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoUpload} />
            </div>
            <span className="text-sm text-gray-500 font-medium">Change Avatar</span>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
          </div>
          {/* Gender */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Gender</label>
            <div className="flex gap-2">
              {['Male', 'Female', 'Other'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    gender === g
                      ? 'bg-[#DCFD8B] text-[#151f00] border-[#DCFD8B] shadow-[0_0_10px_rgba(220,253,139,0.3)]'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#DCFD8B]/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          {/* Department */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Department</label>
            <input value={department} onChange={e => setDepartment(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
          </div>
          {/* College */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">College</label>
            <input value={college} onChange={e => setCollege(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
          </div>
          {/* College Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">College Location</label>
            <input value={collegeLocation} onChange={e => setCollegeLocation(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
          </div>
          {/* Year */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Year</label>
            <input value={year} onChange={e => setYear(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
          </div>
          {/* Teaches */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Topics I Teach</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[44px]">
              {teaches.map(t => (
                <span key={t} className="inline-flex items-center gap-1 bg-[#7C3AED] text-white px-3 py-1 rounded-full text-xs font-semibold">
                  {t} <X size={12} className="cursor-pointer" onClick={() => setTeaches(teaches.filter(x => x !== t))} />
                </span>
              ))}
              <input value={teachInput} onChange={e => setTeachInput(e.target.value)} onKeyDown={addTeach} className="bg-transparent border-none outline-none text-gray-900 dark:text-white flex-1 min-w-[80px] py-1 text-sm" placeholder="+ Add topic" />
            </div>
          </div>
          {/* Learns */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Topics I Learn</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl min-h-[44px]">
              {learns.map(l => (
                <span key={l} className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-semibold border border-purple-200 dark:border-purple-700">
                  {l} <X size={12} className="cursor-pointer" onClick={() => setLearns(learns.filter(x => x !== l))} />
                </span>
              ))}
              <input value={learnInput} onChange={e => setLearnInput(e.target.value)} onKeyDown={addLearn} className="bg-transparent border-none outline-none text-gray-900 dark:text-white flex-1 min-w-[80px] py-1 text-sm" placeholder="+ Add topic" />
            </div>
          </div>
          {/* Social Handles */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Social Handles (Optional)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <LinkedinIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={linkedinUsername} onChange={e => setLinkedinUsername(e.target.value)} placeholder="LinkedIn Username" className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
              </div>
              <div className="relative">
                <GithubIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={githubUsername} onChange={e => setGithubUsername(e.target.value)} placeholder="GitHub Username" className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
              </div>
              <div className="relative">
                <Code className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={leetcodeUsername} onChange={e => setLeetcodeUsername(e.target.value)} placeholder="LeetCode Username" className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
              </div>
              <div className="relative">
                <Code className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={codeforcesUsername} onChange={e => setCodeforcesUsername(e.target.value)} placeholder="Codeforces Username" className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
              </div>
              <div className="relative">
                <Code className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={codechefUsername} onChange={e => setCodechefUsername(e.target.value)} placeholder="CodeChef Username" className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 p-6 pt-4 pb-7 sm:pb-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1C1C2E]">
          <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-[#DCFD8B] text-[#151f00] font-bold text-base flex items-center justify-center gap-2 shadow-[0_4px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_2px_0_#b3d266] transition-all disabled:opacity-60">
            {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Consistency Grid Cell ────────────────────────────────────────────
const GridCell = ({ level, title }) => {
  const bgColors = {
    '-1': 'bg-transparent',
    0: 'bg-slate-200 dark:bg-[#2A2A3A] border border-slate-300/70 dark:border-transparent',
    1: 'bg-purple-300 dark:bg-[#4C1D95] border border-purple-400/40 dark:border-transparent',
    2: 'bg-[#7C3AED]',
    3: 'bg-[#DCFD8B] shadow-[0_0_6px_rgba(220,253,139,0.3)]',
  };
  return (
    <div
      title={level === -1 ? '' : title}
      className={`w-3.5 h-3.5 rounded-sm transition-transform ${level >= 0 ? 'hover:scale-125 cursor-pointer' : ''} ${bgColors[level] || bgColors[0]}`}
    />
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, iconColor, value, label, onClick }) => (
  <button
    onClick={onClick}
    className="aspect-square bg-white dark:bg-[#1C1C2E] border border-gray-100 dark:border-transparent rounded-2xl p-2 flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer w-full shadow-sm dark:shadow-lg"
  >
    <Icon className={iconColor} size={18} />
    <span className="text-base sm:text-xl leading-none font-bold text-gray-900 dark:text-white tabular-nums">{value}</span>
    <span className="text-[8px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase text-center leading-tight">{label}</span>
  </button>
);

// ─── Badge Card ───────────────────────────────────────────────────────
const BadgeCard = ({ icon, name, description }) => (
  <div className="bg-gray-50 dark:bg-[#2A2A3A] border border-gray-100 dark:border-transparent rounded-3xl p-6 flex flex-col items-center text-center gap-3 w-full transition-transform hover:scale-[1.02]">
    <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] mb-1">
      {icon}
    </div>
    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{name}</h3>
    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-[200px]">{description}</p>
  </div>
);

// ─── Main Profile Component ───────────────────────────────────────────
const Profile = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { isDark } = useAppContext();
  const [profileData, setProfileData] = useState(null);
  const [streakData, setStreakData] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [topicsModal, setTopicsModal] = useState(null); // { title, topics, color }
  const [showLinksModal, setShowLinksModal] = useState(false);
  const photoInputRef = useRef(null);
  const graphScrollRef = useRef(null);
  const isOwner = currentUser?.uid === uid;

  const fetchAll = async () => {
    setLoading(true);
    try {
      const profileRes = await userService.getFullProfile(uid);
      setProfileData(profileRes.data);
      if (profileRes.data?.streak) setStreakData(profileRes.data.streak);

      if (currentUser && currentUser.uid !== uid) {
        try {
          const myProfile = await userService.getProfile(currentUser.uid);
          if (myProfile.data?.following?.includes(uid)) {
            setIsConnected(true);
          }
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Profile fetch error', err);
    }
    try {
      const [streakRes, badgeRes] = await Promise.all([
        gamificationService.getStreak(uid),
        gamificationService.getBadges(uid),
      ]);
      if (streakRes?.data) setStreakData(streakRes.data);
      if (badgeRes?.data) setBadgeData(badgeRes.data);
    } catch (err) {
      console.error('Gamification fetch error', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [uid]);

  // Auto-scroll consistency graph to the right (current month) when data loads
  useEffect(() => {
    if (!loading && graphScrollRef.current) {
      // Small delay to ensure the grid is rendered
      const timer = setTimeout(() => {
        if (graphScrollRef.current) {
          graphScrollRef.current.scrollLeft = graphScrollRef.current.scrollWidth;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Photo upload handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      setProfileData(prev => prev ? { ...prev, user: { ...prev.user, photoUrl: compressed } } : prev);
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: { photoUrl: compressed } }));
      await userService.updateProfile(uid, { photoUrl: compressed });
      if (currentUser) {
        try {
          await updateProfile(currentUser, { photoURL: compressed });
        } catch {
          console.warn('Firebase Auth photoURL limit exceeded, falling back to backend API only.');
        }
      }
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Edit profile save handler
  const handleEditSave = async (updates) => {
    setProfileData(prev => prev ? {
      ...prev,
      user: { ...prev.user, ...updates },
      skillGraph: {
        ...prev.skillGraph,
        teaches: updates.teaches || prev.skillGraph?.teaches || [],
        learns: updates.learns || prev.skillGraph?.learns || [],
      },
    } : prev);
    await userService.updateProfile(uid, updates);
    // Sync name to Firebase Auth displayName so all pages show the updated name
    if (updates.name && currentUser) {
      try {
        await updateProfile(currentUser, { displayName: updates.name });
      } catch { /* silent */ }
    }
    window.dispatchEvent(new CustomEvent('profile-updated', { detail: updates }));
  };

  const handleFollow = async () => {
    try {
      await userService.followUser(uid);
      setIsConnected(true);
      alert("Successfully followed user!");
    } catch (err) {
      console.error("Failed to follow", err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
    }
  };

  const handleChat = async () => {
    try {
      const { chatService } = await import('../services/chatService');
      const res = await chatService.getOrCreateThread(uid);
      if (res.success && res.matchId) {
        navigate(`/chat/${res.matchId}`);
      }
    } catch (err) {
      console.error("Failed to start chat", err);
      alert("Failed to start chat.");
    }
  };

  const buildGrid = () => {
    const activeDates = new Set(
      (streakData?.activeDates || []).map(d =>
        typeof d === 'string' ? d.split('T')[0] : new Date(d).toISOString().split('T')[0]
      )
    );
    const nowLocal = new Date();
    const utcMs = nowLocal.getTime() + (nowLocal.getTimezoneOffset() * 60000);
    const today = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    
    // End at today's column (Saturday = end of week), go back 52 weeks
    const endDate = new Date(today);
    // Advance to the upcoming Saturday so the current week is complete up to today
    while (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + 1);
    }
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (52 * 7) + 1);
    // Align start to Sunday
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }
    
    const columns = [];
    const monthLabels = [];
    let prevMonth = -1;
    let currDate = new Date(startDate);
    
    let col = 0;
    while (currDate <= endDate) {
      const week = [];
      for (let row = 0; row < 7; row++) {
        const y = currDate.getFullYear();
        const m = String(currDate.getMonth()+1).padStart(2,'0');
        const d = String(currDate.getDate()).padStart(2,'0');
        const ds = `${y}-${m}-${d}`;
        const isFuture = ds > todayStr;
        const isActive = !isFuture && activeDates.has(ds);
        week.push({
          date: ds,
          level: isFuture ? -1 : (isActive ? 1 : 0),
          label: currDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        
        // Track month labels on first day of each week
        if (row === 0 && currDate.getMonth() !== prevMonth) {
          monthLabels.push({ col, label: currDate.toLocaleDateString('en-US', { month: 'short' }) });
          prevMonth = currDate.getMonth();
        }
        currDate.setDate(currDate.getDate() + 1);
      }
      columns.push(week);
      col++;
    }
    
    return { columns, monthLabels };
  };

  useEffect(() => {
    if (graphScrollRef.current && profileData) {
      // Scroll to the end of the consistency graph (right side = today)
      graphScrollRef.current.scrollLeft = graphScrollRef.current.scrollWidth;
    }
  }, [profileData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 bg-gray-50 dark:bg-[#121212] min-h-screen">
        <div className="w-12 h-12 border-4 border-[#DCFD8B] border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-500 text-sm">Loading profile...</span>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-gray-50 dark:bg-[#121212] min-h-screen">
        <Users size={64} className="text-gray-400 dark:text-gray-700" />
        <p className="font-semibold text-gray-500 dark:text-gray-400">Profile not found</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => navigate('/')} className="px-6 py-2.5 rounded-full bg-[#DCFD8B] text-[#151f00] font-semibold text-sm">Go Home</button>
          {isOwner && (
            <button onClick={logout} className="px-6 py-2.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-semibold text-sm hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors">Log Out</button>
          )}
        </div>
      </div>
    );
  }

  const { user, skillGraph, stats } = profileData;
  const streak = streakData || profileData.streak || { currentStreak: 0, longestStreak: 0, activeDates: [] };
  const gridData = buildGrid();
  const teaches = user.teaches || skillGraph?.teaches || [];
  const learns = user.learns || skillGraph?.learns || [];
  
  const completedSessions = stats?.completedSessionsCount || 0;
  const avgRating = stats?.averageRating || 0;
  const studyHours = stats?.totalStudyHours || 0;

  const badgesList = badgeData?.badges || [];
  const earnedBadges = badgesList.filter(b => b.level > 0).map(b => ({
    id: b.id,
    icon: <div className="w-full h-full bg-white dark:bg-[#1C1C2E] border-2 border-purple-200 dark:border-[#DCFD8B]/30 rounded-full flex items-center justify-center text-2xl">{b.emoji}</div>,
    name: b.name,
    description: b.description,
  }));

  const hasSocialLinks = !!(user?.linkedinUsername || user?.githubUsername || user?.leetcodeUsername || user?.codeforcesUsername || user?.codechefUsername);

  return (
    <div className={`min-h-screen pb-[100px] sm:pb-8 flex flex-col font-body-md transition-colors ${isDark ? 'bg-black text-white' : 'bg-[#FAFAFA] text-gray-900'}`}>
      <main className="profile-stage flex-1 w-full max-w-[600px] mx-auto px-4 py-8 sm:px-6 sm:py-10 relative z-10 flex flex-col gap-5">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      {/* ── Profile Links Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showLinksModal && (
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 pb-[92px] sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-surface-container w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl relative border-t border-gray-100 dark:border-surface-raised max-h-[calc(100dvh-112px)] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-surface-raised rounded-full mx-auto mb-6 sm:hidden" />
              <button onClick={() => setShowLinksModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-on-surface">
                <X size={20} />
              </button>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center">Social Profiles</h3>
              
              <div className="flex flex-col gap-3">
                {user.linkedinUsername && (
                  <a href={`https://linkedin.com/in/${user.linkedinUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-[#1C1C2E] hover:bg-gray-100 dark:hover:bg-[#2A2A3A] transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-[#0077B5]/10 text-[#0077B5] flex items-center justify-center group-hover:scale-110 transition-transform"><LinkedinIcon size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-900 dark:text-white">LinkedIn</span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">{user.linkedinUsername}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </a>
                )}
                {user.githubUsername && (
                  <a href={`https://github.com/${user.githubUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-[#1C1C2E] hover:bg-gray-100 dark:hover:bg-[#2A2A3A] transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-center group-hover:scale-110 transition-transform"><GithubIcon size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-900 dark:text-white">GitHub</span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">{user.githubUsername}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </a>
                )}
                {user.leetcodeUsername && (
                  <a href={`https://leetcode.com/${user.leetcodeUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-[#1C1C2E] hover:bg-gray-100 dark:hover:bg-[#2A2A3A] transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Code size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-900 dark:text-white">LeetCode</span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">{user.leetcodeUsername}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </a>
                )}
                {user.codeforcesUsername && (
                  <a href={`https://codeforces.com/profile/${user.codeforcesUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-[#1C1C2E] hover:bg-gray-100 dark:hover:bg-[#2A2A3A] transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Code size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-900 dark:text-white">Codeforces</span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">{user.codeforcesUsername}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </a>
                )}
                {user.codechefUsername && (
                  <a href={`https://www.codechef.com/users/${user.codechefUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-[#1C1C2E] hover:bg-gray-100 dark:hover:bg-[#2A2A3A] transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Code size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-900 dark:text-white">CodeChef</span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">{user.codechefUsername}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Profile Header Card (Insta-style) ────────────────────── */}
      <section className="bg-white dark:bg-[#1C1C2E] border border-gray-100 dark:border-transparent rounded-[32px] p-6 relative shadow-sm dark:shadow-lg transition-colors">
        {/* Top row: Avatar + Info */}
        <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-[#DCFD8B] shadow-[0_0_20px_rgba(220,253,139,0.3)] relative z-10">
              <img
                className="w-full h-full object-cover"
                src={user.photoUrl || (user.gender === 'Male' ? `https://avatar.iran.liara.run/public/boy?username=${encodeURIComponent(user.name)}` : user.gender === 'Female' ? `https://avatar.iran.liara.run/public/girl?username=${encodeURIComponent(user.name)}` : `https://avatar.iran.liara.run/public?username=${encodeURIComponent(user.name)}`)}
                alt={user.name}
              />
            </div>
            {isOwner && (
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#7C3AED] rounded-full flex items-center justify-center border-2 border-white dark:border-[#1C1C2E] shadow-md hover:bg-[#6D28D9] transition-colors"
              >
                {uploadingPhoto ? <Loader2 size={12} className="text-white animate-spin" /> : <Edit2 size={12} className="text-white" />}
              </button>
            )}
          </div>

          {/* User Info (Right of avatar) */}
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{user.name}</h1>
              {isOwner && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  title="Edit Profile"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[#7C3AED] font-semibold text-sm leading-snug min-w-0">
              <GraduationCap size={14} className="shrink-0" />
              <span className="truncate">{user.college || 'College not added'}</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs font-medium leading-snug min-w-0">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{user.collegeLocation || 'Location not added'}</span>
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1 leading-snug truncate">
              {[user.department, user.year ? `Year ${user.year}` : ''].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          {isOwner ? (
            <>
              {hasSocialLinks && (
                <button
                  onClick={() => setShowLinksModal(true)}
                  className="w-full py-2 rounded-xl bg-gray-100 dark:bg-[#2A2A3A] text-gray-900 dark:text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-gray-200 dark:hover:bg-[#333345] transition-colors"
                >
                  <Link2 size={14} /> Profile Links
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleFollow}
                disabled={isConnected}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                  isConnected
                    ? 'bg-gray-100 dark:bg-[#2A2A3A] text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-[#DCFD8B] text-[#151f00] hover:scale-[1.02] active:scale-95'
                }`}
              >
                {isConnected ? 'Following' : <><UserPlus size={14} /> Follow</>}
              </button>
              <button
                onClick={handleChat}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2A2A3A] text-gray-900 dark:text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-gray-200 dark:hover:bg-[#333345] transition-colors"
              >
                <MessageSquare size={14} /> Message
              </button>
              {hasSocialLinks && (
                <button
                  onClick={() => setShowLinksModal(true)}
                  className="py-2.5 px-3 rounded-xl bg-gray-100 dark:bg-[#2A2A3A] text-gray-900 dark:text-white font-bold text-sm hover:bg-gray-200 dark:hover:bg-[#333345] transition-colors"
                  title="Profile Links"
                >
                  <Link2 size={16} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Topics */}
        <div className="flex flex-col gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><GraduationCap size={12}/> I Teach</h3>
            <div className="flex flex-wrap gap-1.5">
              {teaches.length > 0 ? (
                <>
                  {teaches.slice(0, 4).map(t => (
                    <span key={t} className="px-2.5 py-1 bg-[#7C3AED] text-white text-[11px] font-semibold rounded-full">{t}</span>
                  ))}
                  {teaches.length > 4 && (
                    <button
                      onClick={() => setTopicsModal({ title: 'Topics I Teach', topics: teaches, color: 'bg-[#7C3AED] text-white' })}
                      className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-semibold rounded-full flex items-center gap-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      +{teaches.length - 4} <ChevronRight size={10} />
                    </button>
                  )}
                </>
              ) : <span className="text-xs text-gray-400">None added yet</span>}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><BookOpen size={12}/> I Learn</h3>
            <div className="flex flex-wrap gap-1.5">
              {learns.length > 0 ? (
                <>
                  {learns.slice(0, 4).map(t => (
                    <span key={t} className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 text-[11px] font-semibold rounded-full">{t}</span>
                  ))}
                  {learns.length > 4 && (
                    <button
                      onClick={() => setTopicsModal({ title: 'Topics I Learn', topics: learns, color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700' })}
                      className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-semibold rounded-full flex items-center gap-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      +{learns.length - 4} <ChevronRight size={10} />
                    </button>
                  )}
                </>
              ) : <span className="text-xs text-gray-400">None added yet</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ── Profile Stats ─────────────────────────────────────────── */}
      <section className="grid grid-cols-4 gap-2">
        <StatCard
          icon={Star}
          iconColor="text-amber-500 fill-amber-500"
          value={avgRating.toFixed(1)}
          label="Rating"
          onClick={() => navigate('/ratings')}
        />
        <StatCard
          icon={Users}
          iconColor="text-[#7C3AED]"
          value={completedSessions}
          label="Sessions"
          onClick={() => navigate('/sessions')}
        />
        <StatCard
          icon={Flame}
          iconColor="text-orange-500"
          value={streak?.currentStreak || 0}
          label="Streak"
          onClick={() => navigate('/streak')}
        />
        <StatCard
          icon={Clock}
          iconColor="text-emerald-600 dark:text-[#DCFD8B]"
          value={studyHours > 0 ? `${studyHours}h` : '0h'}
          label="Study Hours"
          onClick={() => navigate('/sessions?tab=completed')}
        />
      </section>

      {/* ── Consistency Graph ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#1C1C2E] border border-slate-200 dark:border-transparent rounded-[32px] p-6 shadow-sm dark:shadow-lg transition-colors overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <BarChart2 size={24} className="text-[#DCFD8B]" />
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Consistency Graph</h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Past year</span>
        </div>

        <div className="w-full overflow-x-auto pb-4" ref={graphScrollRef}>
          <div className="flex flex-col min-w-max">
            {/* Grid */}
            <div className="flex gap-[3px]">
              {gridData.columns.map((week, cIdx) => (
                <div key={cIdx} className="flex flex-col gap-[3px]">
                  {week.map((cell, rIdx) => (
                    <GridCell key={`${cIdx}-${rIdx}`} level={cell.level} title={`${cell.label}`} />
                  ))}
                </div>
              ))}
            </div>
            {/* Month Labels */}
            <div className="relative h-6 mt-2 w-full">
              {gridData.monthLabels.map((ml, i) => (
                <span 
                  key={i} 
                  className="absolute text-[10px] text-slate-600 dark:text-gray-400 font-semibold whitespace-nowrap"
                  style={{ left: `${ml.col * (14 + 3)}px` }}
                >
                  {ml.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 mt-4">
          <span className="text-xs text-slate-600 dark:text-gray-400 font-semibold">Less</span>
          <div className="flex gap-[3px]">
            <div className="w-3.5 h-3.5 rounded-sm bg-slate-200 border border-slate-300/70 dark:bg-[#2A2A3A] dark:border-transparent" />
            <div className="w-3.5 h-3.5 rounded-sm bg-purple-300 border border-purple-400/40 dark:bg-[#4C1D95] dark:border-transparent" />
            <div className="w-3.5 h-3.5 rounded-sm bg-[#7C3AED]" />
            <div className="w-3.5 h-3.5 rounded-sm bg-[#DCFD8B]" />
          </div>
          <span className="text-xs text-slate-600 dark:text-gray-400 font-semibold">More</span>
        </div>
      </section>

      {/* ── Badge Showcase ─────────────────────────────────────────── */}
      {earnedBadges.length > 0 && (
        <section className="bg-white dark:bg-[#1C1C2E] border border-gray-100 dark:border-transparent rounded-[32px] p-6 shadow-sm dark:shadow-lg flex flex-col gap-4 transition-colors">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Medal size={24} className="text-[#7C3AED]" />
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">Badge Showcase</h2>
            </div>
            <Link to="/badges" className="text-xs font-bold text-green-700 dark:text-[#DCFD8B] tracking-widest uppercase hover:underline">
              VIEW ALL
            </Link>
          </div>
  
          <div className="flex flex-col gap-4">
            {earnedBadges.map(badge => (
              <BadgeCard key={badge.id} {...badge} />
            ))}
          </div>
        </section>
      )}

      {/* Log Out Button */}
      {isOwner && (
        <div className="flex justify-center mt-4">
          <button onClick={logout} className="px-8 py-3 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-bold text-sm hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors w-full sm:w-auto">
            Log Out
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditProfileModal 
          user={user} 
          skillGraph={skillGraph} 
          onClose={() => setShowEditModal(false)} 
          onSave={handleEditSave}
          uploadingPhoto={uploadingPhoto}
          onPhotoUpload={handlePhotoUpload}
        />
      )}

      {/* Topics Modal */}
      {topicsModal && (
        <TopicsModal
          title={topicsModal.title}
          topics={topicsModal.topics}
          color={topicsModal.color}
          onClose={() => setTopicsModal(null)}
        />
      )}
      </main>
    </div>
  );
};

export default Profile;
