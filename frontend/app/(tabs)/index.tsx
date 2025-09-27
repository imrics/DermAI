import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, TextInput, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CardTile from '@/components/CardTile';
import { AppGradient, CardColors, Fonts, spacing, TextColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const scheme = useColorScheme();

  return (
    <LinearGradient colors={AppGradient[scheme ?? 'light']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/100' }}
              style={styles.avatar}
              accessibilityIgnoresInvertColors
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Hello,</Text>
              <Text style={styles.name}>Alicia Wins 👋</Text>
            </View>
            <View accessible accessibilityLabel="Menu" style={styles.menuDot} />
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <TextInput
              placeholder="Search for a doctor"
              placeholderTextColor="#9CA3AF"
              style={styles.search}
              accessibilityLabel="Search for a doctor"
              returnKeyType="search"
            />
          </View>

          {/* Primary tiles */}
          <View style={styles.tileRow}>
            <CardTile
              title="Norwood"
              subtitle="Track hairline"
              bg={CardColors.norwood}
              onPress={() => {/* navigation later: router.push('/capture?condition=norwood') */}}
              testID="tile-norwood"
            />
            <CardTile
              title="Acne"
              subtitle="Face progress"
              bg={CardColors.acne}
              onPress={() => {/* router.push('/capture?condition=acne') */}}
              testID="tile-acne"
            />
          </View>

          <View style={styles.tileRow}>
            <CardTile
              title="Moles"
              subtitle="Check changes"
              bg={CardColors.moles}
              onPress={() => {/* router.push('/capture?condition=mole') */}}
              testID="tile-moles"
            />
            <View style={{ width: '48%' }} />
          </View>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            This app provides educational information and progress tracking. It does not diagnose
            conditions. Please consult a licensed clinician for medical advice.
          </Text>

          {/* (Optional) Temporary link to a modal to prove routing still works */}
          <Link href="/modal" style={styles.hiddenLink} accessibilityLabel="Open modal">
            {/* invisible helper link for dev */}
          </Link>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(2) },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(2) },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: spacing(1.5) },
  hello: { fontSize: 16, color: TextColors.secondary, fontFamily: Fonts?.sans },
  name: { fontSize: 28, fontWeight: '800', color: TextColors.primary, fontFamily: Fonts?.rounded },
  menuDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: spacing(1) },

  searchWrap: { marginVertical: spacing(2) },
  search: {
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, height: 48,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },

  tileRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing(2) },

  disclaimer: { marginTop: spacing(3), fontSize: 12, color: TextColors.secondary, lineHeight: 16 },
  hiddenLink: { width: 1, height: 1, opacity: 0 },
});
