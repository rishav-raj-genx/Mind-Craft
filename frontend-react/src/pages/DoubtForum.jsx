import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, MessageCircle } from 'lucide-react';

const DoubtForum = () => {
  const { currentUser } = useAuth();
  
  // Dummy data representing forum posts for the UI
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: "Muskan",
      authorAvatar: "https://ui-avatars.com/api/?name=Muskan",
      timeAgo: "10m ago",
      tag: "#DSA",
      title: "Confused about Red-Black trees...",
      content: "I understand the basic properties, but I'm struggling with the rotation logic during insertion. Can someone explain the cases simply?",
      answers: 2,
      upvotes: 2
    },
    {
      id: 2,
      author: "Satya",
      authorAvatar: "https://ui-avatars.com/api/?name=Satya",
      timeAgo: "45m ago",
      tag: "#Math",
      title: "Integration by parts trick?",
      content: "Is there a faster way to remember the LIATE rule, or a visual trick to know which part to set as 'u'?",
      answers: 5,
      upvotes: 12
    },
    {
      id: 3,
      author: "Kavita",
      authorAvatar: "https://ui-avatars.com/api/?name=Kavita",
      timeAgo: "2h ago",
      tag: "#DSA",
      title: "Dynamic Programming approach for Knapsack",
      content: "I can write the recursive solution, but I always mess up the base cases when converting to memoization. Any tips?",
      answers: 0,
      upvotes: 0
    }
  ]);

  const [activeFilter, setActiveFilter] = useState("All Doubts");
  const filters = ["All Doubts", "#DSA", "#Math", "#Physics", "#Economics"];

  const filteredPosts = activeFilter === "All Doubts" 
    ? posts 
    : posts.filter(post => post.tag === activeFilter);

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-140px)]">
      {/* Header */}
      <header>
        <h1 className="font-headline-lg text-headline-lg text-gray-900 dark:text-on-surface">Doubt Forum</h1>
        <p className="font-body-md text-body-md text-gray-600 dark:text-on-surface-variant mt-1">Ask questions and help peers</p>
      </header>

      {/* Filters */}
      <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar snap-x">
        {filters.map(filter => (
          <button 
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap snap-start transition-colors border ${
              activeFilter === filter 
                ? 'bg-purple-100 dark:bg-surface-raised text-purple-900 dark:text-on-surface border-purple-300 dark:border-outline-variant shadow-[0_0_10px_rgba(188,132,238,0.2)]'
                : 'bg-white dark:bg-surface-container text-gray-600 dark:text-on-surface-variant border-gray-200 dark:border-surface-raised hover:bg-gray-50'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-24 hide-scrollbar">
        {filteredPosts.map(post => (
          <article key={post.id} className="bg-white dark:bg-surface-container rounded-2xl p-5 border border-gray-200 dark:border-surface-raised shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="flex justify-between items-start z-10">
              <div className="flex items-center gap-3">
                <img src={post.authorAvatar} alt={post.author} className="w-10 h-10 rounded-full bg-gray-200 object-cover" />
                <div>
                  <h3 className="font-label-lg text-gray-900 dark:text-on-surface">{post.author}</h3>
                  <p className="font-label-md text-gray-500">{post.timeAgo}</p>
                </div>
              </div>
              <span className={`px-3 py-1 bg-gray-100 dark:bg-surface-raised font-label-md rounded-full border border-gray-200 dark:border-surface-variant ${post.tag === '#DSA' ? 'text-purple-600' : 'text-green-600'}`}>
                {post.tag}
              </span>
            </div>

            <div className="z-10 mt-1">
              <h2 className="font-body-lg text-lg font-bold text-gray-900 dark:text-on-surface">{post.title}</h2>
              <p className="font-body-md text-gray-600 dark:text-on-surface-variant mt-1 line-clamp-2">{post.content}</p>
            </div>

            <div className="mt-2 flex justify-between items-center z-10 pt-2 border-t border-gray-100 dark:border-surface-raised">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-500">+{post.upvotes}</span>
              </div>
              <button className="bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container font-label-md px-5 py-2 rounded-full flex items-center gap-2 hover:bg-purple-200 transition-colors">
                <MessageCircle size={16} />
                {post.answers > 0 ? `${post.answers} Answers` : 'Answer'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 md:right-auto md:left-[calc(50%+400px)] w-14 h-14 bg-success-lime text-green-900 rounded-full flex items-center justify-center z-40 shadow-[0_4px_10px_rgba(220,253,139,0.4)] hover:scale-105 transition-transform">
        <Plus size={28} />
      </button>
    </div>
  );
};

export default DoubtForum;
