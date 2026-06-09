import { Slot } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: require('@/assets/images/tabIcons/home-default.png'),
            selected: require('@/assets/images/tabIcons/home-selected.png')
          }}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="achievements">
        <NativeTabs.Trigger.Label>Achievements</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: require('@/assets/images/tabIcons/achievements-default.png'),
            selected: require('@/assets/images/tabIcons/achievements-selected.png')
          }}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Label>Leaderboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: require('@/assets/images/tabIcons/leaderboard-default.png'),
            selected: require('@/assets/images/tabIcons/leaderboard-selected.png')
          }}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: require('@/assets/images/tabIcons/history-default.png'),
            selected: require('@/assets/images/tabIcons/history-selected.png')
          }}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: require('@/assets/images/tabIcons/profile-default.png'),
            selected: require('@/assets/images/tabIcons/profile-selected.png')
          }}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <Slot />
    </NativeTabs>
    
  );
}
