import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Warning, Radii, spacing, TextColors } from '@/constants/theme';

type Props = {
  message: string;
  onPress?: () => void; // optional CTA (e.g., go to capture screen)
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
      <View style={styles.dot} />
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
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Warning.text,
    marginRight: spacing(1.5),
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: Warning.text,
    // keep typography consistent with app
    // (falls back to system if Fonts not set)
    // fontFamily: Fonts?.sans,
  },
});
