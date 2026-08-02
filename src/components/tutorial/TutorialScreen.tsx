import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type TutorialScreenProps = {
  onComplete?: () => void;
  onSkip?: () => void;
};

const COLORS = {
  bg: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
  green: '#22C55E',
  blue: '#3B82F6',
  orange: '#F59E0B',
  purple: '#8B5CF6',
  white: '#FFFFFF',
};

const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

const tutorialSteps = [
  {
    headline: 'Selamat Datang 👋',
    title: 'Mulai perjalanan membangun kebiasaan baik',
    description:
      'Perubahan besar selalu dimulai dari langkah kecil. Habit Tracker akan membantumu tetap konsisten menjalankan kebiasaan positif setiap hari.',
    bullets: [
      'Lihat semua target harianmu di satu tempat',
      'Bangun rutinitas yang lebih teratur',
      'Pantau perkembanganmu setiap hari',
      'Mulai kebiasaan baik dengan lebih mudah',
    ],
    accent: COLORS.blue,
    icon: 'home' as const,
  },

  {
    headline: 'Timed Habit ⏱️',
    title: 'Fokus pada satu sesi',
    description:
      'Beberapa aktivitas lebih mudah dilakukan jika memiliki batas waktu. Gunakan Timed Habit untuk membantu menjaga fokus sampai sesi selesai.',
    bullets: [
      '📚 Belajar selama 45 menit',
      '🏃 Berolahraga selama 20 menit',
      '🧘 Meditasi selama 10 menit',
      'Selesaikan sesi untuk mendapatkan poin',
    ],
    accent: COLORS.green,
    icon: 'time' as const,
  },

  {
    headline: 'Progress Habit 📈',
    title: 'Sedikit demi sedikit, pasti selesai',
    description:
      'Tidak semua target harus selesai sekaligus. Catat setiap kemajuanmu hingga target hari itu tercapai.',
    bullets: [
      '💧 Minum air 8 gelas sehari',
      '📖 Membaca 20 halaman buku',
      '✍️ Menyelesaikan 20 soal latihan',
      'Perbarui progres setiap kali ada kemajuan',
    ],
    accent: COLORS.orange,
    icon: 'bar-chart' as const,
  },

  {
    headline: 'Achievement 🏆',
    title: 'Rayakan setiap pencapaianmu',
    description:
      'Setiap kebiasaan yang berhasil diselesaikan akan membawamu lebih dekat ke berbagai pencapaian. Pertahankan streak dan lihat posisimu di leaderboard.',
    bullets: [
      '🔥 Pertahankan streak setiap hari',
      '🏅 Kumpulkan achievement yang tersedia',
      '🏆 Naikkan peringkat di leaderboard',
      'Nikmati setiap perkembangan yang berhasil kamu capai',
    ],
    accent: COLORS.purple,
    icon: 'trophy' as const,
  },

  {
    headline: 'Siap Memulai 🚀',
    title: 'Perjalananmu dimulai sekarang',
    description:
      'Semua progres, level, dan statistikmu akan tersimpan di halaman Profile. Tetap konsisten, nikmati prosesnya, dan lihat perubahan kecil yang kamu bangun setiap hari.',
    bullets: [
      '⭐ Pantau level dan total poin',
      '📊 Lihat perkembangan kebiasaanmu',
      '👤 Kelola akun dengan mudah',
      'Yuk, mulai bangun kebiasaan positif hari ini!',
    ],
    accent: COLORS.green,
    icon: 'person' as const,
  },
];

const ProgressDot = memo(({ active }: { active: boolean }) => (
  <View style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />
));

const StepIcon = memo(({ icon, accent }: { icon: keyof typeof Ionicons.glyphMap; accent: string }) => (
  <View style={[styles.iconBadge, { backgroundColor: `${accent}14` }]}> 
    <Ionicons name={icon} size={24} color={accent} />
  </View>
));

