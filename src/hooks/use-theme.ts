/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Hook ini memilih tema warna berdasarkan sistem perangkat pengguna.
// Hanya mengembalikan `light` atau `dark` setelah rendering client untuk menghindari perbedaan SSR.
export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === 'unspecified' ? 'light' : scheme;

  return Colors[theme];
}
