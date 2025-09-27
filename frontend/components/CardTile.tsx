import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Radii, spacing, TextColors } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  bg: string;
  onPress: () => void;
  testID?: string;
  icon?: React.ReactNode;
};

export default function CardTile({ title, subtitle, bg, onPress, testID, icon }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: bg, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    // ✅ Fill whatever width the parent gives us
    width: '100%',
    minHeight: 160,

    padding: spacing(2.5),
    borderRadius: Radii.lg,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },

    justifyContent: 'flex-start',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing(1.5),
  },
  title: { fontSize: 18, fontWeight: '800', color: TextColors.primary },
  subtitle: { marginTop: spacing(0.75), fontSize: 12, color: TextColors.secondary },
});
