import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  compact?: boolean;
};

const brand = {
  lime: '#dcfd8b',
  purple: '#bc84ee',
  ink: '#0f172a',
  shell: '#FFF9F1',
  muted: '#64748b',
};

function Logo({ size = 72, showWordmark = false, compact = false }: LogoProps) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Mindcraft logo">
        <Circle cx="60" cy="60" r="54" fill={brand.shell} />
        <Path
          d="M34 57c-10-2-15-12-10-22 4-8 12-10 20-6 5-10 20-11 27-2 9-3 21 3 23 14 2 11-5 20-15 22-1 13-11 23-25 23-13 0-23-8-26-20-6-1-11-4-14-9Z"
          fill={brand.lime}
          stroke={brand.ink}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <Path
          d="M45 34c-5 7-4 18 4 24M72 30c5 8 5 18-1 26M37 61c9-1 18 4 22 12M72 57c9 1 16 8 17 17"
          fill="none"
          stroke={brand.ink}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path d="M39 78 72 61l29 17-29 17-33-17Z" fill={brand.purple} stroke={brand.ink} strokeWidth="5" strokeLinejoin="round" />
        <Path d="M72 95v12" stroke={brand.ink} strokeWidth="5" strokeLinecap="round" />
        <Rect x="64" y="104" width="16" height="8" rx="4" fill={brand.lime} stroke={brand.ink} strokeWidth="4" />
        <Path d="M89 36c4 8 8 12 16 16-8 4-12 8-16 16-4-8-8-12-16-16 8-4 12-8 16-16Z" fill={brand.purple} stroke={brand.ink} strokeWidth="4" strokeLinejoin="round" />
      </Svg>
      {showWordmark && (
        <View style={styles.wordmarkWrap}>
          <Text style={styles.wordmark}>Mindcraft</Text>
          <Text style={styles.tagline}>Learning together</Text>
        </View>
      )}
    </View>
  );
}

export default memo(Logo);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    flexDirection: 'row',
    gap: 10,
  },
  wordmarkWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  wordmark: {
    color: brand.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  tagline: {
    color: brand.muted,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
});
