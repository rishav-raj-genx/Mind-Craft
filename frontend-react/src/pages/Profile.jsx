import { useEffect, useState, useRef } from 'react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { gamificationService } from '../services/gamificationService';
import { matchService } from '../services/matchService';
import {
  Edit2, UserPlus, MessageSquare, BookOpen, GraduationCap,
  Flame, Users, Star, Clock, BarChart2, Medal, Moon,
  X, Save, Loader2, Image as ImageIcon, ChevronRight
} from 'lucide-react';

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto">
          {topics.map(t => (
            <span key={t} className={`px-3 py-1.5 text-xs font-semibold rounded-full ${color}`}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const useEffect_import = useEffect; // ensure useEffect is in scope for TopicsModal

// ─── Image Compression via Canvas ──────────────────────────────────────
const compressImage = (file, maxWidth = 400, quality = 0.7) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// ─── Edit Profile Modal ───────────────────────────────────────────────
const EditProfileModal = ({ user, skillGraph, onClose, onSave }) => {
  const [name, setName] = useState(user.name || '');
  const [department, setDepartment] = useState(user.department || '');
  const [college, setCollege] = useState(user.college || '');
  const [year, setYear] = useState(user.year || '');
  const [teaches, setTeaches] = useState(user?.teaches || skillGraph?.teaches || []);
  const [learns, setLearns] = useState(user?.learns || skillGraph?.learns || []);
  const [teachInput, setTeachInput] = useState('');
  const [learnInput, setLearnInput] = useState('');
  const [saving, setSaving] = useState(false);

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
      await onSave({ name, department, college, year, teaches: finalTeaches, learns: finalLearns });
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-[#1C1C2E] rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-xl text-gray-900 dark:text-white">Edit Profile</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#7C3AED]" />
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
          {/* Save */}
          <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-[#DCFD8B] text-[#151f00] font-bold text-base flex items-center justify-center gap-2 shadow-[0_4px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_2px_0_#b3d266] transition-all disabled:opacity-60 mt-2">
            {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Consistency Grid Cell ────────────────────────────────────────────
const GridCell = ({ level, title }) => {
  // level: -1 = future (invisible), 0 = empty, 1 = low, 2 = med, 3 = high
  const bgColors = {
    '-1': 'bg-transparent',
    0: 'bg-gray-200 dark:bg-[#2A2A3A]',
    1: 'bg-purple-200 dark:bg-[#4C1D95]',
    2: 'bg-[#7C3AED]',
    3: 'bg-[#DCFD8B] shadow-[0_0_6px_rgba(220,253,139,0.3)]'
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
    className="bg-white dark:bg-[#1C1C2E] border border-gray-100 dark:border-transparent rounded-3xl p-6 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer w-full"
  >
    <Icon className={iconColor} size={30} />
    <span className="text-[32px] leading-none font-bold text-gray-900 dark:text-white tabular-nums">{value}</span>
    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase">{label}</span>
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
  const [profileData, setProfileData] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [streakData, setStreakData] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [topicsModal, setTopicsModal] = useState(null); // { title, topics, color }
  const photoInputRef = useRef(null);
  const graphScrollRef = useRef(null);
  const isOwner = currentUser?.uid === uid;

  const fetchAll = async () => {
    setLoading(true);
    try {
      const profileRes = await userService.getFullProfile(uid);
      setProfileData(profileRes.data);
      if (profileRes.data?.streak) setStreakData(profileRes.data.streak);
      if (profileRes.data?.tokenBalance !== undefined) setTokenBalance(profileRes.data.tokenBalance);

      if (currentUser && currentUser.uid !== uid) {
        try {
          const myProfile = await userService.getProfile(currentUser.uid);
          if (myProfile.data?.following?.includes(uid)) {
            setIsConnected(true);
          }
        } catch (_) { /* ignore */ }
      }
    } catch (err) {
      console.error('Profile fetch error', err);
    }
    try {
      const [tokensRes, streakRes, badgeRes] = await Promise.all([
        gamificationService.getTokens(uid),
        gamificationService.getStreak(uid),
        gamificationService.getBadges(uid),
      ]);
      if (tokensRes?.data?.balance !== undefined) setTokenBalance(tokensRes.data.balance);
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
      const compressed = await compressImage(file, 300, 0.7);
      await userService.updateProfile(uid, { photoUrl: compressed });
      if (currentUser) {
        await updateProfile(currentUser, { photoURL: compressed });
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: { photoUrl: compressed } }));
      }
      await fetchAll();
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Edit profile save handler
  const handleEditSave = async (updates) => {
    await userService.updateProfile(uid, updates);
    // Sync name to Firebase Auth displayName so all pages show the updated name
    if (updates.name && currentUser) {
      try {
        await updateProfile(currentUser, { displayName: updates.name });
      } catch (_) { /* silent */ }
    }
    window.dispatchEvent(new CustomEvent('profile-updated', { detail: { name: updates.name } }));
    await fetchAll();
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

  const { user, skillGraph } = profileData;
  const streak = streakData || profileData.streak || { currentStreak: 0, longestStreak: 0, activeDates: [] };
  const gridData = buildGrid();
  const teaches = user.teaches || skillGraph?.teaches || [];
  const learns = user.learns || skillGraph?.learns || [];
  const matedHours = Math.round((user.totalSessions || 0) * 1.2);

  const badgesList = badgeData?.badges || [];
  const earnedBadges = badgesList.filter(b => b.level > 0).map(b => ({
    id: b.id,
    icon: <div className="w-full h-full bg-white dark:bg-[#1C1C2E] border-2 border-purple-200 dark:border-[#DCFD8B]/30 rounded-full flex items-center justify-center text-2xl">{b.emoji}</div>,
    name: b.name,
    description: b.description,
  }));

  return (
    <div className="flex flex-col gap-5 pb-32 bg-gray-50 dark:bg-[#121212] min-h-screen px-4 pt-4 sm:px-0 transition-colors">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      {/* ── Profile Header Card ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#1C1C2E] border border-gray-100 dark:border-transparent rounded-[32px] p-8 flex flex-col items-center text-center relative shadow-sm dark:shadow-lg transition-colors">
        {/* Avatar */}
        <div className="relative mb-5">
          <div className="w-28 h-28 rounded-full overflow-hidden border-[3px] border-[#DCFD8B] shadow-[0_0_20px_rgba(220,253,139,0.3)]">
            <img
              className="w-full h-full object-cover"
              src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7C3AED&color=fff&size=200`}
              alt={user.name}
            />
          </div>
          {isOwner && (
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#7C3AED] rounded-full flex items-center justify-center border-2 border-white dark:border-[#1C1C2E] shadow-md hover:bg-[#6D28D9] transition-colors"
            >
              {uploadingPhoto ? <Loader2 size={14} className="text-white animate-spin" /> : <Edit2 size={14} className="text-white" />}
            </button>
          )}
        </div>

        {/* Name + info */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{user.name}</h1>
        <p className="text-[#7C3AED] font-semibold text-base mb-2">
          {user.department} Major
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-6">
          🎓 {user.year} • {user.college}
        </p>

        {/* Connect + Message buttons */}
        {!isOwner && (
          <div className="flex gap-3 mb-8 w-full max-w-[280px]">
            <button
              onClick={handleFollow}
              disabled={isConnected}
              className={`flex-1 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                isConnected
                  ? 'bg-gray-100 dark:bg-[#2A2A3A] text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-[#DCFD8B] text-[#151f00] hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(220,253,139,0.2)]'
              }`}
            >
              {isConnected ? 'Following' : <><UserPlus size={18} /> Follow</>}
            </button>
            <button
              onClick={handleChat}
              className="flex-1 py-3 rounded-full bg-gray-100 dark:bg-[#2A2A3A] text-gray-900 dark:text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-[#333345] hover:scale-105 active:scale-95 transition-all"
            >
              Message
            </button>
          </div>
        )}

        {/* Topics */}
        <div className="flex flex-col gap-4 w-full max-w-[280px] text-left mt-2">
          <div>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><GraduationCap size={14}/> I Teach</h3>
            <div className="flex flex-wrap gap-1.5">
              {teaches.length > 0 ? (
                <>
                  {teaches.slice(0, 3).map(t => (
                    <span key={t} className="px-3 py-1 bg-[#7C3AED] text-white text-xs font-semibold rounded-full shadow-sm">{t}</span>
                  ))}
                  {teaches.length > 3 && (
                    <button
                      onClick={() => setTopicsModal({ title: 'Topics I Teach', topics: teaches, color: 'bg-[#7C3AED] text-white' })}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-full flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      +{teaches.length - 3} more <ChevronRight size={12} />
                    </button>
                  )}
                </>
              ) : <span className="text-xs text-gray-400">None added yet</span>}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><BookOpen size={14}/> I Learn</h3>
            <div className="flex flex-wrap gap-1.5">
              {learns.length > 0 ? (
                <>
                  {learns.slice(0, 3).map(t => (
                    <span key={t} className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 text-xs font-semibold rounded-full">{t}</span>
                  ))}
                  {learns.length > 3 && (
                    <button
                      onClick={() => setTopicsModal({ title: 'Topics I Learn', topics: learns, color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700' })}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-full flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      +{learns.length - 3} more <ChevronRight size={12} />
                    </button>
                  )}
                </>
              ) : <span className="text-xs text-gray-400">None added yet</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Grid 2×2 ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Flame}
          iconColor="text-[#DCFD8B]"
          value={streak.currentStreak || 0}
          label="Day Streak"
          onClick={() => navigate('/streak')}
        />
        <StatCard
          icon={Users}
          iconColor="text-[#7C3AED]"
          value={user.totalSessions || 0}
          label="Sessions"
          onClick={() => navigate('/sessions')}
        />
        <StatCard
          icon={Star}
          iconColor="text-amber-400"
          value={(user.averageRating || 0).toFixed(1)}
          label="Rating"
          onClick={() => navigate('/ratings')}
        />
        <StatCard
          icon={Clock}
          iconColor="text-[#7C3AED]"
          value={matedHours > 0 ? `${matedHours}h` : '0h'}
          label="Study Hrs"
          onClick={() => navigate('/mates')}
        />
      </div>

      {/* ── Consistency Graph ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#1C1C2E] border border-gray-100 dark:border-transparent rounded-[32px] p-6 shadow-sm dark:shadow-lg transition-colors overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <BarChart2 size={24} className="text-[#DCFD8B]" />
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Consistency Graph</h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Past year</span>
        </div>

        <div className="w-full overflow-x-auto pb-4 hide-scrollbar" ref={graphScrollRef}>
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
                  className="absolute text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap"
                  style={{ left: `${ml.col * (14 + 3)}px` }}
                >
                  {ml.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 mt-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Less</span>
          <div className="flex gap-[3px]">
            <div className="w-3.5 h-3.5 rounded-sm bg-gray-200 dark:bg-[#2A2A3A]" />
            <div className="w-3.5 h-3.5 rounded-sm bg-purple-200 dark:bg-[#4C1D95]" />
            <div className="w-3.5 h-3.5 rounded-sm bg-[#7C3AED]" />
            <div className="w-3.5 h-3.5 rounded-sm bg-[#DCFD8B]" />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">More</span>
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

      {/* Edit Profile Button / Logout */}
      {isOwner && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="w-full py-4 rounded-[32px] bg-[#7C3AED] text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-[#6D28D9] transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]"
          >
            <Edit2 size={18} /> Edit Full Profile
          </button>
          <button
            onClick={logout}
            className="w-full py-4 rounded-[32px] bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-bold text-base flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/40 transition-all"
          >
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
    </div>
  );
};

export default Profile;
