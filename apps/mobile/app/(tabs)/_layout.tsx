import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text
      className={focused ? 'text-lg text-blue-700 dark:text-blue-400' : 'text-lg text-neutral-500'}
      accessibilityElementsHidden
    >
      {glyph}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarLabelStyle: { fontSize: 12 } }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon glyph="▦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="research"
        options={{
          title: 'Research',
          tabBarIcon: ({ focused }) => <TabIcon glyph="✎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⚙" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
