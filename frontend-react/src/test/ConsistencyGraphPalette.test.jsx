import { describe, expect, it } from 'vitest';
import { getCellColorClass } from '../components/ConsistencyGraph';

describe('ConsistencyGraph Purple-to-Lime Palette', () => {
  it('returns Mindcraft purple-to-lime classes for levels 1 through 4', () => {
    expect(getCellColorClass(1)).toContain('#4C1D95');
    expect(getCellColorClass(2)).toContain('#7C3AED');
    expect(getCellColorClass(3)).toContain('#BC84EE');
    expect(getCellColorClass(4)).toContain('#DCFD8B');
  });

  it('returns expected classes for future (-1) and empty (0) levels', () => {
    expect(getCellColorClass(-1)).toContain('opacity-0');
    expect(getCellColorClass(0)).toContain('bg-slate-100');
    expect(getCellColorClass(0)).toContain('dark:bg-[#1E1E2F]');
  });

  it('contains no legacy GitHub green hex codes at any intensity level', () => {
    const legacyGreens = ['#d9f99d', '#a3e635', '#65a30d', '#4d7c0f', '#24421b', '#3b6d26', '#74be34'];
    const levels = [-1, 0, 1, 2, 3, 4];

    for (const level of levels) {
      const classes = getCellColorClass(level).toLowerCase();
      expect(classes).not.toContain('#a3e635');
      expect(classes).not.toContain('#65a30d');
      for (const hex of legacyGreens) {
        expect(classes).not.toContain(hex);
      }
    }
  });
});
