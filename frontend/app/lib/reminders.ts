// TODO: Implement actual data lookup for last-updated timestamps.
// This file isolates the "what should we remind?" logic from the UI.

export type ConditionId = 'norwood' | 'skin' | 'moles';

export type Reminder = {
  id: ConditionId;
  title: string;
  // When implemented, fill with calculated days since last photo
  lastUpdatedDays?: number;
};

// For now, return a mock reminder so the UI renders.
// Later: read from storage, compute 30+ day gaps, return null if nothing overdue.
export async function getOverdueReminder(): Promise<Reminder | null> {
  // return null; // when you want to hide the banner
  return {
    id: 'moles',
    title: 'Moles',
    lastUpdatedDays: 45,
  };
}
