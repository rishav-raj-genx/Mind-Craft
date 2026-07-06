import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { gamificationService } from '../services/gamificationService';
import { matchService } from '../services/matchService';
import { doubtService } from '../services/doubtService';
import { userService } from '../services/userService';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

const normalizeTopic = (topic) => String(topic || '').trim().toLowerCase();

const findTopicOverlap = (left = [], right = []) => {
  const rightMap = new Map(right.map(topic => [normalizeTopic(topic), topic]).filter(([key]) => key));
  return left
    .map(topic => rightMap.get(normalizeTopic(topic)))
    .filter(Boolean);
};

const scoreRecommendedMates = (currentProfile, candidates = []) => {
  const currentLearns = currentProfile?.learns || [];
  const currentTeaches = currentProfile?.teaches || [];
  const currentCollege = normalizeTopic(currentProfile?.college);

  return candidates
    .filter(mate => mate?.uid && mate.uid !== currentProfile?.uid)
    .map((mate) => {
      const teachesMe = findTopicOverlap(currentLearns, mate.teaches || []);
      const learnsFromMe = findTopicOverlap(currentTeaches, mate.learns || []);
      const sharedSkills = [...new Set([...teachesMe, ...learnsFromMe])];
      const sameCollege = currentCollege && normalizeTopic(mate.college) === currentCollege;
      const rating = Number(mate.averageRating || 0);
      const sessions = Number(mate.totalSessions || 0);
      const score =
        teachesMe.length * 5 +
        learnsFromMe.length * 3 +
        (sameCollege ? 1.5 : 0) +
        Math.min(rating, 5) * 0.35 +
        Math.min(sessions, 20) * 0.05;

      return {
        ...mate,
        sharedSkills,
        teachesMe,
        learnsFromMe,
        matchScore: score,
      };
    })
    .filter(mate => mate.sharedSkills.length > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
};

export const AppProvider = ({ children }) => {
  const { currentUser } = useAuth();
  
  const [globalData, setGlobalData] = useState({
    profileName: '',
    currentProfile: null,
    streak: { currentStreak: 0 },
    badgeCount: 0,
    topMates: [],
    trendingTopics: [],
    followedUsers: [],
  });
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('mindcraft-theme');
    return saved !== null ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('mindcraft-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('mindcraft-theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    let mounted = true;

    const loadGlobalData = async () => {
      if (!currentUser) {
        setIsAppLoading(false);
        return;
      }

      setIsAppLoading(true);

      let currentProfile = null;
      let profileName = '';

      try {
        const profileRes = await userService.getProfile(currentUser.uid);
        currentProfile = profileRes?.data || null;
        if (currentProfile?.name) profileName = currentProfile.name;
      } catch (err) {
        console.error("Failed to load profile:", err);
      }

      let streak = { currentStreak: 0 };
      let badgeCount = 0;
      let topMates = [];
      let trendingTopics = [];
      let followedUsers = [];

      const loadStreak = async () => {
        try { 
          const checkInRes = await gamificationService.checkIn();
          streak = checkInRes.data || checkInRes || { currentStreak: 0 };
        } catch (err) {
          try {
            const s = await gamificationService.getStreak(currentUser.uid);
            streak = s.data || s || { currentStreak: 0 };
          } catch { /* silent */ }
        }
      };

      const loadBadges = async () => {
        try {
          const badgeRes = await gamificationService.getBadges(currentUser.uid);
          badgeCount = badgeRes.data?.totalEarned || 0;
        } catch { /* silent */ }
      };

      const loadMatches = async () => {
        if (currentProfile) {
          try {
            const usersRes = await userService.searchUsers('');
            const recommended = scoreRecommendedMates(currentProfile, usersRes.data || []);
            if (recommended.length > 0) {
              topMates = recommended;
              return;
            }
          } catch (err) {
            console.error("Recommended mates scoring failed:", err);
          }
        }

        try {
          let m = await matchService.getMatches(currentUser.uid);
          let matchList = m.data || m.matches || [];
          if (matchList.length === 0) {
            m = await matchService.getBroadMatches(currentUser.uid);
            matchList = m.data || m.matches || [];
          }
          const flattened = matchList.map(item => ({
            ...item.tutor,
            sharedSkills: item.sharedSkills,
            activityScore: item.activityScore
          }));
          if (flattened.length > 0) {
            topMates = flattened.slice(0, 3);
          }
        } catch (err) {
          console.error("Match fetching failed:", err);
        }
      };

      const loadTrending = async () => {
        try {
          const trendRes = await doubtService.getTrending();
          trendingTopics = trendRes.data || [];
        } catch { /* silent */ }
      };

      const loadFollowing = async () => {
        try {
          const followingRes = await userService.getFollowing(currentUser.uid);
          followedUsers = followingRes.data || [];
        } catch { /* silent */ }
      };

      await Promise.all([
        loadStreak(),
        loadBadges(),
        loadMatches(),
        loadTrending(),
        loadFollowing(),
      ]);

      if (mounted) {
        setGlobalData({
          profileName,
          currentProfile,
          streak,
          badgeCount,
          topMates,
          trendingTopics,
          followedUsers,
        });
        
        // Add a slight artificial delay for the theme-based loading screen to animate beautifully
        setTimeout(() => setIsAppLoading(false), 1200);
      }
    };

    loadGlobalData();

    return () => { mounted = false; };
  }, [currentUser]);

  return (
    <AppContext.Provider value={{ globalData, isAppLoading, setGlobalData, isDark, setIsDark }}>
      {children}
    </AppContext.Provider>
  );
};
