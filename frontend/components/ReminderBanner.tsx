import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Warning, Radii, spacing } from '@/constants/theme';

type Props = {
  message: string;
  onPress?: () => void;
};

export default function ReminderBanner({ message, onPress }: Props) {
  const Wrapper: any = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel="Reminder"
      style={({ pressed }: any) => [
        styles.container,
        onPress && pressed ? { opacity: 0.9 } : null,
      ]}
    >
      {/* Transparent background; icon only */}
      <Ionicons
        name="camera-outline"
        size={20}
        color={Warning.text}
        accessibilityLabel="Camera"
        style={styles.icon}
      />

      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(2),
    borderRadius: Radii.md,
    backgroundColor: Warning.bg,
    borderWidth: 1,
    borderColor: Warning.border,
  },
  icon: {
    marginRight: spacing(1.5),
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: Warning.text,
    fontWeight: '600',
  },
});
