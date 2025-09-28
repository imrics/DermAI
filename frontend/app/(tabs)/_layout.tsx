import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
      <Label>Home</Label>
        <Icon sf={"house.fill"}></Icon>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="medications">
      <Label>Medications</Label>
        <Icon sf={"pills.fill"}></Icon>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="export">
      <Label>Export</Label>
        <Icon sf={"square.and.arrow.up"}></Icon>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
