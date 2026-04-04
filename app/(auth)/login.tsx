import { supabase } from '@/lib/supabase';
import { GoogleIcon } from '@/components/GoogleIcon';
import { Logo } from '@/components/Logo';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/AlertContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
    ActivityIndicator,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS !== 'web') {
    WebBrowser.maybeCompleteAuthSession();
}

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { showAlert } = useAlert();
    const { isWideWeb } = useResponsiveLayout();
    const insets = useSafeAreaInsets();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    const handleSignIn = async () => {
        if (!email.trim()) { showAlert('Missing Email', 'Please enter your email address.'); return; }
        if (!validateEmail(email)) { showAlert('Invalid Email', 'Please enter a valid email address.'); return; }
        if (!password) { showAlert('Missing Password', 'Please enter your password.'); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (error) throw error;
            if (data.session) {
                router.replace('/');
            }
        } catch (err: any) {
            showAlert('Sign In Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = useCallback(async () => {
        try {
            setLoading(true);

            // Use the scheme from app.json
            const redirectUrl = Platform.OS === 'web'
                ? window.location.origin + '/auth/callback'
                : Linking.createURL('auth/callback');

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: Platform.OS !== 'web',
                },
            });

            if (error) throw error;
            if (Platform.OS === 'web') return; // Supabase handles the redirect automatically on web

            // For native:
            if (data?.url) {
                // Ensure the browser session is correctly handled
                const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                if (res.type === 'success' && res.url) {
                    // Extract tokens from the fragment
                    // Supabase sends tokens as #access_token=... and #refresh_token=...
                    const cleanUrl = res.url.replace('#', '?');
                    const parsedUrl = Linking.parse(cleanUrl);

                    const access_token = parsedUrl.queryParams?.access_token as string | undefined;
                    const refresh_token = parsedUrl.queryParams?.refresh_token as string | undefined;

                    if (access_token && refresh_token) {
                        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (sessionError) throw sessionError;
                        router.replace('/');
                    }
                } else if (res.type === 'cancel') {
                    // User canceled login
                }
            }
        } catch (err: any) {
            console.error('Google Sign In Error:', err);
            showAlert('Google Sign In Failed', err.message);
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    const handleSubmit = () => {
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
        ]).start();
        handleSignIn();
    };

    const isFormValid = email.trim() !== '' && password !== '';

    // ── Shared form fields (compact = web, !compact = mobile) ─────────────────
    const renderForm = (compact: boolean) => (
        <>
            {/* Email */}
            <View style={[styles.inputGroup, compact && { marginBottom: 12 }]}>
                {!compact && <Text style={[styles.label, { color: c.textSecondary }]}>Email Address</Text>}
                <View style={[styles.inputWrapper, compact && { height: 46 }, {
                    backgroundColor: c.inputBg,
                    borderColor: emailFocused ? Colors.brand.secondary : c.inputBorder,
                }]}>
                    <View style={[styles.inputIconContainer, { backgroundColor: emailFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                        <Ionicons name="mail-outline" size={17} color={emailFocused ? Colors.brand.secondary : c.icon} />
                    </View>
                    <TextInput
                        style={[styles.input, { color: c.text }]}
                        placeholder="you@example.com"
                        placeholderTextColor={c.textTertiary}
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                    />
                    {email.length > 0 && (
                        <TouchableOpacity onPress={() => setEmail('')} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={18} color={c.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Password */}
            <View style={[styles.inputGroup, compact && { marginBottom: 10 }]}>
                <View style={[styles.labelRow, !compact && { marginBottom: 8 }]}>
                    {!compact && <Text style={[styles.label, { color: c.textSecondary, marginBottom: 0 }]}>Password</Text>}
                    {compact && <View />}
                    <TouchableOpacity onPress={() => showAlert('Reset Password', 'Password reset coming soon.')}>
                        <Text style={[styles.forgotText, { color: Colors.brand.secondary, fontSize: compact ? FontSize.xs : FontSize.sm }]}>
                            Forgot password?
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={[styles.inputWrapper, compact && { height: 46 }, {
                    backgroundColor: c.inputBg,
                    borderColor: passwordFocused ? Colors.brand.secondary : c.inputBorder,
                }]}>
                    <View style={[styles.inputIconContainer, { backgroundColor: passwordFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                        <Ionicons name="lock-closed-outline" size={17} color={passwordFocused ? Colors.brand.secondary : c.icon} />
                    </View>
                    <TextInput
                        style={[styles.input, { color: c.text, flex: 1 }]}
                        placeholder="Enter your password"
                        placeholderTextColor={c.textTertiary}
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        secureTextEntry={!showPassword}
                        textContentType="password"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.icon} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Remember me */}
            <View style={[styles.optionsRow, compact && { marginBottom: 16 }]}>
                <TouchableOpacity style={styles.rememberMeContainer} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, {
                        borderColor: rememberMe ? Colors.brand.secondary : c.border,
                        backgroundColor: rememberMe ? Colors.brand.secondary : 'transparent',
                    }]}>
                        {rememberMe && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={[styles.rememberMeText, { color: c.textSecondary }]}>Remember me</Text>
                </TouchableOpacity>
            </View>

            {/* Sign In button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                    style={[styles.primaryButton, compact && { height: 46 }, {
                        backgroundColor: isFormValid ? Colors.brand.primary : c.border,
                    }]}
                    onPress={handleSubmit}
                    disabled={loading || !isFormValid}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={styles.loadingText}>Signing in...</Text>
                        </View>
                    ) : (
                        <Text style={styles.primaryButtonText}>Sign In</Text>
                    )}
                </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={[styles.dividerRow, compact && { marginVertical: 14 }]}>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                <Text style={[styles.dividerText, { color: c.textTertiary }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            </View>

            {/* Google — full width button */}
            <TouchableOpacity
                style={[styles.googleButton, compact && { height: 44 }, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.7}
            >
                <GoogleIcon size={18} />
                <Text style={[styles.googleButtonText, { color: c.text }]}>Continue with Google</Text>
            </TouchableOpacity>
        </>
    );

    // ─── Desktop web — centered card, no scroll ───────────────────────────────
    if (isWideWeb) {
        return (
            <LinearGradient
                colors={isDark ? ['#0C0F14', '#111827'] : ['#EEF2FF', '#F8FAFF']}
                style={styles.container}
            >
                <Animated.View style={[styles.webOuter, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={[styles.webCard, {
                        backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(31,70,144,0.10)',
                        ...(Platform.OS === 'web' ? {
                            boxShadow: isDark
                                ? '0 24px 80px rgba(0,0,0,0.5)'
                                : '0 24px 80px rgba(31,70,144,0.13)',
                        } as any : {}),
                    }]}>

                        {/* Left brand panel */}
                        <LinearGradient
                            colors={isDark ? ['#1E3A7A', '#152B5E'] : ['#1F4690', '#2D5CB8']}
                            style={styles.webLeft}
                        >
                            <View style={styles.webLeftDeco1} />
                            <View style={styles.webLeftDeco2} />
                            <View style={{ alignItems: 'center', zIndex: 1 }}>
                                <Logo size={60} fontSize={17} stacked={true} textColor="#FFFFFF" />
                                <Text style={styles.webLeftTagline}>
                                    Driven by Research,{'\n'}Built with Networks,{'\n'}Act with Conviction.
                                </Text>
                                <View style={styles.webLeftBadge}>
                                    <Ionicons name="shield-checkmark" size={12} color="rgba(255,200,50,0.9)" />
                                    <Text style={styles.webLeftBadgeText}>SEBI Registered Research Analyst</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        {/* Right form panel */}
                        <View style={[styles.webRight, { backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF' }]}>
                            <Text style={[styles.webFormTitle, { color: c.text }]}>Welcome back</Text>
                            <Text style={[styles.webFormSubtitle, { color: c.textSecondary }]}>Sign in to your account</Text>

                            <View style={{ marginTop: 20 }}>
                                {renderForm(true)}
                            </View>

                            <View style={styles.webFooter}>
                                <Text style={[styles.footerText, { color: c.textSecondary }]}>Don't have an account?{' '}</Text>
                                <Link href="/(auth)/register" asChild>
                                    <TouchableOpacity activeOpacity={0.7}>
                                        <Text style={[styles.linkText, { color: Colors.brand.secondary }]}>Create Account</Text>
                                    </TouchableOpacity>
                                </Link>
                            </View>
                            <Text style={[styles.termsText, { color: c.textTertiary }]}>
                                By signing in, you agree to our{' '}
                                <Text style={{ color: Colors.brand.secondary }}>Terms</Text>
                                {' '}and{' '}
                                <Text style={{ color: Colors.brand.secondary }}>Privacy Policy</Text>
                            </Text>
                        </View>

                    </View>
                </Animated.View>
            </LinearGradient>
        );
    }

    // ─── Mobile — scrollable ──────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                contentContainerStyle={[
                    styles.mobileContainer, 
                    { backgroundColor: c.background, paddingBottom: 30 + insets.bottom }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={[styles.brandBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={{ marginBottom: 16 }}>
                        <Logo size={72} fontSize={20} stacked={true} />
                    </View>
                    <Text style={[styles.brandSubtitle, { color: c.textSecondary }]}>
                        Welcome back! Sign in to continue
                    </Text>
                </Animated.View>

                {renderForm(false)}

                <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                    <Text style={[styles.footerText, { color: c.textSecondary }]}>Don't have an account?{' '}</Text>
                    <Link href="/(auth)/register" asChild>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={[styles.linkText, { color: Colors.brand.secondary }]}>Create Account</Text>
                        </TouchableOpacity>
                    </Link>
                </Animated.View>

                <Text style={[styles.termsText, { color: c.textTertiary }]}>
                    By signing in, you agree to our{' '}
                    <Text style={{ color: Colors.brand.secondary }}>Terms of Service</Text>
                    {' '}and{' '}
                    <Text style={{ color: Colors.brand.secondary }}>Privacy Policy</Text>
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // ── Desktop card ──
    webOuter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    webCard: {
        width: 820,
        maxWidth: '100%',
        flexDirection: 'row',
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
    },
    webLeft: {
        width: 300,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        overflow: 'hidden',
    },
    webLeftDeco1: {
        position: 'absolute', top: -50, right: -50,
        width: 180, height: 180, borderRadius: 90,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    webLeftDeco2: {
        position: 'absolute', bottom: -30, left: -40,
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    webLeftTagline: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 20,
        fontWeight: '500',
    },
    webLeftBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.10)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    webLeftBadgeText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    webRight: {
        flex: 1,
        padding: 44,
        justifyContent: 'center',
    },
    webFormTitle: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    webFormSubtitle: {
        fontSize: 14,
    },
    webFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 18,
        marginBottom: 6,
    },

    // ── Mobile ──
    mobileContainer: {
        flexGrow: 1,
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Platform.select({ ios: 60, default: 40 }),
        paddingBottom: 30,
    },
    brandBlock: {
        alignItems: 'center',
        marginBottom: 32,
    },
    brandSubtitle: {
        fontSize: FontSize.base,
        textAlign: 'center',
    },

    // ── Shared form ──
    inputGroup: { marginBottom: Spacing.lg },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: 8 },
    forgotText: { fontSize: FontSize.sm, fontWeight: '600' },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: BorderRadius.lg,
        height: 52,
        overflow: 'hidden',
    },
    inputIconContainer: {
        width: 46,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: { flex: 1, fontSize: FontSize.base, paddingHorizontal: 12, height: '100%' },
    clearButton: { padding: 8, marginRight: 4 },
    eyeButton: { padding: 12 },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    rememberMeContainer: { flexDirection: 'row', alignItems: 'center' },
    checkbox: {
        width: 18, height: 18, borderRadius: 5, borderWidth: 2,
        justifyContent: 'center', alignItems: 'center', marginRight: 8,
    },
    rememberMeText: { fontSize: FontSize.sm, fontWeight: '500' },
    primaryButton: {
        height: 52,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700', letterSpacing: 0.3 },
    loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    loadingText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { marginHorizontal: Spacing.md, fontSize: FontSize.sm, fontWeight: '500' },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 52,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
    },
    googleButtonText: { fontSize: FontSize.sm, fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing['2xl'] },
    footerText: { fontSize: FontSize.base },
    linkText: { fontSize: FontSize.base, fontWeight: '700' },
    termsText: { fontSize: FontSize.xs, textAlign: 'center', marginTop: 10, lineHeight: 18 },
});
