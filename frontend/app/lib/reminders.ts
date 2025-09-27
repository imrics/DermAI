// TODO: Implement actual data lookup for last-updated timestamps.

export type ConditionId = 'norwood' | 'skin' | 'moles';

export type Reminder = {
  id: ConditionId;
  title: string;
  // When implemented, fill with calculated days since last photo
  lastUpdatedDays?: number;
};

export async function getOverdueReminder(): Promise<Reminder | null> {
  return {
    id: 'moles',
    title: 'Moles',
    lastUpdatedDays: 45,
  };
}
