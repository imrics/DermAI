import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  Medication,
  MedicationCategory,
  MedicationCreatePayload,
  addMedication,
  deleteMedication,
  getMedications,
  updateMedication,
} from '@/lib/api';
import { useUser } from '@/hooks/use-user';
import { spacing, TextColors, Brand, Radii } from '@/constants/theme';

const CATEGORY_CONFIG: { id: MedicationCategory; label: string; tagline: string }[] = [
  { id: 'hairline', label: 'Norwood', tagline: 'Treatments and supplements for hair loss.' },
  { id: 'acne', label: 'Acne', tagline: 'Topicals, orals, and skincare routines.' },
  { id: 'mole', label: 'Moles', tagline: 'Dermatologist-directed monitoring plans.' },
];

type FormState = {
  name: string;
  dosage: string;
  frequency: string;
  notes: string;
  category: MedicationCategory;
};

const defaultFormState = (category: MedicationCategory): FormState => ({
  name: '',
  dosage: '',
  frequency: '',
  notes: '',
  category,
});

export default function MedicationsScreen() {
  const { user } = useUser();

  const [selectedCategory, setSelectedCategory] = useState<MedicationCategory>('hairline');
  const [medications, setMedications] = useState<Medication[]>([]);
  // Track counts per category so we know if ALL categories are empty, not just the current view
  const [categoryCounts, setCategoryCounts] = useState<Record<MedicationCategory, number>>({
    hairline: 0,
    acne: 0,
    mole: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formState, setFormState] = useState<FormState>(() => defaultFormState('hairline'));
  const [submitting, setSubmitting] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  const categoryTagline = useMemo(() => {
    return CATEGORY_CONFIG.find((item) => item.id === selectedCategory)?.tagline ?? '';
  }, [selectedCategory]);

  const fetchMedications = useCallback(async (category?: MedicationCategory) => {
    if (!user) return;
    const targetCategory = category ?? selectedCategory;
    try {
      const data = await getMedications(user.id, targetCategory);
      // Only update the visible list if this fetch corresponds to the currently selected category
      if (targetCategory === selectedCategory) {
        setMedications(data ?? []);
      }
      setCategoryCounts((prev) => ({ ...prev, [targetCategory]: (data ?? []).length }));
    } catch (error) {
      console.error('Failed to load medications', error);
      Alert.alert('Unable to load', 'Please check your connection and try again.');
    }
  }, [selectedCategory, user]);

  // Prefetch counts for all categories so we can determine global empty state
  const prefetchAllCategoryCounts = useCallback(async () => {
    if (!user) return;
    await Promise.all(
      CATEGORY_CONFIG.map(async (cfg) => {
        try {
          await fetchMedications(cfg.id);
        } catch {
          // ignore individual failures; fetchMedications already alerted/logged
        }
      })
    );
  }, [user, fetchMedications]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (!active) return;
        setLoading(true);
        // First load the selected category (updates list + count)
        await fetchMedications(selectedCategory);
        // Then (in background) prefetch the others for global empty state logic
        prefetchAllCategoryCounts();
        if (active) setLoading(false);
      };
      load();
      return () => {
        active = false;
      };
    }, [fetchMedications, prefetchAllCategoryCounts, selectedCategory]),
  );

  useEffect(() => {
    setFormState((prev) => ({ ...prev, category: selectedCategory }));
  }, [selectedCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  }, [fetchMedications]);

  const openForm = useCallback(
    (medication?: Medication) => {
      if (medication) {
        setEditingMedication(medication);
        setFormState({
          name: medication.name,
          dosage: medication.dosage ?? '',
          frequency: medication.frequency ?? '',
          notes: medication.notes ?? '',
          category: medication.category,
        });
      } else {
        setEditingMedication(null);
        setFormState(defaultFormState(selectedCategory));
      }
      setFormVisible(true);
    },
    [selectedCategory],
  );

  const closeForm = useCallback(() => {
    if (submitting) return;
    setFormVisible(false);
  }, [submitting]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!formState.name.trim()) {
      Alert.alert('Name required', 'Medication name is required.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingMedication) {
        const medicationId = editingMedication.medication_id || editingMedication.id || (editingMedication as any)._id;
        
        if (!medicationId || medicationId === 'undefined') {
          console.error('Invalid medication ID for update:', medicationId, 'Full medication object:', editingMedication);
          Alert.alert('Save failed', 'Invalid medication ID. Please refresh the page and try again.');
          return;
        }

        await updateMedication(medicationId, {
          name: formState.name.trim(),
          dosage: formState.dosage.trim() || undefined,
          frequency: formState.frequency.trim() || undefined,
          notes: formState.notes.trim() || undefined,
        });
        await fetchMedications(editingMedication.category); // updates list & count
      } else {
        const payload: MedicationCreatePayload = {
          category: formState.category,
          name: formState.name.trim(),
          dosage: formState.dosage.trim() || undefined,
          frequency: formState.frequency.trim() || undefined,
          notes: formState.notes.trim() || undefined,
        };
        await addMedication(user.id, payload);
        if (formState.category !== selectedCategory) {
          setSelectedCategory(formState.category);
        }
        await fetchMedications(formState.category); // updates list & count for new category
      }
      setFormVisible(false);
    } catch (error) {
      console.error('Failed to save medication', error);
      Alert.alert('Save failed', 'We could not save this medication. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [editingMedication, fetchMedications, formState, selectedCategory, user]);

  const handleDelete = useCallback(
    (medication: Medication) => {
      // Validate medication ID before attempting deletion
      const medicationId = medication.medication_id || medication.id || (medication as any)._id;
      
      if (!medicationId || medicationId === 'undefined') {
        console.error('Invalid medication ID:', medicationId, 'Full medication object:', medication);
        Alert.alert('Delete failed', 'Invalid medication ID. Please refresh the page and try again.');
        return;
      }

      const performDelete = async () => {
        try {
          await deleteMedication(medicationId);
          await fetchMedications(medication.category); // updates list & count
        } catch (error) {
          console.error('Failed to delete medication', error);
          Alert.alert('Delete failed', 'We could not delete this medication.');
        }
      };

      Alert.alert(
        'Remove medication',
        `Are you sure you want to remove ${medication.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ],
      );
    },
    [fetchMedications],
  );

  const openMedicationMenu = useCallback(
    (medication: Medication) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Edit', 'Delete'],
            cancelButtonIndex: 0,
            destructiveButtonIndex: 2,
          },
          (index) => {
            if (index === 1) openForm(medication);
            if (index === 2) handleDelete(medication);
          },
        );
      } else {
        Alert.alert(medication.name, undefined, [
          { text: 'Edit', onPress: () => openForm(medication) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(medication) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    [handleDelete, openForm],
  );

  const renderMedication = useCallback(
    ({ item }: { item: Medication }) => (
      <Pressable
        key={item.medication_id}
        style={({ pressed }) => [styles.medRow, pressed && styles.medRowPressed]}
        onPress={() => openMedicationMenu(item)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.medMeta}>
            {[item.dosage, item.frequency].filter(Boolean).join(' • ') || 'Custom schedule'}
          </Text>
          {item.notes ? (
            <Text style={styles.medNotes} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
        <Text style={styles.medAction}>⋯</Text>
      </Pressable>
    ),
    [openMedicationMenu],
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No medications tracked</Text>
      <Text style={styles.emptyCopy}>
        Add treatments, supplements, or prescriptions so DermAI can personalize your insights.
      </Text>
    </View>
  );

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={styles.title}>Medications</Text>
      <Text style={styles.subtitle}>{categoryTagline}</Text>

      <View style={styles.segmentedControl}>
        {CATEGORY_CONFIG.map((option) => {
          const active = option.id === selectedCategory;
          return (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.segmentButton,
                active && styles.segmentButtonActive,
                pressed && styles.segmentButtonPressed
              ]}
              onPress={() => {
                  setSelectedCategory(option.id);
                  fetchMedications(option.id);
                }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {option.label}
                </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed
        ]}
        onPress={() => openForm()}
      >
        <Text style={styles.primaryButtonText}>Add medication</Text>
      </Pressable>
    </View>
  );

  const allCategoriesEmpty = useMemo(
    () => Object.values(categoryCounts).every((count) => count === 0),
    [categoryCounts]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={medications}
        keyExtractor={(item) => item.medication_id}
        renderItem={renderMedication}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        contentContainerStyle={
          medications.length === 0
            ? (allCategoriesEmpty ? styles.emptyContent : styles.listContent)
            : styles.listContent
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      {loading && medications.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForm}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={closeForm}
              disabled={submitting}
              style={({ pressed }) => [
                styles.modalButton,
                pressed && styles.modalButtonPressed
              ]}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {editingMedication
                ? 'Edit medication'
                : (() => {
                    const label = CATEGORY_CONFIG.find(c => c.id === formState.category)?.label;
                    return label ? `Add ${label} medication` : 'Add medication';
                  })()}
            </Text>
            <Pressable
              onPress={handleSave}
              disabled={submitting}
              style={({ pressed }) => [
                styles.modalButton,
                pressed && styles.modalButtonPressed
              ]}
            >
              {submitting ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Category now conveyed in the header title when creating a new medication */}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.modalForm}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalLabel}>Medication name</Text>
            <TextInput
              value={formState.name}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, name: value }))}
              placeholder="e.g., Minoxidil 5%"
              style={styles.input}
              autoFocus
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Dosage</Text>
            <TextInput
              value={formState.dosage}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, dosage: value }))}
              placeholder="e.g., 2 mL nightly"
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Frequency</Text>
            <TextInput
              value={formState.frequency}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, frequency: value }))}
              placeholder="e.g., Twice daily"
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              value={formState.notes}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, notes: value }))}
              placeholder="Add context that will appear alongside AI insights."
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={4}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' }, // iOS system background
  headerBlock: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(2),
    paddingBottom: spacing(3),
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  subtitle: {
    fontSize: 15,
    color: TextColors.secondary,
    marginBottom: spacing(3),
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(120, 120, 128, 0.16)',
    borderRadius: 24, // Much more rounded for iOS 26
    padding: 3,
    marginBottom: spacing(2),
  },

  segmentButton: {
    flex: 1,
    borderRadius: 21, // Very rounded to match container
    paddingVertical: spacing(1.25),
    alignItems: 'center',
  },

  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentButtonPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.98 }],
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000',
  },
  segmentTextActive: {
    color: '#000',
    fontWeight: '600',
  },

  primaryButton: {
    backgroundColor: Brand.purple,
    borderRadius: 25, // Very rounded iOS 26 button
    paddingVertical: spacing(1.75),
    paddingHorizontal: spacing(2),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
    minHeight: 50,
  shadowColor: Brand.purple,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: spacing(6),
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(3),
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    marginHorizontal: spacing(2),
    marginBottom: spacing(1.5),
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  medRowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  medName: {
    fontSize: 17,
    fontWeight: '600', // iOS 26 semibold
    color: TextColors.primary,
  },
  medMeta: {
    fontSize: 13,
    color: TextColors.secondary,
    marginTop: spacing(0.25),
  },
  medNotes: {
    fontSize: 13,
    color: TextColors.secondary,
    marginTop: spacing(0.5),
  },
  medAction: {
    fontSize: 22,
    color: '#8E8E93', // iOS system gray3
    paddingHorizontal: spacing(1),
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing(3),
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  emptyCopy: {
    fontSize: 14,
    color: TextColors.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing(2),
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 242, 247, 0.8)', // Updated for iOS system
  },
  modalContainer: { 
    flex: 1, 
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20, // Rounded top corners for sheet presentation
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0, // Remove separator for cleaner look
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TextColors.primary,
  },
  modalButton: {
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
    borderRadius: 18, // More rounded modal buttons
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPressed: {
    opacity: 0.4,
    transform: [{ scale: 0.95 }],
  },
  modalCancel: {
    fontSize: 16,
    color: Brand.purple, // Purple brand color
  },
  modalSave: {
    fontSize: 16,
    color: Brand.purple,
    fontWeight: '400', // Non-bold
  },
  modalForm: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(1),
    paddingBottom: spacing(4),
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TextColors.secondary,
    marginTop: spacing(2),
    marginBottom: spacing(0.75),
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28, // Extra pill-style roundness like iOS 26 search fields
    paddingHorizontal: spacing(2.25),
    paddingVertical: spacing(1.25),
    fontSize: 15,
    color: TextColors.primary,
    borderWidth: 0,
    minHeight: 50,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  inputMultiline: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: spacing(1.25),
  },
  // (category styles removed – category now part of modal header title)
});
