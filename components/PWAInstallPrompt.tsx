import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';

// Extend Window type for deferredPrompt
declare global {
  interface Window {
    deferredPrompt: any;
  }
}

export default function PWAInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const slideAnim = React.useRef(new Animated.Value(120)).current;

  useEffect(() => {
    // Only run on web
    if (Platform.OS !== 'web') return;

    // Don't show if already installed (running in standalone/PWA mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Don't show if user already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    setDeferredPrompt(null);
    dismiss();
  };

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowBanner(false));
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.left}>
        <Text style={styles.icon}>📲</Text>
        <View>
          <Text style={styles.title}>Install Tikona Research</Text>
          <Text style={styles.subtitle}>Add to home screen for faster access</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss}>
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.installBtn} onPress={handleInstall}>
          <Text style={styles.installText}>Install</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute' as any,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 9999,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  icon: {
    fontSize: 28,
    marginRight: 4,
  },
  title: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  subtitle: {
    color: '#93c5fd',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dismissText: {
    color: '#93c5fd',
    fontSize: 13,
  },
  installBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  installText: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 13,
  },
});
