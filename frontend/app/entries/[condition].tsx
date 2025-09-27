import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  ListRenderItemInfo,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SwipeListView } from 'react-native-swipe-list-view';

import {
  CreateEntryPayload,
  EntrySummary,
  EntryType,
  createEntry,
  deleteEntry,
  getEntries,
  getEntryTypeSlug,
  getImageUrl,
} from '@/lib/api';
import { useUser } from '@/hooks/use-user';
import { spacing, TextColors } from '@/constants/theme';

const CONDITION_MAP: Record<string, { title: string; entryType: EntryType; subtitle: string }> = {
  norwood: {
    title: 'Norwood Entries',
    entryType: 'hairline',
    subtitle: 'Compare your hairline photos and AI guidance.',
  },
  skin: {
    title: 'Acne Entries',
    entryType: 'acne',
    subtitle: 'Track flare-ups, treatments, and improvements.',
  },
  moles: {
    title: 'Mole Entries',
    entryType: 'mole',
    subtitle: 'Monitor suspicious moles and dermatologist notes.',
  },
};

function formatListDate(timestamp: string) {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return formatter.format(date);
}

function getEntryPreview(entry: EntrySummary) {
  return (
    entry.summary ||
    entry.ai_summary ||
    entry.user_notes ||
    entry.user_concerns ||
    'Tap to review AI analysis, notes, and medications.'
  );
}

