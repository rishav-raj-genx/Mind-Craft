import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGlobalAlert } from '@/components/GlobalAlertProvider';
import { LOW_MEMORY_LIST_PROPS } from '@/constants/list';
import { palette, radii } from '@/constants/theme';
import {
  createDoubt,
  fallbackDoubts,
  fetchDoubts,
  type Doubt,
  type DoubtImage,
  type NewDoubtImage,
} from '@/services/mindcraft';

const TAGS = ['#DSA', '#Math', '#Physics', '#Economics', '#WebDev', '#Python', '#Other'];

type PickedImage = NewDoubtImage & { previewUri: string };

const DoubtCard = memo(function DoubtCard({
  doubt,
  onAnswer,
  onImagePress,
}: {
  doubt: Doubt;
  onAnswer: (doubt: Doubt) => void;
  onImagePress: (doubt: Doubt, index: number) => void;
}) {
  const firstImage = doubt.images[0];

  return (
    <View style={styles.doubtCard}>
      <Text style={styles.tag}>{doubt.tag}</Text>
      <Text style={styles.doubtTitle}>{doubt.title}</Text>
      {!!doubt.content && <Text style={styles.doubtContent} numberOfLines={3}>{doubt.content}</Text>}

      {!!firstImage && (
        <TouchableOpacity onPress={() => onImagePress(doubt, 0)} style={styles.imageTeaser} activeOpacity={0.86}>
          <Image source={{ uri: firstImage.dataUri }} style={styles.teaserImage} cachePolicy="memory-disk" contentFit="cover" />
          <View style={styles.imageBadge}>
            <Text style={styles.imageBadgeText}>{doubt.images.length} image{doubt.images.length > 1 ? 's' : ''}</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.aiAssist}>
        <Text style={styles.aiLabel}>AI Assist</Text>
        <Text style={styles.aiHint}>{doubt.hint}</Text>
      </View>
      <TouchableOpacity onPress={() => onAnswer(doubt)} style={styles.answerButton} activeOpacity={0.82}>
        <Text style={styles.answerText}>Answer</Text>
      </TouchableOpacity>
    </View>
  );
});

const AddDoubtModal = memo(function AddDoubtModal({
  visible,
  loading,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; content: string; tag: string; images: PickedImage[] }) => void;
}) {
  const { showAlert } = useGlobalAlert();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tag, setTag] = useState(TAGS[0]);
  const [images, setImages] = useState<PickedImage[]>([]);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setContent('');
    setTag(TAGS[0]);
    setImages([]);
  }, [visible]);

  const pickImages = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert({ type: 'warning', title: 'Permission needed', message: 'Allow photo access to attach doubt images.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4 - images.length,
      quality: 0.75,
    });

    if (result.canceled) return;

    const nextImages = await Promise.all(result.assets.slice(0, 4 - images.length).map(async (asset, index) => {
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.62, format: ImageManipulator.SaveFormat.JPEG },
      );
      return {
        uri: compressed.uri,
        previewUri: compressed.uri,
        name: `doubt-${Date.now()}-${index}.jpg`,
        type: 'image/jpeg',
      };
    }));

    setImages(current => [...current, ...nextImages].slice(0, 4));
  }, [images.length, showAlert]);

  const removeImage = useCallback((uri: string) => {
    setImages(current => current.filter(image => image.uri !== uri));
  }, []);

  const submit = useCallback(() => {
    if (!title.trim() || !content.trim()) {
      showAlert({ type: 'warning', title: 'Missing details', message: 'Add a title and description before posting.' });
      return;
    }
    onSubmit({ title: title.trim(), content: content.trim(), tag, images });
  }, [content, images, onSubmit, showAlert, tag, title]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.composer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Ask a Doubt</Text>
              <Text style={styles.modalSubtitle}>Add text, images, or both.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>x</Text>
            </Pressable>
          </View>

          <FlatList
            data={TAGS}
            horizontal
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setTag(item)} style={[styles.tagOption, tag === item && styles.tagOptionActive]}>
                <Text style={[styles.tagOptionText, tag === item && styles.tagOptionTextActive]}>{item}</Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagList}
            {...LOW_MEMORY_LIST_PROPS}
          />

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={palette.muted}
            maxLength={120}
            style={styles.input}
          />
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Describe what you tried..."
            placeholderTextColor={palette.muted}
            maxLength={1000}
            multiline
            style={[styles.input, styles.textArea]}
          />

          <View style={styles.pickRow}>
            <TouchableOpacity onPress={pickImages} disabled={images.length >= 4} style={styles.pickButton} activeOpacity={0.82}>
              <Text style={styles.pickButtonText}>Add images ({images.length}/4)</Text>
            </TouchableOpacity>
            <Text style={styles.compressionNote}>Compressed before upload</Text>
          </View>

          {!!images.length && (
            <FlatList
              data={images}
              horizontal
              keyExtractor={(item) => item.uri}
              renderItem={({ item }) => (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: item.previewUri }} style={styles.previewImage} cachePolicy="memory-disk" contentFit="cover" />
                  <Pressable onPress={() => removeImage(item.uri)} style={styles.removeImage}>
                    <Text style={styles.removeImageText}>x</Text>
                  </Pressable>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewList}
              {...LOW_MEMORY_LIST_PROPS}
            />
          )}

          <TouchableOpacity onPress={submit} disabled={loading} style={styles.submitButton} activeOpacity={0.82}>
            <Text style={styles.submitText}>{loading ? 'Posting...' : 'Post Doubt'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

const ImageSlideshowModal = memo(function ImageSlideshowModal({
  visible,
  images,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  images: DoubtImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [initialIndex, visible]);

  const current = images[index];
  const goPrev = useCallback(() => {
    setIndex(currentIndex => (currentIndex - 1 + images.length) % images.length);
  }, [images.length]);
  const goNext = useCallback(() => {
    setIndex(currentIndex => (currentIndex + 1) % images.length);
  }, [images.length]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.viewerOverlay}>
        <Pressable onPress={onClose} style={styles.viewerClose}>
          <Text style={styles.viewerCloseText}>x</Text>
        </Pressable>
        {!!current && (
          <Image source={{ uri: current.dataUri }} style={styles.fullImage} cachePolicy="memory-disk" contentFit="contain" />
        )}
        {images.length > 1 && (
          <View style={styles.viewerControls}>
            <TouchableOpacity onPress={goPrev} style={styles.viewerButton}>
              <Text style={styles.viewerButtonText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.viewerCount}>{index + 1}/{images.length}</Text>
            <TouchableOpacity onPress={goNext} style={styles.viewerButton}>
              <Text style={styles.viewerButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
});

export default function ForumScreen() {
  const { showAlert } = useGlobalAlert();
  const [doubts, setDoubts] = useState<Doubt[]>(fallbackDoubts);
  const [isLoading, setIsLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [viewer, setViewer] = useState<{ images: DoubtImage[]; index: number } | null>(null);

  const loadDoubts = useCallback(() => {
    return fetchDoubts()
      .then((items) => {
        setDoubts(items.length ? items : fallbackDoubts);
      })
      .catch(() => {
        setDoubts(fallbackDoubts);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      loadDoubts().finally(() => {
        if (!isMounted) return;
      });
    });

    return () => {
      isMounted = false;
      task.cancel();
    };
  }, [loadDoubts]);

  const sortedDoubts = useMemo(() => doubts, [doubts]);
  const keyExtractor = useCallback((doubt: Doubt) => doubt.id, []);
  const handleAsk = useCallback(() => setShowComposer(true), []);
  const handleAnswer = useCallback((doubt: Doubt) => {
    showAlert({ type: 'info', title: 'Answer doubt', message: `Reply to: ${doubt.title}` });
  }, [showAlert]);
  const handleImagePress = useCallback((doubt: Doubt, index: number) => {
    setViewer({ images: doubt.images, index });
  }, []);
  const handleCloseViewer = useCallback(() => setViewer(null), []);
  const handleCloseComposer = useCallback(() => setShowComposer(false), []);

  const handleSubmitDoubt = useCallback(async (payload: { title: string; content: string; tag: string; images: PickedImage[] }) => {
    setIsPosting(true);
    try {
      const created = await createDoubt(payload);
      setDoubts(current => [created, ...current.filter(doubt => !fallbackDoubts.some(fallback => fallback.id === doubt.id))]);
      setShowComposer(false);
      showAlert({ type: 'success', title: 'Doubt posted', message: created.images.length ? 'Your compressed images are attached.' : 'Your doubt is live.' });
    } catch (_err) {
      // The shared Axios interceptor shows the user-facing alert.
    } finally {
      setIsPosting(false);
    }
  }, [showAlert]);

  const renderDoubt = useCallback(({ item }: { item: Doubt }) => (
    <DoubtCard doubt={item} onAnswer={handleAnswer} onImagePress={handleImagePress} />
  ), [handleAnswer, handleImagePress]);

  const header = useMemo(() => (
    <>
      <View style={styles.header}>
        <Text style={styles.kicker}>Doubt Forum</Text>
        <Text style={styles.title}>Ask fast. Learn together.</Text>
        <Text style={styles.status}>{isLoading ? 'Loading latest doubts...' : `${doubts.length} doubts loaded`}</Text>
      </View>

      <TouchableOpacity onPress={handleAsk} style={styles.askButton} activeOpacity={0.82}>
        <Text style={styles.askButtonText}>Post a doubt</Text>
      </TouchableOpacity>
    </>
  ), [doubts.length, handleAsk, isLoading]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={sortedDoubts}
        renderItem={renderDoubt}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...LOW_MEMORY_LIST_PROPS}
      />
      <AddDoubtModal visible={showComposer} loading={isPosting} onClose={handleCloseComposer} onSubmit={handleSubmitDoubt} />
      <ImageSlideshowModal
        visible={!!viewer}
        images={viewer?.images || []}
        initialIndex={viewer?.index || 0}
        onClose={handleCloseViewer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  header: {
    backgroundColor: palette.purpleSoft,
    borderRadius: 32,
    padding: 22,
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
    marginTop: 8,
  },
  status: {
    color: palette.muted,
    fontWeight: '800',
    marginTop: 8,
  },
  askButton: {
    backgroundColor: palette.lime,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  askButtonText: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 16,
  },
  doubtCard: {
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  tag: {
    alignSelf: 'flex-start',
    color: palette.purple,
    backgroundColor: palette.purpleSoft,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontWeight: '900',
  },
  doubtTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 14,
  },
  doubtContent: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  imageTeaser: {
    marginTop: 14,
    height: 170,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.purpleSoft,
  },
  teaserImage: {
    width: '100%',
    height: '100%',
  },
  imageBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(32, 26, 46, 0.82)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  imageBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  aiAssist: {
    backgroundColor: palette.cyanSoft,
    borderRadius: radii.xl,
    padding: 14,
    marginTop: 14,
  },
  aiLabel: {
    color: '#007C96',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  aiHint: {
    color: palette.ink,
    marginTop: 6,
    lineHeight: 20,
  },
  answerButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: palette.peach,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  answerText: {
    color: palette.ink,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 26, 46, 0.42)',
  },
  composer: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 20,
    gap: 14,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: palette.muted,
    marginTop: 4,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
  },
  closeText: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  tagList: {
    gap: 8,
  },
  tagOption: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tagOptionActive: {
    backgroundColor: palette.purple,
    borderColor: palette.purple,
  },
  tagOptionText: {
    color: palette.muted,
    fontWeight: '900',
  },
  tagOptionTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  pickRow: {
    gap: 6,
  },
  pickButton: {
    alignSelf: 'flex-start',
    backgroundColor: palette.purpleSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  pickButtonText: {
    color: palette.purple,
    fontWeight: '900',
  },
  compressionNote: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  previewList: {
    gap: 10,
  },
  previewWrap: {
    width: 86,
    height: 86,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: palette.card,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(32, 26, 46, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  submitButton: {
    backgroundColor: palette.lime,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitText: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 16,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 18, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  viewerClose: {
    position: 'absolute',
    right: 22,
    top: 54,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseText: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  fullImage: {
    width: '100%',
    height: '72%',
  },
  viewerControls: {
    position: 'absolute',
    bottom: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  viewerButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerButtonText: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
  },
  viewerCount: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
