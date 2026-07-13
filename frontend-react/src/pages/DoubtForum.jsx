import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { doubtService } from '../services/doubtService';
import { Plus, MessageCircle, X, ChevronUp, Send, Tag, Loader2, AlertCircle, Clock, Eye, CheckCircle2, Trash2, Sparkles, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';

const TAGS = ['#DSA', '#Math', '#Physics', '#Economics', '#Web Dev', '#Python', '#ML', '#Other'];
const FILTERS = ['All Doubts', 'My Doubts', '#DSA', '#Math', '#Physics', '#Economics', '#Web Dev', '#Python', '#ML', '#Other'];
const MAX_DOUBT_IMAGES = 4;

const compressDoubtImage = async (file) => {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.35,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.72,
  });

  return new File(
    [compressed],
    `${file.name.replace(/\.[^.]+$/, '') || 'doubt-image'}.webp`,
    { type: 'image/webp', lastModified: Date.now() },
  );
};

// Format timestamp
const timeAgo = (ts) => {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const tagColor = (tag) => {
  const map = {
    '#DSA': 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700',
    '#Math': 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
    '#Physics': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
    '#Economics': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700',
    '#Web Dev': 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700',
    '#Python': 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700',
    '#ML': 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700',
  };
  return map[tag] || 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700';
};

const AIAssistHint = ({ hint, status, error }) => {
  if (!hint && !status && !error) return null;

  const message = hint || (
    status === 'failed'
      ? 'AI Assist could not generate a Sarvam study hint for this doubt yet.'
      : 'AI Assist is waiting for the Sarvam study hint.'
  );

  return (
    <div className="mt-3 rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300 mb-1">
        <Sparkles size={13} />
        AI Assist
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-line text-gray-700 dark:text-gray-300">{message}</p>
    </div>
  );
};

const ImageSlideshowModal = ({ images = [], startIndex = 0, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const current = images[index];

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  const goPrev = () => setIndex(curr => (curr - 1 + images.length) % images.length);
  const goNext = () => setIndex(curr => (curr + 1) % images.length);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/95 text-gray-900 flex items-center justify-center shadow-lg">
        <X size={22} />
      </button>
      <img
        src={current.dataUri}
        alt="Doubt attachment"
        className="max-w-full max-h-[74vh] object-contain rounded-2xl shadow-2xl"
      />
      {images.length > 1 && (
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4">
          <button onClick={goPrev} className="w-12 h-12 rounded-full bg-[#DCFD8B] text-[#151f00] flex items-center justify-center shadow-lg">
            <ChevronLeft size={24} />
          </button>
          <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold">
            {index + 1}/{images.length}
          </span>
          <button onClick={goNext} className="w-12 h-12 rounded-full bg-[#DCFD8B] text-[#151f00] flex items-center justify-center shadow-lg">
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Add Doubt Modal ───────────────────────────────────────────────────
const AddDoubtModal = ({ onClose, onSubmit, loading }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tag, setTag] = useState(TAGS[0]);
  const [images, setImages] = useState([]);
  const [compressingImages, setCompressingImages] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 100);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleImageSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selected.length) return;

    setError('');
    if (images.length + selected.length > MAX_DOUBT_IMAGES) {
      setError(`You can attach up to ${MAX_DOUBT_IMAGES} images.`);
      return;
    }

    setCompressingImages(true);
    try {
      const compressed = await Promise.all(selected.map(compressDoubtImage));
      const next = compressed.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setImages(prev => [...prev, ...next].slice(0, MAX_DOUBT_IMAGES));
    } catch (err) {
      console.error('Image compression failed:', err);
      setError('Could not compress this image. Please try another screenshot.');
    } finally {
      setCompressingImages(false);
    }
  };

  const removeImage = (id) => {
    setImages(prev => {
      const target = prev.find(img => img.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(img => img.id !== id);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Please enter a title for your doubt.'); return; }
    if (!content.trim()) { setError('Please describe your doubt.'); return; }
    await onSubmit({ title: title.trim(), content: content.trim(), tag, images: images.map(img => img.file) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Sheet */}
      <div
        className="relative w-full sm:max-w-lg bg-white dark:bg-[#1A1A2E] rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="font-bold text-xl text-gray-900 dark:text-white">Ask a Doubt</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Get help from your peers</p>
          </div>

          <button
            id="close-doubt-modal"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Tag Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <Tag size={14} /> Topic
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  id={`tag-${t.replace('#', '')}`}
                  onClick={() => setTag(t)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    tag === t
                      ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-[0_0_12px_rgba(124,58,237,0.4)]'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#7C3AED] dark:hover:border-purple-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type a custom topic (e.g. #React)"
              value={TAGS.includes(tag) ? '' : tag}
              onChange={e => {
                let val = e.target.value;
                if (val && !val.startsWith('#')) val = '#' + val;
                setTag(val || TAGS[0]);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#7C3AED] dark:focus:border-purple-500 focus:ring-1 focus:ring-[#7C3AED] transition-all text-sm"
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="doubt-title" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleRef}
              id="doubt-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Confused about Red-Black trees..."
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#7C3AED] dark:focus:border-purple-500 focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-sm"
            />
            <div className="text-right text-xs text-gray-400 mt-1">{title.length}/120</div>
          </div>

          {/* Content */}
          <div>
            <label htmlFor="doubt-content" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Describe your doubt <span className="text-red-500">*</span>
            </label>
            <textarea
              id="doubt-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Explain what you're struggling with, what you've tried so far, and what you expect..."
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#7C3AED] dark:focus:border-purple-500 focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-sm resize-none"
            />
            <div className="text-right text-xs text-gray-400 mt-1">{content.length}/1000</div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Screenshots / images <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={loading || compressingImages || images.length >= MAX_DOUBT_IMAGES}
              className="w-full py-3 rounded-2xl border border-dashed border-[#7C3AED]/50 bg-purple-50 dark:bg-purple-900/20 text-[#7C3AED] dark:text-purple-300 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {compressingImages ? <Loader2 size={17} className="animate-spin" /> : <ImageIcon size={17} />}
              {compressingImages ? 'Compressing...' : `Add images (${images.length}/${MAX_DOUBT_IMAGES})`}
            </button>
            <p className="text-xs text-gray-400 mt-2">Images are compressed before upload and compressed again on the server.</p>

            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar mt-3 pb-1">
                {images.map(img => (
                  <div key={img.id} className="relative shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <img src={img.previewUrl} alt="Selected doubt attachment" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="submit-doubt"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#DCFD8B] text-[#151f00] font-bold text-base flex items-center justify-center gap-2 shadow-[0_4px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_2px_0_#b3d266] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Posting...</>
            ) : (
              <><Send size={18} /> Post Doubt</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Answer Doubt Modal (supports read-only mode for own doubts) ───────
const AnswerDoubtModal = ({ post, onClose, onSubmit, loading, isOwner, onImageOpen }) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!content.trim()) { setError('Please enter an answer.'); return; }
    await onSubmit(post.id, content.trim());
    setContent('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-[#1A1A2E] rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh]" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="font-bold text-xl text-gray-900 dark:text-white">
              {isOwner ? 'Answers to Your Doubt' : 'Answers'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isOwner ? 'See what peers have to say' : `Help ${post.authorName.split(' ')[0]} out`}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
          {/* Original Post */}
          <div className="bg-white dark:bg-[#1A1A2E] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Link to={`/profile/${post.authorUid}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={e => e.stopPropagation()}>
                <img src={post.authorAvatar} alt={post.authorName} className="w-8 h-8 rounded-full" />
                <span className="font-semibold text-sm text-gray-900 dark:text-white hover:underline">{post.authorName}</span>
              </Link>
              {isOwner && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED] bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">You</span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{timeAgo(post.createdAt)}</span>
            </div>
             <h3 className="font-bold text-gray-900 dark:text-white mb-1">{post.title}</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400">{post.content}</p>
             {(post.images || []).length > 0 && (
               <button
                 type="button"
                 onClick={() => onImageOpen(post.images, 0)}
                 className="mt-3 relative w-full h-36 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800"
               >
                 <img src={post.images[0].dataUri} alt="Doubt attachment" className="w-full h-full object-cover" />
                 <span className="absolute right-3 bottom-3 rounded-full bg-black/70 text-white text-xs font-bold px-3 py-1">
                   {post.images.length} image{post.images.length > 1 ? 's' : ''}
                 </span>
               </button>
             )}
             <AIAssistHint hint={post.aiHint} status={post.aiAssistStatus} error={post.aiAssistError} />
          </div>

          <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-4">{post.answers?.length || 0} Answers</h4>
          
          <div className="flex flex-col gap-4">
            {(post.answers || []).length === 0 && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                {isOwner ? 'No answers yet. Hang tight!' : 'Be the first to answer this doubt!'}
              </div>
            )}
            {(post.answers || []).map((ans, i) => (
              <div key={i} className="bg-white dark:bg-[#1C1C2E] rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-2">
                  <Link to={`/profile/${ans.authorUid}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img src={ans.authorAvatar} alt={ans.authorName} className="w-7 h-7 rounded-full" />
                    <span className="font-semibold text-sm text-gray-900 dark:text-white hover:underline">{ans.authorName}</span>
                  </Link>
                  <span className="text-xs text-gray-400 ml-auto">{timeAgo(ans.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 ml-10">{ans.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Only show the answer input form for non-owner */}
        {!isOwner && (
          <div className="p-4 bg-white dark:bg-[#1A1A2E] border-t border-gray-100 dark:border-gray-800 shrink-0">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your answer..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] resize-none text-sm"
              />
              {error && <div className="text-red-500 text-xs px-1">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="self-end px-5 py-2 rounded-xl bg-[#DCFD8B] text-[#151f00] font-bold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Post Answer
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Resolve Confirmation Modal ────────────────────────────────────────
const ResolveConfirmModal = ({ post, onClose, onConfirm, loading }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#1A1A2E] rounded-3xl shadow-2xl z-10 overflow-hidden" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle2 size={28} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Mark as Resolved?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              This will permanently remove <span className="font-semibold text-gray-700 dark:text-gray-300">"{post.title}"</span> from the forum. This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(post.id)}
              disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-green-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Resolve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main DoubtForum Component ─────────────────────────────────────────
const DoubtForum = () => {
  const { currentUser } = useAuth();
  const { markForumVisited } = useNotifications();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All Doubts');
  const [showModal, setShowModal] = useState(false);
  const [answeringDoubt, setAnsweringDoubt] = useState(null);
  const [resolvingDoubt, setResolvingDoubt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [upvotedIds, setUpvotedIds] = useState(new Set());
  const [successMsg, setSuccessMsg] = useState('');
  const [imageViewer, setImageViewer] = useState(null);
  const aiHintRetryRef = useRef(false);

  const fetchDoubts = async (filter = activeFilter) => {
    setLoading(true);
    setFetchError('');
    try {
      // For "My Doubts" we fetch all and filter client-side
      const fetchFilter = (filter === 'My Doubts') ? 'All Doubts' : filter;
      const res = await doubtService.getAllDoubts(fetchFilter);
      const data = res.data || [];
      setPosts(data);

      const hasMissingHints = data.some(d => d.id && (!d.aiHint || d.aiAssistStatus === 'empty' || d.aiAssistStatus === 'failed'));
      if (hasMissingHints && !aiHintRetryRef.current) {
        aiHintRetryRef.current = true;
        setTimeout(() => fetchDoubts(filter), 2500);
      }
      
      const doubtId = searchParams.get('doubtId');
      if (doubtId && data.length > 0) {
        const doubtToOpen = data.find(d => d.id === doubtId);
        if (doubtToOpen) {
          setAnsweringDoubt(doubtToOpen);
        }
      }
    } catch (err) {
      console.error('Failed to fetch doubts:', err);
      setFetchError('Could not load doubts. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    aiHintRetryRef.current = false;
    markForumVisited?.();
    fetchDoubts(activeFilter);
  }, [activeFilter, markForumVisited]);

  const handleAddDoubt = async ({ title, content, tag, images = [] }) => {
    setSubmitting(true);
    try {
      const res = await doubtService.createDoubt({ title, content, tag, images });
      setPosts(prev => [res.data, ...prev]);
      if (!res.data?.aiHint) {
        setTimeout(() => fetchDoubts(activeFilter), 2500);
      }
      setShowModal(false);
      setSuccessMsg('Your doubt was posted! 🎉');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to post doubt:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerDoubt = async (postId, content) => {
    setAnswering(true);
    try {
      const res = await doubtService.addAnswer(postId, content);
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const newAnswers = [...(p.answers || []), res.data];
          // also update the answeringDoubt in state so the modal updates immediately
          if (answeringDoubt?.id === postId) {
            setAnsweringDoubt(curr => ({ ...curr, answers: newAnswers, answerCount: newAnswers.length }));
          }
          return { ...p, answers: newAnswers, answerCount: newAnswers.length };
        }
        return p;
      }));
    } catch (err) {
      console.error('Failed to post answer:', err);
    } finally {
      setAnswering(false);
    }
  };

  const handleResolveDoubt = async (postId) => {
    setResolving(true);
    try {
      await doubtService.resolveDoubt(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      setResolvingDoubt(null);
      setSuccessMsg('Doubt resolved and removed! ✅');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to resolve doubt:', err);
      alert(err.response?.data?.error || 'Failed to resolve doubt.');
    } finally {
      setResolving(false);
    }
  };

  const handleUpvote = async (postId) => {
    try {
      const res = await doubtService.toggleUpvote(postId);
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, upvotes: res.upvotes, upvotedBy: res.upvoted
          ? [...(p.upvotedBy || []), currentUser?.uid]
          : (p.upvotedBy || []).filter(id => id !== currentUser?.uid) }
        : p
      ));
      setUpvotedIds(prev => {
        const next = new Set(prev);
        if (res.upvoted) next.add(postId); else next.delete(postId);
        return next;
      });
    } catch (err) {
      console.error('Upvote failed:', err);
    }
  };

  // Apply filter logic
  let filteredPosts = posts;
  if (activeFilter === 'My Doubts') {
    filteredPosts = posts.filter(p => p.authorUid === currentUser?.uid);
  } else if (activeFilter !== 'All Doubts') {
    filteredPosts = posts.filter(p => p.tag === activeFilter);
  }

  // For "All Doubts" and tag filters, separate own doubts out of the main list
  const isMyDoubtsTab = activeFilter === 'My Doubts';

  return (
    <div className="flex flex-col gap-5 min-h-[calc(100vh-140px)]">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Doubt Forum</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ask questions · Get answers from peers</p>
      </header>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-[#DCFD8B]/20 dark:bg-[#DCFD8B]/10 border border-[#DCFD8B]/50 text-[#3a4d00] dark:text-[#DCFD8B] rounded-2xl px-4 py-3 text-sm font-medium" style={{ animation: 'fadeIn 0.3s ease' }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar snap-x">
        {FILTERS.map(filter => (
          <button
            key={filter}
            id={`filter-${filter.replace(/[^a-z0-9]/gi, '-')}`}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap snap-start transition-all border ${
              activeFilter === filter
                ? filter === 'My Doubts'
                  ? 'bg-[#DCFD8B] text-[#151f00] border-[#DCFD8B] shadow-[0_0_12px_rgba(220,253,139,0.3)]'
                  : 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#7C3AED] dark:hover:border-purple-500'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex-1 flex flex-col gap-4 pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-[#DCFD8B] border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 dark:text-gray-400 text-sm">Loading doubts...</span>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <AlertCircle className="text-red-400" size={40} />
            <p className="text-gray-600 dark:text-gray-400 text-sm">{fetchError}</p>
            <button
              onClick={() => fetchDoubts(activeFilter)}
              className="px-5 py-2 rounded-full bg-[#DCFD8B] text-[#151f00] font-semibold text-sm hover:opacity-90 transition"
            >
              Retry
            </button>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <MessageCircle className="text-gray-300 dark:text-gray-600" size={48} />
            <div>
              <p className="font-semibold text-gray-600 dark:text-gray-400">
                {isMyDoubtsTab ? 'You have no doubts yet' : 'No doubts yet'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {isMyDoubtsTab ? 'Post one and get help from peers!' : 'Be the first to ask!'}
              </p>
            </div>
          </div>
        ) : (
          filteredPosts.map(post => {
            const isOwn = post.authorUid === currentUser?.uid;

            return (
              <article
                key={post.id}
                className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all group ${
                  isOwn
                    ? 'bg-[#DCFD8B]/5 dark:bg-[#DCFD8B]/[0.03] border-[#DCFD8B]/30 dark:border-[#DCFD8B]/20'
                    : 'bg-white dark:bg-gray-900/80 border-gray-100 dark:border-gray-800'
                }`}
              >
                {/* Author row */}
                <div className="flex justify-between items-start mb-3">
                  <Link to={`/profile/${post.authorUid}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={e => e.stopPropagation()}>
                    <img
                      src={post.authorAvatar || getAvatarUrl(post.authorName)}
                      alt={post.authorName}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white hover:underline">{post.authorName}</p>
                        {isOwn && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED] bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={11} />
                        {timeAgo(post.createdAt)}
                      </div>
                    </div>
                  </Link>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tagColor(post.tag)}`}>
                    {post.tag}
                  </span>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <h2 className="font-bold text-base text-gray-900 dark:text-white mb-1">{post.title}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">{post.content}</p>
                  {(post.images || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setImageViewer({ images: post.images, startIndex: 0 })}
                      className="mt-3 relative w-full h-40 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800"
                    >
                      <img src={post.images[0].dataUri} alt="Doubt attachment" className="w-full h-full object-cover" />
                      <span className="absolute right-3 bottom-3 rounded-full bg-black/70 text-white text-xs font-bold px-3 py-1">
                        {post.images.length} image{post.images.length > 1 ? 's' : ''}
                      </span>
                    </button>
                  )}
                  <AIAssistHint hint={post.aiHint} status={post.aiAssistStatus} error={post.aiAssistError} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    id={`upvote-${post.id}`}
                    onClick={() => handleUpvote(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                      (post.upvotedBy || []).includes(currentUser?.uid)
                        ? 'bg-[#DCFD8B]/20 dark:bg-[#DCFD8B]/10 text-[#3a4d00] dark:text-[#DCFD8B] border-[#DCFD8B]/50'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#DCFD8B]/50'
                    }`}
                  >
                    <ChevronUp size={15} />
                    {post.upvotes || 0}
                  </button>

                  <div className="flex items-center gap-2">
                    {isOwn ? (
                      <>
                        {/* View Answers button for own doubts */}
                        <button
                          id={`view-answers-${post.id}`}
                          onClick={() => setAnsweringDoubt(post)}
                          className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 font-semibold px-4 py-1.5 rounded-full text-sm flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <Eye size={14} />
                          {post.answerCount > 0 ? `${post.answerCount} Answers` : 'View Answers'}
                        </button>
                        {/* Mark Resolved button */}
                        <button
                          id={`resolve-${post.id}`}
                          onClick={() => setResolvingDoubt(post)}
                          className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 font-semibold px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        >
                          <CheckCircle2 size={14} />
                          Resolved
                        </button>
                      </>
                    ) : (
                      /* Answer button for others' doubts */
                      <button
                        id={`answer-${post.id}`}
                        onClick={() => setAnsweringDoubt(post)}
                        className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 font-semibold px-4 py-1.5 rounded-full text-sm flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        <MessageCircle size={14} />
                        {post.answerCount > 0 ? `${post.answerCount} Answers` : 'Answer'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      <button
        id="add-doubt-fab"
        onClick={() => setShowModal(true)}
        className="fixed bottom-[110px] right-6 w-14 h-14 bg-[#DCFD8B] text-[#151f00] rounded-full flex items-center justify-center z-40 shadow-[0_4px_20px_rgba(220,253,139,0.5)] hover:scale-110 active:scale-95 transition-transform"
        aria-label="Ask a doubt"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* Modals */}
      {showModal && (
        <AddDoubtModal
          onClose={() => setShowModal(false)}
          onSubmit={handleAddDoubt}
          loading={submitting}
        />
      )}
      {answeringDoubt && (
        <AnswerDoubtModal
          post={answeringDoubt}
          onClose={() => setAnsweringDoubt(null)}
          onSubmit={handleAnswerDoubt}
          loading={answering}
          isOwner={answeringDoubt.authorUid === currentUser?.uid}
          onImageOpen={(images, startIndex = 0) => setImageViewer({ images, startIndex })}
        />
      )}
      {resolvingDoubt && (
        <ResolveConfirmModal
          post={resolvingDoubt}
          onClose={() => setResolvingDoubt(null)}
          onConfirm={handleResolveDoubt}
          loading={resolving}
        />
      )}
      {imageViewer && (
        <ImageSlideshowModal
          images={imageViewer.images}
          startIndex={imageViewer.startIndex}
          onClose={() => setImageViewer(null)}
        />
      )}
    </div>
  );
};

export default DoubtForum;
