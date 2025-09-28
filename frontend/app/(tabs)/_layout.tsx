import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor="#1D4ED8" // Selected tab color for both icons and labels
    >
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon sf="house.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="medications">
        <Label>Medications</Label>
        <Icon sf="pills.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="export">
        <Label>Export</Label>
        <Icon sf="square.and.arrow.up" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
