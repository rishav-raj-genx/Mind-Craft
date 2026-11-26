import { useMemo, useRef, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Maps activity count to a 5-level intensity level (0 to 4), or -1 for future days.
 */
function getIntensityLevel(count, isFuture) {
  if (isFuture) return -1;
  if (!count || count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * Returns Tailwind classNames for each cell level in both light and dark modes.
 */
function getCellColorClass(level) {
  switch (level) {
    case -1:
      return 'bg-transparent border border-dashed border-gray-200 dark:border-white/5 opacity-0 pointer-events-none';
    case 0:
      return 'bg-slate-100 dark:bg-[#1E1E2F] border border-slate-200/80 dark:border-[#2D2D44] hover:border-slate-400 dark:hover:border-slate-500';
    case 1:
      return 'bg-[#d9f99d] dark:bg-[#24421b] border border-[#bef264] dark:border-[#356127] hover:scale-110';
    case 2:
      return 'bg-[#a3e635] dark:bg-[#3b6d26] border border-[#84cc16] dark:border-[#529635] hover:scale-110';
    case 3:
      return 'bg-[#65a30d] dark:bg-[#74be34] border border-[#4d7c0f] dark:border-[#8ce33e] hover:scale-110';
    case 4:
      return 'bg-[#4d7c0f] dark:bg-[#DCFD8B] border border-[#3f6212] dark:border-[#DCFD8B] dark:shadow-[0_0_8px_rgba(220,253,139,0.5)] hover:scale-110';
    default:
      return 'bg-slate-100 dark:bg-[#1E1E2F] border border-slate-200 dark:border-[#2D2D44]';
  }
}

/**
 * ConsistencyGraph — Shared GitHub-style 52-week activity contribution heatmap.
 */
export default function ConsistencyGraph({
  activeDates = [],
  activityDays = [],
  streakData = null,
  title = 'Consistency Graph',
  subtitle = 'Past year',
  showCard = true,
  className = '',
}) {
  const scrollContainerRef = useRef(null);

  // Normalize incoming activity data into a Map<YYYY-MM-DD, count>
  const activityMap = useMemo(() => {
    const map = new Map();

    const rawDays = activityDays.length > 0
      ? activityDays
      : (streakData?.activityDays || []);

    if (rawDays.length > 0) {
      for (const item of rawDays) {
        if (!item) continue;
        const dateKey = typeof item === 'string'
          ? item.slice(0, 10)
          : (item.date ? String(item.date).slice(0, 10) : (item.activityDate ? String(item.activityDate).slice(0, 10) : ''));
        if (dateKey) {
          const count = typeof item.count === 'number'
            ? item.count
            : (Array.isArray(item.activityTypes) && item.activityTypes.length > 0 ? item.activityTypes.length : 1);
          map.set(dateKey, Math.max(map.get(dateKey) || 0, count));
        }
      }
    }

    const rawDates = activeDates.length > 0
      ? activeDates
      : (streakData?.activeDates || []);

    for (const d of rawDates) {
      if (!d) continue;
      const dateKey = typeof d === 'string'
        ? d.slice(0, 10)
        : (d.date ? String(d.date).slice(0, 10) : (d.toISOString ? d.toISOString().slice(0, 10) : ''));
      if (dateKey && !map.has(dateKey)) {
        map.set(dateKey, 1);
      }
    }

    return map;
  }, [activeDates, activityDays, streakData]);

  // Build 53-week (Sun-Sat) calendar grid ending on the upcoming Saturday of today
  const { columns, monthHeaders, totalActiveCount } = useMemo(() => {
    // Current IST date calculation
    const nowLocal = new Date();
    const utcMs = nowLocal.getTime() + (nowLocal.getTimezoneOffset() * 60000);
    const today = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Advance to upcoming Saturday (end of week)
    const endDate = new Date(today);
    while (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + 1);
    }

    // Go back 52 full weeks (53 total columns) aligned to Sunday
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (53 * 7) + 1);
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }

    const cols = [];
    let activeInYearCount = 0;
    const currDate = new Date(startDate);

    while (currDate <= endDate) {
      const week = [];
      for (let row = 0; row < 7; row++) {
        const y = currDate.getFullYear();
        const m = currDate.getMonth();
        const d = currDate.getDate();
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isFuture = dateStr > todayStr;
        const count = activityMap.get(dateStr) || 0;

        if (!isFuture && count > 0) {
          activeInYearCount++;
        }

        const level = getIntensityLevel(count, isFuture);
        const formattedDate = currDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        const tooltipText = isFuture
          ? ''
          : count > 0
          ? `${formattedDate} — ${count} ${count === 1 ? 'activity' : 'activities'}`
          : `No activity on ${formattedDate}`;

        week.push({
          date: dateStr,
          level,
          count,
          isFuture,
          formattedDate,
          tooltipText,
        });

        currDate.setDate(currDate.getDate() + 1);
      }

      cols.push(week);
    }

    // Month headers: place labels at month boundaries with >= 3 weeks separation
    const monthHeaderCandidates = [];
    let lastPlacedMonthKey = -1;
    let lastPlacedCol = -10;

    for (let c = 0; c < cols.length; c++) {
      const week = cols[c];
      let firstOfMonthDay = week.find((day) => {
        const parts = day.date.split('-');
        return parseInt(parts[2], 10) === 1;
      });

      if (c === 0 && !firstOfMonthDay) {
        // Only show start month if next month boundary is at least 3 weeks away
        const hasNextMonthSoon = cols.slice(1, 3).some((w) =>
          w.some((day) => parseInt(day.date.split('-')[2], 10) === 1)
        );
        if (!hasNextMonthSoon) {
          firstOfMonthDay = week[0];
        }
      }

      if (firstOfMonthDay) {
        const [y, m] = firstOfMonthDay.date.split('-').map(Number);
        const monthKey = y * 12 + (m - 1);
        if (monthKey !== lastPlacedMonthKey && (c - lastPlacedCol >= 3) && (cols.length - c >= 2)) {
          monthHeaderCandidates.push({
            col: c,
            label: MONTH_NAMES[m - 1],
          });
          lastPlacedMonthKey = monthKey;
          lastPlacedCol = c;
        }
      }
    }

    return {
      columns: cols,
      monthHeaders: monthHeaderCandidates,
      totalActiveCount: activeInYearCount,
    };
  }, [activityMap]);

  // Auto-scroll to the end (most recent month/today) on mount or data changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [columns]);

  const content = (
    <div className="flex flex-col w-full">
      {/* Header bar */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-[#DCFD8B]" />
          <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">
            {title}
          </h3>
        </div>
        {subtitle && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {subtitle}
          </span>
        )}
      </div>

      {/* Heatmap Area */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto pb-2 scroll-smooth select-none hide-scrollbar"
      >
        <div className="min-w-max flex flex-col py-1">
          {/* Month labels row */}
          <div className="flex items-center mb-2 pl-8">
            <div className="relative h-4 w-full" style={{ width: `${columns.length * 16}px` }}>
              {monthHeaders.map((mh) => (
                <span
                  key={`${mh.col}-${mh.label}`}
                  className="absolute text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-tight select-none pointer-events-none"
                  style={{ left: `${mh.col * 16}px` }}
                >
                  {mh.label}
                </span>
              ))}
            </div>
          </div>

          {/* Grid with day-of-week labels */}
          <div className="flex gap-1.5 items-start">
            {/* Day of week labels (Mon, Wed, Fri) aligned with rows 1, 3, 5 */}
            <div className="flex flex-col gap-[3px] w-6 shrink-0 pt-[1px] select-none text-[10px] font-medium text-gray-400 dark:text-gray-500">
              <span className="h-[13px] leading-[13px]" aria-hidden="true" />
              <span className="h-[13px] leading-[13px]">Mon</span>
              <span className="h-[13px] leading-[13px]" aria-hidden="true" />
              <span className="h-[13px] leading-[13px]">Wed</span>
              <span className="h-[13px] leading-[13px]" aria-hidden="true" />
              <span className="h-[13px] leading-[13px]">Fri</span>
              <span className="h-[13px] leading-[13px]" aria-hidden="true" />
            </div>

            {/* Weeks columns */}
            <div className="flex gap-[3px]">
              {columns.map((week, cIdx) => (
                <div key={cIdx} className="flex flex-col gap-[3px]">
                  {week.map((cell, rIdx) => {
                    if (cell.level === -1) {
                      return <div key={`${cIdx}-${rIdx}`} className="w-[13px] h-[13px] opacity-0 pointer-events-none" />;
                    }

                    return (
                      <div
                        key={`${cIdx}-${rIdx}`}
                        title={cell.tooltipText}
                        className={`relative group w-[13px] h-[13px] rounded-[2.5px] cursor-pointer transition-all duration-150 ${getCellColorClass(cell.level)}`}
                      >
                        {/* Hover Tooltip Popup */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50">
                          <div className="bg-gray-900/95 dark:bg-[#12121E]/95 text-white text-[11px] font-medium py-1 px-2.5 rounded-md shadow-xl whitespace-nowrap border border-gray-700/60 dark:border-white/10 backdrop-blur-sm">
                            {cell.tooltipText}
                          </div>
                          <div className="w-1.5 h-1.5 bg-gray-900/95 dark:bg-[#12121E]/95 rotate-45 -mt-0.5 border-r border-b border-gray-700/60 dark:border-white/10" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar: Total active days summary + 5-level legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium" data-testid="active-days-summary">
          <strong className="text-gray-800 dark:text-white font-semibold">
            {totalActiveCount}
          </strong>{' '}
          active {totalActiveCount === 1 ? 'day' : 'days'} in the past year
        </span>

        {/* 5-Level Intensity Legend */}
        <div className="flex items-center gap-1.5 font-medium ml-auto">
          <span className="text-[11px]">Less</span>
          <div className="flex gap-[3px] items-center">
            <div className={`w-3 h-3 rounded-[2px] ${getCellColorClass(0)}`} title="No activity" />
            <div className={`w-3 h-3 rounded-[2px] ${getCellColorClass(1)}`} title="1 activity" />
            <div className={`w-3 h-3 rounded-[2px] ${getCellColorClass(2)}`} title="2 activities" />
            <div className={`w-3 h-3 rounded-[2px] ${getCellColorClass(3)}`} title="3–4 activities" />
            <div className={`w-3 h-3 rounded-[2px] ${getCellColorClass(4)}`} title="5+ activities" />
          </div>
          <span className="text-[11px]">More</span>
        </div>
      </div>
    </div>
  );

  if (!showCard) {
    return <div className={`w-full ${className}`}>{content}</div>;
  }

  return (
    <section
      className={`bg-white dark:bg-[#1C1C2E] border border-slate-200 dark:border-transparent rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm dark:shadow-lg transition-colors overflow-hidden ${className}`}
    >
      {content}
    </section>
  );
}
