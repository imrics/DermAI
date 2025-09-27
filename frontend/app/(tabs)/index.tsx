import React, { useMemo, useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CardTile from '@/components/CardTile';
import ReminderBanner from '@/components/Reminder';
import { AppGradient, CardColors, Fonts, spacing, TextColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getOverdueReminder, Reminder as ReminderType } from '@/app/lib/reminders';

type TileId = 'norwood' | 'skin' | 'moles';

type Tile = {
  id: TileId;
  title: string;
  subtitle: string;
  color: string;
  aliases: string[];
};

export default function HomeScreen() {
  const scheme = useColorScheme();
  const [query, setQuery] = useState<string>('');
  const [reminder, setReminder] = useState<ReminderType | null>(null);

  useEffect(() => {
    // TODO: this will later compute based on real data
    getOverdueReminder().then(setReminder).catch(() => setReminder(null));
  }, []);

  const tiles: Tile[] = useMemo(
    () => [
      {
        id: 'norwood',
        title: 'Norwood',
        subtitle: 'Last Updated',
        color: CardColors.norwood,
        aliases: ['norwood', 'hair', 'hairline', 'hair loss', 'alopecia'],
      },
      {
        id: 'skin',
        title: 'Skin',
        subtitle: 'Last Updated',
        color: CardColors.acne, // reuse token; rename to CardColors.skin if you added it
        aliases: ['skin', 'acne', 'pimples', 'face', 'acne vulgaris'],
      },
      {
        id: 'moles',
        title: 'Moles',
        subtitle: 'Last Updated',
        color: CardColors.moles,
        aliases: ['moles', 'mole', 'nevus', 'lesion'],
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tiles;
    return tiles.filter((t) =>
      [t.title.toLowerCase(), ...t.aliases].some((s) => s.includes(q))
    );
  }, [query, tiles]);

  const onPressTile = (id: TileId) => {
    // router.push(`/capture?condition=${id === 'skin' ? 'acne' : id}`)
  };

  // Build reminder message (uses mock days if provided)
  const reminderMessage =
    reminder &&
    `Reminder: Log your ${reminder.title} update${
      typeof reminder.lastUpdatedDays === 'number'
        ? ` — last update ${reminder.lastUpdatedDays} days ago.`
        : '.'
    }`;

  return (
    <LinearGradient colors={AppGradient[scheme ?? 'light']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/100' }}
              style={styles.avatar}
              accessibilityIgnoresInvertColors
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Hello,</Text>
              <Text style={styles.name}>Farhad 🫣</Text>
            </View>
            <View accessible accessibilityLabel="Menu" style={styles.menuDot} />
          </View>

          {/* Filter input */}
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Filter categories (e.g., Norwood, skin, moles)"
              placeholderTextColor="#9CA3AF"
              style={styles.search}
              accessibilityLabel="Filter categories"
              returnKeyType="done"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Reminder banner (shows only if reminder exists) */}
          {reminderMessage && (
            <View style={{ marginBottom: spacing(2) }}>
              <ReminderBanner
                message={reminderMessage}
                onPress={() => onPressTile(reminder!.id)}
              />
            </View>
          )}

          {/* Tiles grid with filtering */}
          <View style={styles.grid}>
            {filtered.map((tile) => (
              <View key={tile.id} style={styles.gridItem}>
                <CardTile
                  title={tile.title}
                  subtitle={tile.subtitle}
                  bg={tile.color}
                  onPress={() => onPressTile(tile.id)}
                  testID={`tile-${tile.id}`}
                />
              </View>
            ))}
            {filtered.length === 0 && (
              <Text style={styles.emptyText}>No categories match “{query}”.</Text>
            )}
          </View>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            This app provides educational information and progress tracking. It does not diagnose
            conditions. Please consult a licensed clinician for medical advice.
          </Text>
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
  menuDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: spacing(1),
  },

  searchWrap: { marginBottom: spacing(1.5) },
  search: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { flexBasis: '48%', maxWidth: '48%', marginTop: spacing(2) },

  emptyText: { marginTop: spacing(2), fontSize: 14, color: TextColors.secondary },

  disclaimer: { marginTop: spacing(3), fontSize: 12, color: TextColors.secondary, lineHeight: 16 },
});
