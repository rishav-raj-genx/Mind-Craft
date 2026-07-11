import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const colors = {
  lime: '#D9FF7A',
  purple: '#9B7BFF',
  ink: '#201A2E',
  muted: '#81788F',
  shell: '#FFF9F1',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 78,
          paddingTop: 10,
          paddingBottom: 16,
          backgroundColor: colors.shell,
          borderTopWidth: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18, fontWeight: '900' }}>H</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="find"
        options={{
          title: 'Find',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18, fontWeight: '900' }}>F</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          title: 'Forum',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18, fontWeight: '900' }}>Q</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18, fontWeight: '900' }}>P</Text>
          ),
        }}
      />
    </Tabs>
  );
}
