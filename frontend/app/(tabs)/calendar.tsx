import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';

export default function CalendarScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.center}>
        <Text style={styles.text}>Calendar (coming soon)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, opacity: 0.6 },
});