export default function ConditionEntriesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useUser();
  const params = useLocalSearchParams<{ condition?: string }>();

  const conditionKey = (params.condition ?? '').toLowerCase();
  const conditionConfig = CONDITION_MAP[conditionKey];
  const entryType = useMemo(() => (conditionKey ? getEntryTypeSlug(conditionKey as any) : null), [conditionKey]);

  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isValidCondition = !!conditionConfig && !!entryType;

  const fetchEntries = useCallback(async () => {
    if (!user || !entryType) return;
    try {
      const data = await getEntries(user.id, entryType);
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setEntries(sorted);
    } catch (error) {
      console.error('Failed to load entries', error);
      Alert.alert('Unable to load entries', 'Please check your connection and try again.');
    }
  }, [entryType, user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (!active) return;
        setLoading(true);
        await fetchEntries();
        if (active) {
          setLoading(false);
        }
      };
      load();
      return () => {
        active = false;
      };
    }, [fetchEntries]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  }, [fetchEntries]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  }, [navigation, router]);

  const openPicker = useCallback(
    async (mode: 'camera' | 'library') => {
      if (!user || !entryType) return;
      try {
        setUploading(true);

        const pickAsync =
          mode === 'camera'
            ? ImagePicker.launchCameraAsync
            : ImagePicker.launchImageLibraryAsync;

        if (mode === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== ImagePicker.PermissionStatus.GRANTED) {
            Alert.alert('Camera access needed', 'Please allow camera access to capture a new entry.');
            setUploading(false);
            return;
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== ImagePicker.PermissionStatus.GRANTED) {
            Alert.alert(
              'Photo library access needed',
              'Please allow media access to upload a new entry.',
            );
            setUploading(false);
            return;
          }
        }

        const result = await pickAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.85,
        });

        if (result.canceled) {
          setUploading(false);
          return;
        }

        const asset = result.assets?.[0];
        if (!asset) {
          setUploading(false);
          return;
        }

        const payload: CreateEntryPayload = {
          photo: {
            uri: asset.uri,
            name: asset.fileName ?? `entry-${Date.now()}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          },
        };

        const entry = await createEntry(user.id, entryType, payload);
        await fetchEntries();

        const entryId = entry.entry_id;
        if (entryId) {
          router.push({
            pathname: '/entries/[condition]/[entryId]',
            params: { condition: conditionKey, entryId },
          });
        }
      } catch (error) {
        console.error('Failed to create entry', error);
        Alert.alert('Upload failed', 'We could not create the entry. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [conditionKey, entryType, fetchEntries, router, user],
  );

  const handleNewEntry = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) openPicker('camera');
          if (index === 2) openPicker('library');
        },
      );
    } else {
      Alert.alert('New entry', 'Pick a source', [
        { text: 'Camera', onPress: () => openPicker('camera') },
        { text: 'Photo Library', onPress: () => openPicker('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [openPicker]);

  useLayoutEffect(() => {
    if (!isValidCondition) return;
    navigation.setOptions({
      title: conditionConfig.title,
      headerBackTitle: 'Home',
      headerBackTitleVisible: true,
      headerLeft: () => (
        <TouchableOpacity style={styles.headerBack} onPress={handleBack}>
          <Ionicons name="chevron-back" size={18} color={TextColors.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleNewEntry}
          disabled={uploading}
          style={[styles.headerIconButton, uploading && styles.headerButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Add entry"
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="add" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      ),
    });
  }, [conditionConfig, handleBack, handleNewEntry, isValidCondition, navigation, uploading]);

  const handleDeleteEntry = useCallback(
    async (entry: EntrySummary) => {
      Alert.alert(
        'Delete entry',
        'This entry and its analysis will be removed. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteEntry(entry.entry_id);
                await fetchEntries();
              } catch (error) {
                console.error('Failed to delete entry', error);
                Alert.alert('Unable to delete entry', 'Please try again.');
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [fetchEntries],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<EntrySummary>) => {
      const imageUri = getImageUrl(item.image_id) || item.photo_url || (item as any).photoUrl;
      const entryId = item.entry_id;
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            entryId &&
            router.push({
              pathname: '/entries/[condition]/[entryId]',
              params: { condition: conditionKey, entryId },
            })
          }
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{formatListDate(item.created_at)}</Text>
            <Text style={styles.rowSubtitle} numberOfLines={2}>
              {getEntryPreview(item)}
            </Text>
          </View>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Text style={styles.thumbnailPlaceholderText}>No Photo</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [conditionKey, router],
  );

  const renderHiddenItem = useCallback(
    (data: ListRenderItemInfo<EntrySummary>) => (
      <View style={styles.hiddenRow}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteEntry(data.item)}
        >
          <Ionicons name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    ),
    [handleDeleteEntry],
  );

  if (!isValidCondition) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>This condition is not supported.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <SwipeListView
        data={entries}
        keyExtractor={(item, index) => String(item.entry_id ?? `entry-${conditionKey}-${index}`)}
        renderItem={renderItem as any}
        renderHiddenItem={renderHiddenItem as any}
        rightOpenValue={-88}
        disableRightSwipe
        contentContainerStyle={entries.length === 0 && !loading ? styles.emptyContainer : styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={styles.listHeadline}>{conditionConfig.subtitle}</Text>
          </View>
        )}
        ListEmptyComponent={
          !loading
            ? () => (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No Entries Yet</Text>
                  <Text style={styles.emptyCopy}>
                    Create your first entry to unlock AI analysis, track medication changes, and
                    monitor your progress over time.
                  </Text>
                </View>
              )
            : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
        showsVerticalScrollIndicator={false}
      />
      {loading && entries.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing(2),
    paddingBottom: spacing(6),
  },
  listHeader: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(2),
    paddingBottom: spacing(3),
  },
  listHeadline: {
    fontSize: 16,
    color: TextColors.secondary,
    lineHeight: 22,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: spacing(2),
    marginRight: spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    backgroundColor: '#fff',
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(0.75),
  },
  rowSubtitle: {
    fontSize: 13,
    color: TextColors.secondary,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginLeft: spacing(2),
    backgroundColor: '#E5E7EB',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 11,
    color: TextColors.secondary,
  },
  hiddenRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing(2),
    flex: 1,
    backgroundColor: 'transparent',
  },
  deleteButton: {
    width: 64,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerButtonDisabled: {
    opacity: 0.6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing(3),
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  emptyCopy: {
    fontSize: 14,
    color: TextColors.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(4) },
  errorText: { fontSize: 16, color: '#B91C1C', textAlign: 'center' },
});
