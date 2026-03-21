import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radii } from '../theme';
import { RootStackParamList } from '../navigation/types';
import {
  getRecentWorksheets,
  type RecentWorksheet,
} from '../services/recentWorksheets';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

function formatRelativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [recents, setRecents] = useState<RecentWorksheet[]>([]);

  const loadRecents = useCallback(() => {
    void getRecentWorksheets().then(setRecents);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecents();
    }, [loadRecents])
  );

  const handleScanWorksheet = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    navigation.navigate('Process', { imageUri: result.assets[0].uri });
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'Camera permission is needed to take worksheet photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    navigation.navigate('Process', { imageUri: result.assets[0].uri });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="leaf" size={24} color={colors.surface} />
          </View>
          <Text style={styles.appName}>Trellis</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Snap a Worksheet</Text>
          <Text style={styles.heroSubtitle}>
            Take a photo of any worksheet or textbook page to create an adapted
            version in seconds.
          </Text>
        </View>

        {/* Camera CTA */}
        <Pressable
          style={styles.cameraCta}
          onPress={handleTakePhoto}
        >
          <View style={styles.cameraIconCircle}>
            <Ionicons name="camera" size={32} color={colors.surface} />
          </View>
          <Text style={styles.cameraLabel}>Take a photo</Text>
        </Pressable>

        {/* Gallery CTA */}
        <Pressable
          style={styles.galleryCta}
          onPress={handleScanWorksheet}
        >
          <Ionicons name="images-outline" size={20} color={colors.primary} />
          <Text style={styles.galleryLabel}>Choose from library</Text>
        </Pressable>

        {/* Recent Worksheets */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recent Worksheets</Text>
          {recents.length === 0 ? (
            <Text style={styles.recentEmpty}>
              {Platform.OS === 'web'
                ? 'Recent worksheets are saved when you use the app on a device.'
                : 'Your uploaded worksheets will show up here.'}
            </Text>
          ) : (
            <View style={styles.recentList}>
              {recents.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.recentCard}
                  onPress={() =>
                    navigation.navigate('Process', { imageUri: item.imageUri })
                  }
                >
                  <View style={styles.thumbnail}>
                    {Platform.OS === 'web' ? (
                      <Ionicons
                        name="document-text"
                        size={24}
                        color={colors.textSecondary}
                      />
                    ) : (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.recentMeta}>
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.innerGapSmall,
    paddingBottom: spacing.innerGap,
    gap: spacing.innerGapSmall,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: radii.chip,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...typography.title,
    color: colors.textPrimary,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.sectionGapTop,
    paddingBottom: spacing.sectionGapBottom,
    gap: 16,
  },
  heroTitle: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 480,
  },

  // Camera CTA
  cameraCta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.answerCard,
    height: 200,
    gap: spacing.innerGapSmall,
    borderWidth: 2,
    borderColor: colors.surfaceMuted,
    borderStyle: 'dashed',
  },
  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.circle,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Gallery CTA
  galleryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
  },
  galleryLabel: {
    ...typography.bodySmall,
    color: colors.primary,
  },

  // Section
  section: {
    marginTop: spacing.sectionGapTop,
    gap: spacing.innerGap,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
  },

  // Recent list
  recentList: {
    gap: spacing.cardGap,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    gap: spacing.innerGap,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radii.thumbnail,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  recentEmpty: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingVertical: spacing.innerGapSmall,
  },
  recentInfo: {
    flex: 1,
    gap: spacing.innerGapSmall,
  },
  recentTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  recentMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
