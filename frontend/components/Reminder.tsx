import React from 'react';
import { Pressable, View, Text, StyleSheet, PressableStateCallbackType } from 'react-native';
import { Warning, Radii, spacing } from '@/constants/theme';

type Props = {
  message: string;
  onPress?: () => void; // optional CTA (e.g., go to capture screen)
};

export default function Reminder({ message, onPress }: Props) {
  const renderChildren = () => (
    <>
      <View style={styles.dot} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </>
  );

  if (onPress) {
    const pressableStyles = ({ pressed }: PressableStateCallbackType) => [
      styles.container,
      pressed ? styles.pressed : null,
    ];

    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Reminder"
        style={pressableStyles}
      >
        {renderChildren()}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel="Reminder" style={styles.container}>
      {renderChildren()}
    </View>
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
  },
  pressed: {
    opacity: 0.9,
  },
});
