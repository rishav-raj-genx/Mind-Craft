import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchService } from '../services/matchService';
import { voiceService } from '../services/voiceService';
import { Search, Mic, MapPin, Star, Filter, Square, X, Globe, Loader2, MessageSquare, GitBranch, ChevronDown, ChevronUp } from 'lucide-react';
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

  // Construct graph data
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

// ─── Page ─────────────────────────────────────────────────────────────────────
const FindMate = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [myFollowingUids, setMyFollowingUids] = useState(new Set());

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (currentUser) {
      loadInitialMatches();
      loadMyFollowing();
    }
  }, [currentUser]);

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
      setMatches((data.data || data.matches || []).map(normalizeMate));
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
        setMatches((resultData.matches || []).map(normalizeMate));
        setActiveSearch(resultData.detectedSkill || transcript);
        if (transcript) handleTextSearch(null, transcript);
      } else {
        setMatches([]);
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
        setMatches((data.data || []).map(normalizeMate));
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

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-gray-900 dark:text-on-surface">Find a Mate</h1>
        <p className="font-body-md text-body-md text-gray-600 dark:text-on-surface-variant mt-1">Discover peers who can help you grow.</p>
      </header>

      {/* Voice Search Area */}
      <section className="bg-white dark:bg-surface-container rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-surface-raised flex flex-col items-center justify-center gap-4 transition-colors">
        <h3 className="font-headline-md text-headline-md text-center text-gray-900 dark:text-on-surface">Describe what you need</h3>

        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-gray-500 dark:text-on-surface-variant" />
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-gray-100 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-full px-3 py-1.5 text-sm font-label-md text-gray-700 dark:text-on-surface focus:outline-none focus:border-success-lime"
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
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
            recording
              ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]'
              : 'bg-success-lime text-green-900 shadow-[0_4px_0_#b3d266] active:translate-y-1 active:shadow-none'
          }`}
        >
          {recording ? <Square size={32} fill="currentColor" /> : <Mic size={36} />}
        </motion.button>

        <p className="font-label-md text-gray-500 dark:text-on-surface-variant text-center">
          {recording ? "Listening... Tap to stop" : "Tap to speak (e.g. 'I need help with Data Structures')"}
        </p>

        <AnimatePresence>
          {voiceResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-gray-50 dark:bg-surface-raised rounded-xl flex items-start justify-between w-full border border-gray-200 dark:border-outline-variant/30"
            >
              <div>
                <div className="font-label-md text-purple-600 dark:text-secondary uppercase tracking-wide">Detected Intent</div>
                <p className="font-body-md text-gray-900 dark:text-on-surface mt-1">"{voiceResult.text}"</p>
                {voiceResult.skill && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="bg-success-lime/20 text-green-700 dark:text-success-lime px-3 py-1 rounded-full text-xs font-label-md border border-success-lime/30">
                      Skill: {voiceResult.skill}
                    </span>
                    {voiceResult.confidence > 0 && (
                      <span className="text-xs text-gray-500 dark:text-on-surface-variant">
                        ({Math.round(voiceResult.confidence * 100)}% confident)
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => { setVoiceResult(null); loadInitialMatches(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-on-surface transition-colors">
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Manual Search */}
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
        <button type="submit" className="bg-white dark:bg-surface-container border border-gray-200 dark:border-surface-raised rounded-full p-3 hover:bg-gray-50 dark:hover:bg-surface-raised transition-colors">
          <Filter size={20} className="text-gray-600 dark:text-on-surface" />
        </button>
      </form>

      {/* Results List */}
      <section className="flex flex-col gap-4 mb-20">
        <h3 className="font-headline-md text-gray-900 dark:text-on-surface">
          {activeSearch ? `Matches for "${activeSearch}"` : 'Recommended for you'}
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500 dark:text-on-surface-variant">
            <Loader2 size={32} className="animate-spin mb-3 text-success-lime" />
            <span>Finding the perfect matches...</span>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white dark:bg-surface-container rounded-xl border border-gray-200 dark:border-surface-raised">
            No matches found for this topic.
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
