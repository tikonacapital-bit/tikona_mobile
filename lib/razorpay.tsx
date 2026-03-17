import React, { useState, useEffect } from 'react';
import {
  Modal, View, ActivityIndicator, StyleSheet,
  TouchableOpacity, Text, Platform, Linking,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

// Conditionally import WebView only on native
let WebView: any = null;
let WebViewNavigation: any = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('react-native-webview');
    WebView = mod.WebView;
  } catch { }
}

// ─── Constants ───────────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';

export type PlanKey = 'basic' | 'premium';

export const PLAN_AMOUNTS: Record<PlanKey, number> = {
  basic: 49900,    // ₹499 in paise
  premium: 99900,  // ₹999 in paise
};

export const PLAN_NAMES: Record<PlanKey, string> = {
  basic: 'Basic Plan',
  premium: 'Premium Plan',
};

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

// UPI/intent deep link schemes that need to open in external apps
const EXTERNAL_SCHEMES = [
  'upi://', 'intent://', 'phonepe://', 'gpay://',
  'paytmmp://', 'bhim://', 'tez://', 'credpay://',
];

// ─── HTML Builder (for native WebView) ────────────────────────────────────────
// Spoof browser environment before Razorpay detects WebView, then load dynamically
function buildRazorpayHTML(opts: {
  key: string;
  amount: number;
  description: string;
  prefillName: string;
  prefillEmail: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: -apple-system, Roboto, sans-serif;
    }
    .loader { color: #94a3b8; font-size: 15px; text-align: center; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 14px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader" id="loader">
    <div class="spinner"></div>
    Loading payment…
  </div>

  <script>
    // ── STEP 1: Spoof browser environment BEFORE anything else loads ──────────
    // Razorpay checks window.ReactNativeWebView — delete it so it sees a browser
    try { delete window.ReactNativeWebView; } catch(e) {}
    try {
      Object.defineProperty(window, 'ReactNativeWebView', {
        get: function() { return undefined; },
        configurable: true
      });
    } catch(e) {}

    // Override navigator to look like a real Chrome mobile browser
    var fakeUA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36';
    try {
      Object.defineProperty(navigator, 'userAgent', { get: function() { return fakeUA; }, configurable: true });
    } catch(e) {}
    try {
      Object.defineProperty(navigator, 'vendor', { get: function() { return 'Google Inc.'; }, configurable: true });
    } catch(e) {}
    try {
      Object.defineProperty(navigator, 'platform', { get: function() { return 'Linux armv8l'; }, configurable: true });
    } catch(e) {}

    // Ensure window.webkit is undefined (iOS WebView signal)
    try { delete window.webkit; } catch(e) {}
    try {
      Object.defineProperty(window, 'webkit', { get: function() { return undefined; }, configurable: true });
    } catch(e) {}

    function redirect(url) {
      window.location.href = url;
    }

    // ── STEP 2: Load checkout.js DYNAMICALLY after spoofing is complete ──────
    function loadRazorpay() {
      var script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onerror = function() {
        redirect('tikona-payment://failed?error=' + encodeURIComponent('Failed to load Razorpay. Check network connection.'));
      };
      script.onload = function() {
        document.getElementById('loader').style.display = 'none';

        if (typeof Razorpay === 'undefined') {
          redirect('tikona-payment://failed?error=' + encodeURIComponent('Razorpay SDK not available'));
          return;
        }

        var options = {
          key: ${JSON.stringify(opts.key)},
          amount: ${opts.amount},
          currency: 'INR',
          name: 'Tikona Capital',
          description: ${JSON.stringify(opts.description)},
          prefill: {
            name: ${JSON.stringify(opts.prefillName)},
            email: ${JSON.stringify(opts.prefillEmail)}
          },
          theme: { color: '#1B2B4B' },
          modal: {
            backdropclose: false,
            escape: false,
            animation: true,
            ondismiss: function() {
              redirect('tikona-payment://cancelled');
            }
          },
          handler: function(res) {
            redirect('tikona-payment://success?id=' + res.razorpay_payment_id);
          }
        };

        try {
          var rzp = new Razorpay(options);
          rzp.on('payment.failed', function(res) {
            var msg = encodeURIComponent(
              (res.error && (res.error.description || res.error.reason)) || 'Payment failed'
            );
            redirect('tikona-payment://failed?error=' + msg);
          });
          rzp.open();
        } catch(e) {
          redirect('tikona-payment://failed?error=' + encodeURIComponent(e.message || 'Razorpay init failed'));
        }
      };
      document.head.appendChild(script);
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadRazorpay);
    } else {
      loadRazorpay();
    }
  </script>
</body>
</html>`;
}

// ─── Web Razorpay (loads Razorpay checkout.js directly in browser) ────────────
function RazorpayWeb({
  plan,
  userName,
  userEmail,
  onResult,
}: {
  plan: PlanKey;
  userName: string;
  userEmail: string;
  onResult: (result: PaymentResult) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Dynamically load Razorpay checkout.js
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      openCheckout();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => openCheckout();
    script.onerror = () => {
      setLoading(false);
      setError('Failed to load Razorpay SDK');
    };
    document.head.appendChild(script);

    function openCheckout() {
      setLoading(false);
      try {
        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) {
          setError('Razorpay SDK not available');
          return;
        }

        const options = {
          key: RAZORPAY_KEY_ID,
          amount: PLAN_AMOUNTS[plan],
          currency: 'INR',
          name: 'Tikona Capital',
          description: `Tikona Capital — ${PLAN_NAMES[plan]}`,
          prefill: {
            name: userName,
            email: userEmail,
          },
          theme: { color: '#1B2B4B' },
          modal: {
            backdropclose: false,
            escape: false,
            animation: true,
            ondismiss: () => {
              onResult({ success: false, error: 'cancelled' });
            },
          },
          handler: (res: any) => {
            onResult({ success: true, paymentId: res.razorpay_payment_id });
          },
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', (res: any) => {
          const msg = res?.error?.description || res?.error?.reason || 'Payment failed';
          onResult({ success: false, error: msg });
        });
        rzp.open();
      } catch (e: any) {
        setError(e.message || 'Failed to open Razorpay');
      }
    }
  }, []);

  return (
    <View style={styles.webRazorpayOverlay}>
      {loading && (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.brand.secondary} />
          <Text style={styles.loaderText}>Loading Razorpay...</Text>
        </View>
      )}
      {error && (
        <View style={styles.loaderWrap}>
          <Text style={[styles.loaderText, { color: '#f87171' }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.backBtn, { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.08)' }]}
            onPress={() => onResult({ success: false, error: 'cancelled' })}
          >
            <Text style={{ color: '#fff', fontSize: FontSize.sm }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !error && (
        <View style={styles.loaderWrap}>
          <Text style={styles.loaderText}>Razorpay checkout is open...</Text>
          <TouchableOpacity
            style={[styles.backBtn, { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.08)' }]}
            onPress={() => onResult({ success: false, error: 'cancelled' })}
          >
            <Text style={{ color: '#fff', fontSize: FontSize.sm }}>Cancel Payment</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── RazorpayWebView Component (native) ──────────────────────────────────────
interface RazorpayWebViewProps {
  visible: boolean;
  plan: PlanKey;
  userName: string;
  userEmail: string;
  onResult: (result: PaymentResult) => void;
  theme: 'light' | 'dark';
}

export function RazorpayWebView({
  visible, plan, userName, userEmail, onResult,
}: RazorpayWebViewProps) {
  // ─── WEB: Use native Razorpay checkout ──────────────────────────────────
  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <RazorpayWeb
        plan={plan}
        userName={userName}
        userEmail={userEmail}
        onResult={onResult}
      />
    );
  }

  // ─── NATIVE: Use WebView ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  const html = buildRazorpayHTML({
    key: RAZORPAY_KEY_ID,
    amount: PLAN_AMOUNTS[plan],
    description: `Tikona Capital — ${PLAN_NAMES[plan]}`,
    prefillName: userName,
    prefillEmail: userEmail,
  });

  const handleNavigationRequest = (request: any): boolean => {
    const url = request.url ?? '';

    // Catch our custom payment result URLs
    if (url.startsWith('tikona-payment://')) {
      if (url.startsWith('tikona-payment://success')) {
        const id = url.split('?id=')[1] ?? '';
        onResult({ success: true, paymentId: decodeURIComponent(id) });
      } else if (url.startsWith('tikona-payment://cancelled')) {
        onResult({ success: false, error: 'cancelled' });
      } else if (url.startsWith('tikona-payment://failed')) {
        const errPart = url.split('?error=')[1] ?? 'Payment failed';
        onResult({ success: false, error: decodeURIComponent(errPart) });
      }
      return false; // block navigation
    }

    // Open UPI apps externally
    if (EXTERNAL_SCHEMES.some(s => url.startsWith(s))) {
      Linking.openURL(url).catch(() => { });
      return false;
    }

    return true;
  };

  if (!WebView) {
    return (
      <Modal visible={visible} transparent>
        <View style={styles.loaderWrap}>
          <Text style={[styles.loaderText, { color: '#f87171' }]}>WebView not available on this platform</Text>
          <TouchableOpacity
            style={[styles.backBtn, { marginTop: 16 }]}
            onPress={() => onResult({ success: false, error: 'WebView unavailable' })}
          >
            <Text style={{ color: '#fff' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => onResult({ success: false, error: 'cancelled' })}
    >
      <View style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => onResult({ success: false, error: 'cancelled' })}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Secure Checkout</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Loader */}
        {loading && (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={Colors.brand.secondary} />
            <Text style={styles.loaderText}>Connecting to Razorpay…</Text>
          </View>
        )}

        {/* WebView — spoofs browser env before Razorpay loads */}
        <WebView
          source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={handleNavigationRequest}
          onError={(e: any) => {
            onResult({ success: false, error: `WebView error: ${e.nativeEvent.description}` });
          }}
          style={[styles.webview, loading && { flex: 0, height: 0 }]}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          userAgent="Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36"
          injectedJavaScriptBeforeContentLoaded={`
                        (function() {
                            try { delete window.ReactNativeWebView; } catch(e) {}
                            try {
                                Object.defineProperty(window, 'ReactNativeWebView', {
                                    get: function() { return undefined; },
                                    configurable: true, enumerable: false
                                });
                            } catch(e) {}
                            true;
                        })();
                    `}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={11} color="#64748b" />
          <Text style={styles.footerText}>256-bit SSL · Secured by Razorpay</Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Save Subscription to Supabase ───────────────────────────────────────────
export async function saveSubscription(
  userId: string,
  plan: PlanKey,
  paymentId: string,
): Promise<{ error?: string }> {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    plan,
    is_active: true,
    started_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    razorpay_payment_id: paymentId,
  }, { onConflict: 'user_id' });

  return { error: error?.message };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 58 : Platform.OS === 'web' ? 16 : 44,
    paddingBottom: 14,
    backgroundColor: '#1e293b',
  },
  topBarTitle: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loaderText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: FontSize.sm,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#1e293b',
  },
  footerText: {
    color: '#64748b',
    fontSize: 11,
  },
  webRazorpayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
