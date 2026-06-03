import React, { useState } from 'react';
import { Modal, View } from 'react-native';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';

type Props = {
  visible: boolean;
};

type Screen = 'login' | 'register';

export function AuthModal({ visible }: Props) {
  const [currentScreen, setCurrentScreen] = useState<Screen>('register');

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
    >
      <View style={{ flex: 1 }}>
        {currentScreen === 'login' ? (
          <LoginScreen onSwitchToRegister={() => setCurrentScreen('register')} />
        ) : (
          <RegisterScreen onSwitchToLogin={() => setCurrentScreen('login')} />
        )}
      </View>
    </Modal>
  );
}
