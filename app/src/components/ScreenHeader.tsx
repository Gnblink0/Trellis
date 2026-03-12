import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../theme';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  showMenu?: boolean;
}

export default function ScreenHeader({
  title,
  showBack = true,
  showMenu = true,
}: ScreenHeaderProps) {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {showBack ? (
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {showMenu ? (
        <Pressable style={styles.iconBtn}>
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={colors.textPrimary}
          />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.navTitle,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
});
