import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import WorksheetCropEditor from '../components/WorksheetCropEditor';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList } from '../navigation/types';

const MAX_PAGES = 15;

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorksheetCapture'>;

export default function WorksheetCaptureScreen() {
  const navigation = useNavigation<Nav>();
  const [pages, setPages] = useState<string[]>([]);
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const activeCrop = cropQueue[0];

  const remainingSlots = MAX_PAGES - pages.length - cropQueue.length;

  const addFromCamera = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Camera capture requires the app on a tablet or phone.');
      return;
    }
    if (remainingSlots <= 0) {
      Alert.alert('Page limit', `You can add up to ${MAX_PAGES} pages.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission', 'Camera access is needed to photograph worksheets.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPages((p) => [...p, result.assets[0].uri]);
  };

  const addFromLibrary = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Page limit', `You can add up to ${MAX_PAGES} pages.`);
      return;
    }
    const result =
      Platform.OS === 'web'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: Math.min(remainingSlots, 15),
            quality: 0.9,
          });
    if (result.canceled || !result.assets?.length) return;
    const uris = result.assets.map((a) => a.uri);
    setCropQueue((q) => [...q, ...uris]);
  };

  const removePage = (index: number) => {
    setPages((p) => p.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (cropQueue.length > 0) {
      Alert.alert('Finish cropping', 'Apply or skip crop for the remaining photos first.');
      return;
    }
    if (pages.length === 0) return;
    navigation.navigate('OcrLiveText', { pageUris: [...pages] });
  };

  const onCropConfirm = (croppedUri: string) => {
    setPages((p) => [...p, croppedUri]);
    setCropQueue((q) => q.slice(1));
  };

  const onCropSkip = () => {
    if (!activeCrop) return;
    setPages((p) => [...p, activeCrop]);
    setCropQueue((q) => q.slice(1));
  };

  const onCropCancel = () => {
    setCropQueue([]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={spacing.innerGapSmall}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Worksheet pages</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.lead}>
        Add one or more pages. Photos from the camera can be cropped in the system editor. Photos from your
        library open in the crop tool next. Then we scan text (Live Text style) so you can select phrases.
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionCard, remainingSlots <= 0 && styles.actionCardDisabled]}
          onPress={addFromCamera}
          disabled={remainingSlots <= 0}
        >
          <Ionicons name="camera" size={28} color={colors.surface} />
          <Text style={styles.actionCardText}>Take photo</Text>
        </Pressable>
        <Pressable
          style={[styles.actionOutline, remainingSlots <= 0 && styles.actionCardDisabled]}
          onPress={addFromLibrary}
          disabled={remainingSlots <= 0}
        >
          <Ionicons name="images-outline" size={22} color={colors.primary} />
          <Text style={styles.actionOutlineText}>Choose from library</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>
        Pages ({pages.length + cropQueue.length}/{MAX_PAGES})
      </Text>

      {cropQueue.length > 0 ? (
        <Text style={styles.queueBanner}>
          {cropQueue.length} photo(s) from your library — crop or use full image for each.
        </Text>
      ) : null}

      <FlatList
        data={pages}
        keyExtractor={(item, index) => `${item}-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>No pages yet. Use the buttons above.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.pageRow}>
            <Image source={{ uri: item }} style={styles.thumb} resizeMode="cover" />
            <Text style={styles.pageLabel}>Page {index + 1}</Text>
            <Pressable
              onPress={() => removePage(index)}
              hitSlop={spacing.innerGapSmall}
              accessibilityLabel="Remove page"
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </Pressable>
          </View>
        )}
      />

      <Pressable
        style={[styles.continueBtn, (pages.length === 0 || cropQueue.length > 0) && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={pages.length === 0 || cropQueue.length > 0}
      >
        <Text style={styles.continueBtnText}>Scan pages (Live Text)</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.surface} />
      </Pressable>

      {activeCrop ? (
        <WorksheetCropEditor
          uri={activeCrop}
          onConfirm={onCropConfirm}
          onSkipFullImage={onCropSkip}
          onCancel={onCropCancel}
        />
      ) : null}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, color: colors.textPrimary },
  lead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingHorizontal: spacing.pagePadding,
    marginBottom: spacing.innerGap,
  },
  actions: {
    paddingHorizontal: spacing.pagePadding,
    gap: spacing.innerGapSmall,
    marginBottom: spacing.innerGap,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    backgroundColor: colors.primary,
    borderRadius: radii.answerCard,
    paddingVertical: spacing.innerGap,
    ...shadows.fab,
  },
  actionCardDisabled: { opacity: 0.45 },
  actionCardText: { ...typography.button, color: colors.surface },
  actionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
  },
  actionOutlineText: { ...typography.bodySmall, color: colors.primary },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    paddingHorizontal: spacing.pagePadding,
    marginBottom: spacing.innerGapSmall,
  },
  queueBanner: {
    ...typography.caption,
    color: colors.warningText,
    backgroundColor: colors.warning,
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.innerGapSmall,
    padding: spacing.innerGapSmall,
    borderRadius: radii.chip,
  },
  listContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sectionGapBottom,
    gap: spacing.cardGap,
  },
  empty: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGap,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGapSmall,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.thumbnail,
    backgroundColor: colors.surfaceMuted,
  },
  pageLabel: { ...typography.cardTitle, color: colors.textPrimary, flex: 1 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.sectionGapBottom,
    paddingVertical: spacing.innerGap,
    borderRadius: radii.circle,
    backgroundColor: colors.primary,
    ...shadows.fab,
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { ...typography.button, color: colors.surface },
});
