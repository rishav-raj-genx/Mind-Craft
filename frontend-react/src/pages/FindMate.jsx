import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchService } from '../services/matchService';
import { voiceService } from '../services/voiceService';
import { Search, Mic, MapPin, Star, Filter, Square, X, Globe, Loader2, MessageSquare, GitBranch, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ForceGraph2D from 'react-force-graph-2d';
const LANGUAGE_OPTIONS = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'pa-IN', label: 'Punjabi' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Highest Rating' },
  { value: 'name', label: 'Name (A–Z)' },
];

const normalizeMate = (record) => {
  const user = record?.tutor || record?.user || record || {};
  return {
    ...user,
    uid: user.uid || record.uid,
    sharedSkills: record.sharedSkills || user.sharedSkills || [],
    teaches: user.teaches || record.teaches || record.sharedSkills || [],
    learns: user.learns || record.learns || [],
    activityScore: record.activityScore || user.activityScore || 0,
    sameCollege: record.sameCollege ?? user.sameCollege,
  };
};

// ─── Neo4j Visual Match Graph (Force Directed Modal) ──────────────────────────
const MatchGraph = ({ mate, currentUserName = 'You', onClose }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
  }, []);

  const sharedSkills = mate.sharedSkills?.length
    ? mate.sharedSkills.slice(0, 3)
    : mate.teaches?.slice(0, 3) || ['Peer'];

  const nodes = [
    { id: 'user', name: currentUserName, color: '#DCFD8B', val: 20 },
    { id: 'peer', name: (mate.name || 'PEER').split(' ')[0], color: '#A78BFA', val: 20 },
  ];

  const links = [];

  sharedSkills.forEach((skill, i) => {
    const skillId = `skill-${i}`;
    nodes.push({ id: skillId, name: skill, color: '#E5E7EB', val: 12 });
    links.push({ source: 'user', target: skillId, color: '#DCFD8B' });
    links.push({ source: skillId, target: 'peer', color: '#A78BFA' });
  });

  const graphData = { nodes, links };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-surface-container rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-surface-raised relative"
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-on-surface z-10 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <GitBranch size={18} className="text-green-600 dark:text-success-lime" />
          <h3 className="font-headline-md text-gray-900 dark:text-on-surface">Neo4j Match Traversal</h3>
        </div>

        <div 
          ref={containerRef} 
          className="w-full h-[400px] bg-gray-50 dark:bg-black/30 rounded-2xl overflow-hidden border border-gray-100 dark:border-surface-raised"
        >
          {dimensions.width > 0 && (
            <ForceGraph2D
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeLabel="name"
              nodeColor="color"
              nodeRelSize={6}
              linkColor="color"
              linkWidth={2}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.01}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12/globalScale;
                ctx.font = `bold ${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                ctx.fillStyle = node.color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val / 2, 0, 2 * Math.PI, false);
                ctx.fill();

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = node.id === 'skill' ? '#666' : '#000';
                ctx.fillText(label, node.x, node.y + (node.val/2) + 4);
              }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Match Card ───────────────────────────────────────────────────────────────
const MatchCard = ({ mate, index, onFollow, onChat, isFollowed }) => {
  const navigate = useNavigate();
  const [showGraph, setShowGraph] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: 'easeOut' }}
      className="bg-white dark:bg-surface-container rounded-xl p-5 flex flex-col gap-3 border border-gray-200 dark:border-surface-raised shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Top row: avatar + info + rating */}
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${mate.uid}`)}>
        <img
          src={mate.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(mate.name || 'Mate')}&background=DCFD8B&color=151f00`}
          alt={mate.name || 'Mate'}
          className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-surface-raised object-cover flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h4 className="font-headline-md text-[20px] text-gray-900 dark:text-primary truncate">{mate.name || 'Unnamed Mate'}</h4>
          <div className="flex items-center gap-1 text-gray-500 dark:text-on-surface-variant font-label-md mt-1">
            <MapPin size={14} /> {mate.college || mate.department || 'Details unavailable'}
          </div>
          {(mate.department || mate.year) && (
            <p className="text-xs text-gray-500 dark:text-on-surface-variant mt-1">
              {[mate.department, mate.year].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 bg-orange-50 text-orange-600 dark:bg-surface-raised dark:text-warm-peach px-2 py-1 rounded-full font-label-md flex-shrink-0">
          <Star size={14} className="fill-current" />
          {mate.averageRating > 0 ? Number(mate.averageRating).toFixed(1) : 'New'}
        </div>
      </div>

      {/* Skills row */}
      <div className="flex flex-wrap gap-2">
        {(mate.sharedSkills?.length ? mate.sharedSkills : mate.teaches)?.slice(0, 3).map((skill, idx) => (
          <span key={idx} className="bg-gray-100 text-gray-700 dark:bg-surface-raised dark:text-on-surface text-xs px-2 py-1 rounded border border-gray-200 dark:border-outline-variant">
            {skill}
          </span>
        ))}
        {mate.teaches?.length > 3 && (
          <span className="bg-gray-100 dark:bg-surface-raised text-xs px-2 py-1 rounded text-gray-500">
            +{mate.teaches.length - 3}
          </span>
        )}
      </div>

      {/* Why matched toggle */}
      <button
        onClick={() => setShowGraph(v => !v)}
        className="flex items-center gap-1.5 text-xs font-label-md text-green-700 dark:text-success-lime hover:underline self-start transition-colors"
      >
        <GitBranch size={12} />
        Why matched?
        {showGraph ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Neo4j graph panel */}
      <AnimatePresence>
        {showGraph && <MatchGraph mate={mate} onClose={() => setShowGraph(false)} />}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex gap-2 w-full items-center">
        <button
          onClick={() => onFollow(mate.uid)}
          disabled={isFollowed}
          className={`flex-1 font-label-lg rounded-full py-2 px-6 active:scale-95 transition-transform ${
            isFollowed
              ? 'bg-gray-100 dark:bg-[#2A2A3A] text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none'
              : 'bg-success-lime text-green-900 shadow-[0_3px_0_#b3d266]'
          }`}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </button>
        <button
          onClick={() => onChat(mate)}
          className="flex-1 bg-purple-100 dark:bg-secondary-container/20 text-purple-700 dark:text-secondary border border-purple-200 dark:border-secondary-container/50 font-label-lg rounded-full py-2 px-6 active:scale-95 transition-transform hover:bg-purple-200 flex items-center justify-center gap-2"
        >
          <MessageSquare size={16} /> Chat
        </button>
      </div>
    </motion.div>
  );
};

// ─── Filter Panel ─────────────────────────────────────────────────────────────
const FilterPanel = ({ filters, onChange, onClear, onApply, allDepartments, allColleges }) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="bg-white dark:bg-surface-container border border-gray-200 dark:border-surface-raised rounded-2xl p-5 flex flex-col gap-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-label-lg text-gray-900 dark:text-on-surface flex items-center gap-2">
            <SlidersHorizontal size={16} /> Filters
          </h3>
          <button
            onClick={onClear}
            className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* College */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">College</label>
          <select
            value={filters.college}
            onChange={e => onChange({ ...filters, college: e.target.value })}
            className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-[#7C3AED] transition-colors"
          >
            <option value="">All Colleges</option>
            {allColleges.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Department</label>
          <select
            value={filters.department}
            onChange={e => onChange({ ...filters, department: e.target.value })}
            className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-[#7C3AED] transition-colors"
          >
            <option value="">All Departments</option>
            {allDepartments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Year</label>
          <div className="flex gap-2">
            {['', '1', '2', '3', '4'].map(y => (
              <button
                key={y}
                type="button"
                onClick={() => onChange({ ...filters, year: y })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                  filters.year === y
                    ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-[0_0_10px_rgba(124,58,237,0.3)]'
                    : 'bg-gray-50 dark:bg-surface-raised text-gray-600 dark:text-gray-400 border-gray-200 dark:border-outline-variant hover:border-[#7C3AED]'
                }`}
              >
                {y || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Min Rating */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Min Rating {filters.minRating > 0 ? `(${filters.minRating}+)` : ''}
          </label>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ ...filters, minRating: r })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1 ${
                  filters.minRating === r
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                    : 'bg-gray-50 dark:bg-surface-raised text-gray-500 dark:text-gray-400 border-gray-200 dark:border-outline-variant hover:border-amber-300'
                }`}
              >
                {r === 0 ? 'Any' : <><Star size={12} className={filters.minRating === r ? 'fill-current' : ''} /> {r}</>}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Sort By</label>
          <div className="flex gap-2">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...filters, sortBy: opt.value })}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                  filters.sortBy === opt.value
                    ? 'bg-[#DCFD8B]/20 text-green-700 dark:text-success-lime border-[#DCFD8B]/50'
                    : 'bg-gray-50 dark:bg-surface-raised text-gray-500 dark:text-gray-400 border-gray-200 dark:border-outline-variant hover:border-[#DCFD8B]/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Apply */}
        <button
          onClick={onApply}
          className="w-full py-2.5 rounded-xl bg-[#7C3AED] text-white font-bold text-sm hover:bg-[#6D28D9] transition-colors active:scale-[0.98]"
        >
          Apply Filters
        </button>
      </div>
    </motion.div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const FindMate = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allMatches, setAllMatches] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [myFollowingUids, setMyFollowingUids] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    college: '',
    department: '',
    year: '',
    minRating: 0,
    sortBy: 'relevance',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    college: '',
    department: '',
    year: '',
    minRating: 0,
    sortBy: 'relevance',
  });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [globalColleges, setGlobalColleges] = useState([]);
  const [globalDepartments, setGlobalDepartments] = useState([]);

  const hasActiveFilters = appliedFilters.college || appliedFilters.department || appliedFilters.year || appliedFilters.minRating > 0 || appliedFilters.sortBy !== 'relevance';

  useEffect(() => {
    if (currentUser) {
      loadInitialMatches();
      loadMyFollowing();
      loadMetadataOptions();
    }
  }, [currentUser]);

  const loadMetadataOptions = async () => {
    try {
      const { userService } = await import('../services/userService');
      const res = await userService.getMetadataOptions();
      if (res.data) {
        setGlobalColleges(res.data.colleges || []);
        setGlobalDepartments(res.data.departments || []);
      }
    } catch (err) {
      console.error('Failed to load metadata options', err);
    }
  };

  // Whenever allMatches or appliedFilters change, re-compute displayed matches
  useEffect(() => {
    let filtered = [...allMatches];

    if (appliedFilters.college) {
      filtered = filtered.filter(m => m.college && m.college.toLowerCase() === appliedFilters.college.toLowerCase());
    }
    if (appliedFilters.department) {
      filtered = filtered.filter(m => m.department && m.department.toLowerCase() === appliedFilters.department.toLowerCase());
    }
    if (appliedFilters.year) {
      filtered = filtered.filter(m => String(m.year) === appliedFilters.year);
    }
    if (appliedFilters.minRating > 0) {
      filtered = filtered.filter(m => (m.averageRating || 0) >= appliedFilters.minRating);
    }

    // Sort
    if (appliedFilters.sortBy === 'rating') {
      filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (appliedFilters.sortBy === 'name') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    setMatches(filtered);
  }, [allMatches, appliedFilters]);

  const loadMyFollowing = async () => {
    try {
      const { userService } = await import('../services/userService');
      const res = await userService.getFollowing(currentUser.uid);
      const following = (res.data || []).map(u => u.uid);
      setMyFollowingUids(new Set(following));
    } catch (err) {
      console.error(err);
    }
  };

  const loadInitialMatches = async () => {
    try {
      setLoading(true);
      const data = await matchService.getMatches(currentUser.uid);
      const normalized = (data.data || data.matches || []).map(normalizeMate);
      setAllMatches(normalized);
      setActiveSearch('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleVoiceSearch(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Microphone access is required for voice search.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleVoiceSearch = async (audioBlob) => {
    try {
      setLoading(true);
      const response = await voiceService.search(audioBlob, selectedLang);
      const resultData = response.data || response;

      setVoiceResult({
        text: resultData.transcript || '',
        skill: resultData.detectedSkill || '',
        confidence: resultData.confidence || 0,
        language: resultData.language || '',
      });

      const transcript = resultData.transcript || '';
      setSearchText(transcript);

      if (transcript || resultData.detectedSkill) {
        const normalized = (resultData.matches || []).map(normalizeMate);
        setAllMatches(normalized);
        setActiveSearch(resultData.detectedSkill || transcript);
        if (transcript) handleTextSearch(null, transcript);
      } else {
        setAllMatches([]);
        setActiveSearch('');
      }
    } catch (err) {
      console.error('Voice search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTextSearch = async (e, textParam) => {
    e?.preventDefault();
    const query = textParam !== undefined ? textParam : searchText;
    try {
      setLoading(true);
      if (query.trim()) {
        const { userService } = await import('../services/userService');
        const data = await userService.searchUsers(query.trim());
        setAllMatches((data.data || []).map(normalizeMate));
        setActiveSearch(query.trim());
      } else {
        await loadInitialMatches();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (mateUid) => {
    try {
      const { userService } = await import('../services/userService');
      await userService.followUser(mateUid);
      setMyFollowingUids(prev => new Set(prev).add(mateUid));
      alert('Successfully followed user!');
    } catch (err) {
      console.error('Failed to follow', err);
      if (err.response?.data?.error) alert(err.response.data.error);
    }
  };

  const handleChat = async (mate) => {
    try {
      const { chatService } = await import('../services/chatService');
      const res = await chatService.getOrCreateThread(mate.uid);
      if (res.success && res.matchId) {
        navigate(`/chat/${res.matchId}`, { state: { partner: mate } });
      }
    } catch (err) {
      console.error('Failed to start chat', err);
      alert('Failed to start chat.');
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const cleared = { college: '', department: '', year: '', minRating: 0, sortBy: 'relevance' };
    setFilters(cleared);
    setAppliedFilters(cleared);
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-gray-900 dark:text-on-surface">Find a Mate</h1>
        <p className="font-body-md text-body-md text-gray-600 dark:text-on-surface-variant mt-1">Discover peers who can help you grow.</p>
      </header>

      {/* Voice Search Area */}
      <section className="bg-white dark:bg-surface-container rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-surface-raised flex flex-col items-center justify-center gap-3 transition-colors">
        <h3 className="font-label-lg text-label-lg text-center text-gray-900 dark:text-on-surface">Describe what you need</h3>

        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-gray-500 dark:text-on-surface-variant" />
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-gray-100 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-full px-3 py-1 text-xs font-label-md text-gray-700 dark:text-on-surface focus:outline-none focus:border-success-lime"
          >
            {LANGUAGE_OPTIONS.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>

        <motion.button
          onClick={recording ? stopRecording : startRecording}
          whileTap={{ scale: 0.92 }}
          animate={recording ? { scale: [1, 1.08, 1], boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 28px rgba(239,68,68,0.5)', '0 0 0px rgba(239,68,68,0)'] } : {}}
          transition={recording ? { repeat: Infinity, duration: 1.4 } : {}}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
            recording
              ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]'
              : 'bg-success-lime text-green-900 shadow-[0_3px_0_#b3d266] active:translate-y-1 active:shadow-none'
          }`}
        >
          {recording ? <Square size={22} fill="currentColor" /> : <Mic size={26} />}
        </motion.button>

        <p className="font-label-md text-xs text-gray-500 dark:text-on-surface-variant text-center">
          {recording ? "Listening... Tap to stop" : "Tap to speak (e.g. 'I need help with Data Structures')"}
        </p>
      </section>

      {/* Manual Search + Filter Toggle */}
      <form onSubmit={handleTextSearch} className="flex gap-2">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by topic, name, or college..."
            className="w-full bg-white dark:bg-surface-container border border-gray-200 dark:border-surface-raised rounded-full py-3 pl-12 pr-4 focus:outline-none focus:border-success-lime text-gray-900 dark:text-on-surface placeholder:text-gray-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(prev => !prev)}
          className={`relative bg-white dark:bg-surface-container border rounded-full p-3 transition-colors ${
            hasActiveFilters
              ? 'border-[#7C3AED] bg-purple-50 dark:bg-purple-900/20'
              : 'border-gray-200 dark:border-surface-raised hover:bg-gray-50 dark:hover:bg-surface-raised'
          }`}
        >
          <SlidersHorizontal size={20} className={hasActiveFilters ? 'text-[#7C3AED]' : 'text-gray-600 dark:text-on-surface'} />
          {hasActiveFilters && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#7C3AED] rounded-full border-2 border-white dark:border-surface-container" />
          )}
        </button>
      </form>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onClear={handleClearFilters}
            onApply={handleApplyFilters}
            allDepartments={globalDepartments}
            allColleges={globalColleges}
          />
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {appliedFilters.college && (
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full border border-purple-200 dark:border-purple-700 flex items-center gap-1">
              {appliedFilters.college}
              <X size={12} className="cursor-pointer" onClick={() => { setFilters(f => ({ ...f, college: '' })); setAppliedFilters(f => ({ ...f, college: '' })); }} />
            </span>
          )}
          {appliedFilters.department && (
            <span className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs px-3 py-1 rounded-full border border-cyan-200 dark:border-cyan-700 flex items-center gap-1">
              {appliedFilters.department}
              <X size={12} className="cursor-pointer" onClick={() => { setFilters(f => ({ ...f, department: '' })); setAppliedFilters(f => ({ ...f, department: '' })); }} />
            </span>
          )}
          {appliedFilters.year && (
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-3 py-1 rounded-full border border-green-200 dark:border-green-700 flex items-center gap-1">
              Year {appliedFilters.year}
              <X size={12} className="cursor-pointer" onClick={() => { setFilters(f => ({ ...f, year: '' })); setAppliedFilters(f => ({ ...f, year: '' })); }} />
            </span>
          )}
          {appliedFilters.minRating > 0 && (
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs px-3 py-1 rounded-full border border-amber-200 dark:border-amber-700 flex items-center gap-1">
              <Star size={10} className="fill-current" /> {appliedFilters.minRating}+
              <X size={12} className="cursor-pointer" onClick={() => { setFilters(f => ({ ...f, minRating: 0 })); setAppliedFilters(f => ({ ...f, minRating: 0 })); }} />
            </span>
          )}
          {appliedFilters.sortBy !== 'relevance' && (
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-1">
              Sort: {SORT_OPTIONS.find(s => s.value === appliedFilters.sortBy)?.label}
              <X size={12} className="cursor-pointer" onClick={() => { setFilters(f => ({ ...f, sortBy: 'relevance' })); setAppliedFilters(f => ({ ...f, sortBy: 'relevance' })); }} />
            </span>
          )}
        </div>
      )}

      {/* Results List */}
      <section className="flex flex-col gap-4 mb-20">
        <h3 className="font-headline-md text-gray-900 dark:text-on-surface">
          {activeSearch ? `Matches for "${activeSearch}"` : 'Recommended for you'}
          {hasActiveFilters && <span className="text-sm font-normal text-gray-500 ml-2">({matches.length} results)</span>}
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500 dark:text-on-surface-variant">
            <Loader2 size={32} className="animate-spin mb-3 text-success-lime" />
            <span>Finding the perfect matches...</span>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white dark:bg-surface-container rounded-xl border border-gray-200 dark:border-surface-raised">
            {hasActiveFilters ? 'No matches with these filters. Try adjusting them.' : 'No matches found for this topic.'}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {matches.map((mate, i) => (
              <MatchCard
                key={mate.uid || i}
                mate={mate}
                index={i}
                onFollow={handleFollow}
                onChat={handleChat}
                isFollowed={myFollowingUids.has(mate.uid)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default FindMate;
