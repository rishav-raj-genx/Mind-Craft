import MapView, { Marker } from 'react-native-maps';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, InteractionManager, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGlobalAlert } from '@/components/GlobalAlertProvider';
import { LOW_MEMORY_LIST_PROPS } from '@/constants/list';
import { palette, radii } from '@/constants/theme';
import { fallbackMates, fetchMates, type Mate } from '@/services/mindcraft';

const MateCard = memo(function MateCard({ mate, onPress }: { mate: Mate; onPress: (mate: Mate) => void }) {
  return (
    <TouchableOpacity onPress={() => onPress(mate)} style={styles.mateCard} activeOpacity={0.82}>
      <Image
        source={{ uri: mate.photoUrl }}
        style={styles.avatar}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={120}
      />
      <View style={styles.mateInfo}>
        <Text style={styles.mateName}>{mate.name}</Text>
        <Text style={styles.mateSkill}>{mate.college || 'Nearby'} · {mate.skill}</Text>
      </View>
      <Text style={styles.matchBadge} numberOfLines={2}>{mate.matchReason}</Text>
    </TouchableOpacity>
  );
});

export default function FindScreen() {
  const { showAlert } = useGlobalAlert();
  const [mates, setMates] = useState<Mate[]>(fallbackMates);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchMates()
        .then((items) => {
          if (isMounted) setMates(items.length ? items : fallbackMates);
        })
        .catch(() => {
          if (isMounted) {
            setMates(fallbackMates);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    });

    return () => {
      isMounted = false;
      task.cancel();
    };
  }, []);

  const mapRegion = useMemo(() => ({
    latitude: mates[0]?.coordinate.latitude || 28.6139,
    longitude: mates[0]?.coordinate.longitude || 77.209,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  }), [mates]);

  const keyExtractor = useCallback((mate: Mate) => mate.id, []);
  const handleMatePress = useCallback((mate: Mate) => {
    showAlert({ type: 'info', title: 'Why matched?', message: mate.matchReason });
  }, [showAlert]);
  const renderMate = useCallback(({ item }: { item: Mate }) => (
    <MateCard mate={item} onPress={handleMatePress} />
  ), [handleMatePress]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Find My Mate</Text>
        <Text style={styles.title}>Study buddies near you</Text>
        <Text style={styles.status}>{isLoading ? 'Checking backend matches...' : `${mates.length} matches ready`}</Text>
      </View>

      <View style={styles.mapShell}>
        <MapView
          style={styles.map}
          initialRegion={mapRegion}>
          {mates.map((mate) => (
            <Marker
              key={mate.id}
              coordinate={mate.coordinate}
              title={mate.name}
              description={mate.skill}
              pinColor={palette.purple}
            />
          ))}
        </MapView>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Top matches</Text>
        <FlatList
          data={mates}
          renderItem={renderMate}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          {...LOW_MEMORY_LIST_PROPS}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  kicker: {
    color: palette.purple,
    fontWeight: '900',
    fontSize: 14,
  },
  title: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 30,
    marginTop: 4,
  },
  status: {
    color: palette.muted,
    fontWeight: '800',
    marginTop: 6,
  },
  mapShell: {
    marginHorizontal: 20,
    height: 310,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  map: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    padding: 20,
    paddingTop: 34,
    backgroundColor: palette.ink,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    gap: 12,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  mateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#302842',
    borderRadius: radii.xl,
    padding: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.lime,
  },
  mateInfo: {
    flex: 1,
  },
  mateName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  mateSkill: {
    color: '#CFC4DD',
    marginTop: 3,
  },
  matchBadge: {
    color: palette.ink,
    backgroundColor: palette.peach,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontWeight: '900',
    maxWidth: 120,
  },
  listContent: {
    gap: 12,
    paddingBottom: 96,
  },
});