export function TutorialScreen({ onComplete, onSkip }: TutorialScreenProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const progress = useSharedValue(0);

  const currentStep = tutorialSteps[activeStep];
  const isLastStep = activeStep === tutorialSteps.length - 1;

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled).catch(() => setIsScreenReaderEnabled(false));
  }, []);

  useEffect(() => {
    progress.value = withTiming((activeStep + 1) / tutorialSteps.length, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [activeStep, progress]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
  }));

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
      return;
    }

    setActiveStep((prev) => prev + 1);
  };

  const heroTitle = useMemo(() => (activeStep === tutorialSteps.length - 1 ? 'Sekarang kamu siap menjelajahi seluruh aplikasi' : 'Pilih habit yang tepat untukmu'), [activeStep]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <LinearGradient
          colors={['#0F172A', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroDecor}>
            <View style={[styles.orb, styles.orbOne]} />
            <View style={[styles.orb, styles.orbTwo]} />
            <View style={[styles.orb, styles.orbThree]} />
          </View>

          <View style={styles.heroTopRow}>
            <View style={styles.appIconWrap}>
              <Ionicons name="leaf" size={22} color={COLORS.white} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Lewati tutorial" onPress={onSkip} style={styles.skipButton}>
              <Text style={styles.skipButtonText}>Lewati</Text>
            </Pressable>
          </View>

          <Animated.View entering={FadeIn.duration(280)} exiting={FadeOut.duration(220)} style={styles.heroContent}>
            <Text style={styles.eyebrow}>Panduan Habit Tracker</Text>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroSubtitle}>
              {activeStep === tutorialSteps.length - 1
                ? 'Kenali layar Home, leaderboard, pencapaian, dan profile supaya kamu lebih nyaman menggunakan aplikasi setiap hari.'
                : 'Pelajari perbedaan habit timed dan progress, lalu pilih contoh target yang paling cocok dengan rutinitasmu.'}
            </Text>

            <View style={styles.progressWrap}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Langkah {activeStep + 1} dari {tutorialSteps.length}</Text>
                <Text style={styles.progressPercent}>{Math.round(((activeStep + 1) / tutorialSteps.length) * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, animatedProgressStyle]} />
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={FadeIn.duration(320)}
            exiting={FadeOut.duration(220)}
            style={styles.card}
            accessibilityRole="summary"
          >
            <StepIcon icon={currentStep.icon} accent={currentStep.accent} />
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: `${currentStep.accent}14` }] }>
                <Text style={[styles.badgeText, { color: currentStep.accent }]}>{currentStep.headline}</Text>
              </View>
            </View>

            <Text style={styles.stepTitle}>{currentStep.title}</Text>
            <Text style={styles.stepDescription}>{currentStep.description}</Text>

            <View style={styles.bullets}>
              {currentStep.bullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <View style={[styles.bulletIconWrap, { backgroundColor: `${currentStep.accent}14` }] }>
                    <Ionicons name="checkmark" size={12} color={currentStep.accent} />
                  </View>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dotsRow}>
            {tutorialSteps.map((step, index) => (
              <ProgressDot key={step.title} active={index === activeStep} />
            ))}
          </View>

          <View style={styles.footerActions}>
            {activeStep > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Kembali ke langkah sebelumnya" onPress={() => setActiveStep((prev) => prev - 1)} style={styles.ghostButton}>
                <Ionicons name="arrow-back" size={16} color={COLORS.textPrimary} />
                <Text style={styles.ghostButtonText}>Kembali</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLastStep ? 'Mulai menggunakan aplikasi' : 'Lanjut ke langkah berikutnya'}
              onPress={handleNext}
              style={styles.primaryButton}
            >
              <LinearGradient
                colors={isLastStep ? [COLORS.green, '#16A34A'] : [COLORS.blue, '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>{isLastStep ? '🚀 Mulai Sekarang' : 'Lanjut'}</Text>
                {!isLastStep ? <Ionicons name="arrow-forward" size={16} color={COLORS.white} /> : null}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  hero: {
    paddingHorizontal: SPACING.xl,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroDecor: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.16,
  },
  orbOne: {
    width: 148,
    height: 148,
    backgroundColor: COLORS.green,
    top: -28,
    right: -34,
  },
  orbTwo: {
    width: 96,
    height: 96,
    backgroundColor: COLORS.blue,
    bottom: 24,
    left: -18,
  },
  orbThree: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.orange,
    top: 86,
    left: 140,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  appIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    minHeight: 44,
    justifyContent: 'center',
  },
  skipButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  heroContent: {
    gap: 8,
  },
  eyebrow: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#DDE7F2',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 520,
  },
  progressWrap: {
    marginTop: 4,
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercent: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.green,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: 4,
    paddingBottom: SPACING.xl,
  },
  card: {
    marginTop: -8,
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  badgeRow: {
    marginBottom: SPACING.md,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  stepDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  bullets: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: COLORS.green,
    width: 22,
  },
  dotInactive: {
    backgroundColor: '#CBD5E1',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  ghostButton: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ghostButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    overflow: 'hidden',
    flexShrink: 1,
  },
  primaryButtonGradient: {
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
