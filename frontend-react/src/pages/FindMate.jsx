import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchService } from '../services/matchService';
import { voiceService } from '../services/voiceService';
import { Search, Mic, MapPin, Star, Filter, Square, X, Globe, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const FindMate = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [searchText, setSearchText] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (currentUser) {
      loadInitialMatches();
    }
  }, [currentUser]);

  const loadInitialMatches = async () => {
    try {
      setLoading(true);
      const data = await matchService.getMatches(currentUser.uid);
      // Backend returns { success, count, data: [...] }
      setMatches(data.data || data.matches || []);
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleVoiceSearch(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Microphone access is required for voice search.");
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
      // Backend returns: { success, data: { transcript, language, detectedSkill, confidence, matchMethod, matches } }
      const resultData = response.data || response;
      
      setVoiceResult({
        text: resultData.transcript || '',
        skill: resultData.detectedSkill || '',
        confidence: resultData.confidence || 0,
        language: resultData.language || '',
      });
      
      if (resultData.matches && resultData.matches.length > 0) {
        setMatches(resultData.matches);
      }
    } catch (err) {
      console.error("Voice search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTextSearch = async (e) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    try {
      setLoading(true);
      const data = await matchService.getMatches(currentUser.uid);
      const allMatches = data.data || data.matches || [];
      // Client-side filter by search text
      const filtered = allMatches.filter(m => 
        m.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        m.college?.toLowerCase().includes(searchText.toLowerCase()) ||
        m.teaches?.some(s => s.toLowerCase().includes(searchText.toLowerCase()))
      );
      setMatches(filtered.length > 0 ? filtered : allMatches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (mateUid) => {
    try {
      await matchService.sendRequest({
        toUid: mateUid,
        sharedSkill: voiceResult?.skill || "General",
      });
      alert("Request Sent!");
    } catch (err) {
      console.error("Failed to connect", err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
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

        <button 
          onClick={recording ? stopRecording : startRecording}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${recording ? 'bg-red-500 animate-pulse scale-110 shadow-[0_0_30px_rgba(239,68,68,0.5)] text-white' : 'bg-success-lime text-green-900 shadow-[0_4px_0_#b3d266] active:translate-y-1 active:shadow-none'}`}
        >
          {recording ? <Square size={32} fill="currentColor" /> : <Mic size={36} />}
        </button>
        
        <p className="font-label-md text-gray-500 dark:text-on-surface-variant text-center">
          {recording ? "Listening... Tap to stop" : "Tap to speak (e.g. 'I need help with Data Structures')"}
        </p>

        {voiceResult && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-surface-raised rounded-xl flex items-start justify-between w-full border border-gray-200 dark:border-outline-variant/30">
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
            <button onClick={() => {setVoiceResult(null); loadInitialMatches();}} className="text-gray-400 hover:text-gray-600 dark:hover:text-on-surface transition-colors">
              <X size={20} />
            </button>
          </div>
        )}
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
          {voiceResult ? `Matches for "${voiceResult.skill || voiceResult.text}"` : "Recommended for you"}
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
              <div key={mate.uid || i} className="bg-white dark:bg-surface-container rounded-xl p-5 flex flex-col md:flex-row gap-4 border border-gray-200 dark:border-surface-raised shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => navigate(`/profile/${mate.uid}`)}>
                  <img src={mate.photoUrl || `https://ui-avatars.com/api/?name=${mate.name}&background=DCFD8B&color=151f00`} alt={mate.name} className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-surface-raised object-cover" />
                  <div>
                    <h4 className="font-headline-md text-[20px] text-gray-900 dark:text-primary">{mate.name}</h4>
                    <div className="flex items-center gap-1 text-gray-500 dark:text-on-surface-variant font-label-md mt-1">
                      <MapPin size={14} /> {mate.college}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 bg-orange-50 text-orange-600 dark:bg-surface-raised dark:text-warm-peach px-2 py-1 rounded-full font-label-md">
                    <Star size={14} className="fill-current" /> {mate.averageRating || "New"}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 md:max-w-[200px]">
                  {mate.teaches?.slice(0,2).map((skill, idx) => (
                    <span key={idx} className="bg-gray-100 text-gray-700 dark:bg-surface-raised dark:text-on-surface text-xs px-2 py-1 rounded border border-gray-200 dark:border-outline-variant">{skill}</span>
                  ))}
                  {mate.teaches?.length > 2 && <span className="bg-gray-100 dark:bg-surface-raised text-xs px-2 py-1 rounded text-gray-500">+{mate.teaches.length - 2}</span>}
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => handleConnect(mate.uid)} className="flex-1 md:flex-none bg-success-lime text-green-900 font-label-lg rounded-full py-2 px-6 active:scale-95 transition-transform shadow-[0_3px_0_#b3d266]">
                    Connect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default FindMate;
