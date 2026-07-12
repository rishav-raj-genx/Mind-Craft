import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radii } from '@/constants/theme';
import { setGlobalAlertHandler, type GlobalAlertPayload, type GlobalAlertType } from '@/services/globalAlert';

type GlobalAlertContextValue = {
  showAlert: (payload: GlobalAlertPayload) => void;
  hideAlert: () => void;
};

const GlobalAlertContext = createContext<GlobalAlertContextValue | null>(null);

const alertStyles: Record<GlobalAlertType, { bg: string; accent: string; label: string }> = {
  success: { bg: '#F0FFD6', accent: '#5EA800', label: 'Nice!' },
  error: { bg: '#FFE9E2', accent: '#E44D35', label: 'Oops' },
  info: { bg: '#E7F7FF', accent: '#1687A7', label: 'Heads up' },
  warning: { bg: '#FFF3CB', accent: '#D28A00', label: 'Careful' },
};

export function GlobalAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<GlobalAlertPayload | null>(null);

  const showAlert = useCallback((payload: GlobalAlertPayload) => {
    setAlert({
      type: payload.type || 'info',
      title: payload.title,
      message: payload.message,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert(null);
  }, []);

  useEffect(() => {
    setGlobalAlertHandler(showAlert);
    return () => setGlobalAlertHandler(null);
  }, [showAlert]);

  const value = useMemo(() => ({ showAlert, hideAlert }), [hideAlert, showAlert]);
  const type = alert?.type || 'info';
  const theme = alertStyles[type];

  return (
    <GlobalAlertContext.Provider value={value}>
      {children}
      <Modal transparent visible={!!alert} animationType="fade" onRequestClose={hideAlert}>
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: theme.bg }]}>
            <View style={[styles.iconBubble, { backgroundColor: theme.accent }]}>
              <Text style={styles.iconText}>{type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i'}</Text>
            </View>
            <Text style={[styles.kicker, { color: theme.accent }]}>{theme.label}</Text>
            <Text style={styles.title}>{alert?.title}</Text>
            {!!alert?.message && <Text style={styles.message}>{alert.message}</Text>}
            <Pressable onPress={hideAlert} style={[styles.button, { backgroundColor: theme.accent }]}>
              <Text style={styles.buttonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </GlobalAlertContext.Provider>
  );
}

export function useGlobalAlert() {
  const context = useContext(GlobalAlertContext);
  if (!context) {
    throw new Error('useGlobalAlert must be used inside GlobalAlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32, 26, 46, 0.42)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#201A2E',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  kicker: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  button: {
    marginTop: 22,
    borderRadius: radii.pill,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
