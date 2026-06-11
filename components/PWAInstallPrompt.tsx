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
  const slideAnim = React.useRef(new Animated.Value(200)).current;

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
      window.deferredPrompt = e;
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
      toValue: 200,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowBanner(false));
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.topRow}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📲</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>Install Tikona Research</Text>
          <Text style={styles.subtitle} numberOfLines={2}>Add to home screen for faster access</Text>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} activeOpacity={0.8}>
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.installBtn} onPress={handleInstall} activeOpacity={0.8}>
          <Text style={styles.installText}>Install App</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute' as any,
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1e3a8a',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  subtitle: {
    color: '#93c5fd',
    fontSize: 13,
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  installBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  dismissText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  installText: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 15,
  },
});
