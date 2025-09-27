import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import CardTile from '@/components/CardTile';
import ReminderBanner from '@/components/Reminder';
import {
  AppGradient,
  CardColors,
  Fonts,
  spacing,
  TextColors,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUser } from '@/hooks/use-user';
import { EntrySummary, getEntries, getEntryTypeSlug } from '@/lib/api';
import { getOverdueReminder, Reminder as ReminderType } from '@/lib/reminders';

type TileId = 'norwood' | 'skin' | 'moles';

type Tile = {
  id: TileId;
  title: string;
  description: string;
  color: string;
  aliases: string[];
};

type ConditionSummary = {
  isLoading: boolean;
  lastUpdatedLabel: string;
  entries: EntrySummary[];
};

const buildDefaultSummary = (): ConditionSummary => ({
  isLoading: false,
  lastUpdatedLabel: 'No entries yet',
  entries: [],
});

function getFirstName(fullName: string) {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

function formatDateForTile(timestamp?: string) {
  if (!timestamp) return 'No entries yet';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'No entries yet';

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `Last entry • ${formatter.format(date)}`;
}

export default function HomeScreen() {
  const scheme = useColorScheme();
  const router = useRouter();
  const { user } = useUser();

  const [query, setQuery] = useState('');
  const [reminder, setReminder] = useState<ReminderType | null>(null);
  const [summaries, setSummaries] = useState<Record<TileId, ConditionSummary>>({
    norwood: buildDefaultSummary(),
    skin: buildDefaultSummary(),
    moles: buildDefaultSummary(),
  });

  const tiles: Tile[] = useMemo(
    () => [
      {
        id: 'norwood',
        title: 'Norwood',
        description: 'Track your hairline progression and Norwood stage.',
        color: CardColors.norwood,
        aliases: ['norwood', 'hair', 'hairline', 'hair loss', 'alopecia'],
      },
      {
        id: 'skin',
        title: 'Skin',
        description: 'Monitor breakouts, routines, and AI guidance.',
        color: CardColors.acne,
        aliases: ['skin', 'acne', 'pimples', 'face', 'acne vulgaris'],
      },
      {
        id: 'moles',
        title: 'Moles',
        description: 'Keep tabs on moles and changes over time.',
        color: CardColors.moles,
        aliases: ['moles', 'mole', 'nevus', 'lesion'],
      },
    ],
    [],
  );

  const filteredTiles = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return tiles;
    return tiles.filter((tile) =>
      [tile.title.toLowerCase(), ...tile.aliases].some((alias) => alias.includes(search)),
    );
  }, [query, tiles]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        if (!user) return;
        try {
          setSummaries((prev) => ({
            norwood: { ...prev.norwood, isLoading: true },
            skin: { ...prev.skin, isLoading: true },
            moles: { ...prev.moles, isLoading: true },
          }));

          const results = await Promise.all(
            tiles.map(async (tile) => {
              const entryType = getEntryTypeSlug(tile.id);
              const entries = await getEntries(user.id, entryType);
              const sortedEntries = Array.isArray(entries)
                ? [...entries].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                  )
                : [];
              const lastEntry = sortedEntries[0];
              return {
                id: tile.id,
                entries: sortedEntries,
                label: formatDateForTile(lastEntry?.created_at),
              };
            }),
          );

          if (!isActive) return;

          setSummaries((prev) => {
            const next = { ...prev } as Record<TileId, ConditionSummary>;
            results.forEach((result) => {
              next[result.id as TileId] = {
                isLoading: false,
                lastUpdatedLabel: result.label || 'No entries yet',
                entries: result.entries,
              };
            });
            return next;
          });
        } catch (error) {
          console.warn('Failed to load home data', error);
          if (!isActive) return;
          setSummaries({
            norwood: buildDefaultSummary(),
            skin: buildDefaultSummary(),
            moles: buildDefaultSummary(),
          });
        }
      };

      const loadReminder = async () => {
        try {
          const data = await getOverdueReminder();
          if (isActive) setReminder(data);
        } catch {
          if (isActive) setReminder(null);
        }
      };

      loadData();
      loadReminder();

      return () => {
        isActive = false;
      };
    }, [tiles, user]),
  );

  const handlePressTile = (id: TileId) => {
    router.push(`/entries/${id}`);
  };

  const reminderMessage = reminder
    ? `Reminder: Check in on your ${reminder.title} — it’s been ${
        typeof reminder.lastUpdatedDays === 'number' ? reminder.lastUpdatedDays : 'a few'
      } days.`
    : null;

  return (
    <LinearGradient colors={AppGradient[scheme ?? 'light']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{getFirstName(user?.name ?? '').charAt(0) || 'D'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Good day,</Text>
              <Text style={styles.name}>{getFirstName(user?.name ?? 'DermAI')}</Text>
            </View>
            <View accessible accessibilityLabel="Profile" style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>Demo</Text>
            </View>
          </View>

          <Text style={styles.headline}>Where should we focus today?</Text>

          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search categories (Norwood, Acne, Moles...)"
              placeholderTextColor="#9CA3AF"
              style={styles.search}
              accessibilityLabel="Search condition categories"
              returnKeyType="search"
            />
          </View>

          {reminderMessage && reminder && (
            <View style={styles.reminderWrap}>
              <ReminderBanner message={reminderMessage} onPress={() => handlePressTile(reminder.id)} />
            </View>
          )}

          <View style={styles.grid}>
            {filteredTiles.map((tile, index) => {
              const summary = summaries[tile.id];
              return (
                <View
                  key={tile.id}
                  style={[styles.gridItem, index < 2 && styles.gridItemFirstRow]}
                >
                  <CardTile
                    title={tile.title}
                    subtitle={summary?.lastUpdatedLabel ?? 'No entries yet'}
                    bg={tile.color}
                    onPress={() => handlePressTile(tile.id)}
                    testID={`tile-${tile.id}`}
                  />
                  <Text style={styles.tileDescription}>{tile.description}</Text>
                  {summary?.isLoading && (
                    <View style={styles.tileSpinner}>
                      <ActivityIndicator size="small" color={TextColors.secondary} />
                    </View>
                  )}
                </View>
              );
            })}
            {filteredTiles.length === 0 && (
              <Text style={styles.emptyText}>No categories match “{query}”.</Text>
            )}
          </View>

          <Text style={styles.disclaimer}>
            DermAI helps you document and monitor skin changes. Always consult a licensed clinician
            for personal medical advice.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(2) },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(3) },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(79,70,229,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(1.5),
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4F46E5',
  },
  hello: { fontSize: 15, color: TextColors.secondary, fontFamily: Fonts?.sans },
  name: { fontSize: 30, fontWeight: '800', color: TextColors.primary, fontFamily: Fonts?.rounded },
  profileBadge: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 18,
    fontWeight: '600',
    color: TextColors.primary,
    marginBottom: spacing(2),
  },
  searchWrap: { marginBottom: spacing(2) },
  search: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: spacing(2),
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  reminderWrap: { marginBottom: spacing(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { flexBasis: '48%', maxWidth: '48%', marginBottom: spacing(3), position: 'relative' },
  gridItemFirstRow: { marginTop: 0 },
  tileDescription: {
    marginTop: spacing(1),
    fontSize: 13,
    color: TextColors.secondary,
    lineHeight: 18,
  },
  tileSpinner: {
    position: 'absolute',
    top: spacing(1),
    right: spacing(1),
  },
  emptyText: { marginTop: spacing(2), fontSize: 14, color: TextColors.secondary },
  disclaimer: {
    marginTop: spacing(1),
    fontSize: 12,
    color: TextColors.secondary,
    lineHeight: 16,
  },
});
