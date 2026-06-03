import { AppState } from 'react-native';

let backgroundTime: number | null = null;

export const startAntiCheat = (
  onFail: () => void
) => {

  AppState.addEventListener(
    'change',
    (state) => {

      if (state === 'background') {
        backgroundTime = Date.now();
      }

      if (
        state === 'active' &&
        backgroundTime
      ) {

        const diff =
          (Date.now() - backgroundTime) / 1000;

        if (diff > 30) {
          onFail();
        }

      }

    }
  );

};