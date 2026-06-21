import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TabTwoScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">Jelajah Ide</ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            Temukan inspirasi habit, tips perencanaan, dan rutinitas sederhana untuk membantu kamu tetap konsisten.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.sectionsWrapper}>
          <Collapsible title="Mengapa habit kecil menang">
            <ThemedText type="small">
              Tindakan kecil setiap hari lebih mudah dipertahankan dan membangun momentum lebih cepat daripada tujuan besar.
            </ThemedText>
          </Collapsible>

          <Collapsible title="Ide habit untuk dicoba">
            <View style={styles.ideaList}>
              <ThemedText type="small">• Peregangan pagi</ThemedText>
              <ThemedText type="small">• Baca 10 halaman</ThemedText>
              <ThemedText type="small">• Minum segelas air</ThemedText>
            </View>
          </Collapsible>

          <Collapsible title="Tips konsistensi">
            <ThemedText type="small">
              Buat habitmu sederhana, lacak progres setiap hari, dan beri hadiah untuk kemenangan kecil.
            </ThemedText>
          </Collapsible>

          <ExternalLink href="https://docs.expo.dev" asChild>
            <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.linkButtonInner}>
                <ThemedText type="link">Pelajari strategi habit</ThemedText>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'arrow.up.right.square', android: 'link', web: 'link' }}
                  size={12}
                />
              </ThemedView>
            </Pressable>
          </ExternalLink>
        </ThemedView>
        {Platform.OS === 'web' && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    alignItems: 'center',
  },
  linkButtonInner: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: 'center',
    gap: Spacing.one,
    alignItems: 'center',
  },
  sectionsWrapper: {
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  ideaList: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
