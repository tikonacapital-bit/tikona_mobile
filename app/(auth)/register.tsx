import { GoogleIcon } from '@/components/GoogleIcon';
import { Logo } from '@/components/Logo';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAlert } from '@/context/AlertContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useClerk, useOAuth, useSignUp } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS !== 'web') {
    WebBrowser.maybeCompleteAuthSession();
}

const useWarmUpBrowser = () => {
    React.useEffect(() => {
        if (Platform.OS !== 'web') {
            void WebBrowser.warmUpAsync();
            return () => { void WebBrowser.coolDownAsync(); };
        }
    }, []);
};

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export default function RegisterScreen() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState('');

    const [nameFocused, setNameFocused] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    useWarmUpBrowser();
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { showAlert } = useAlert();
    const { isWideWeb } = useResponsiveLayout();
    const insets = useSafeAreaInsets();

    const { isLoaded, signUp, setActive } = useSignUp();
    const clerk = useClerk();
    // eslint-disable-next-line deprecation/deprecation
    const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    const getPasswordStrength = (pwd: string): { progress: number; label: string; color: string } => {
        let score = 0;
        if (pwd.length >= 6) score++;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[a-z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        if (score <= 2) return { progress: 0.25, label: 'Weak', color: c.danger };
        if (score <= 3) return { progress: 0.5, label: 'Fair', color: c.warning };
        if (score <= 4) return { progress: 0.75, label: 'Good', color: Colors.brand.accent };
        return { progress: 1, label: 'Strong', color: c.success };
    };

    const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    const handleEmailChange = (text: string) => {
        setEmail(text);
        setEmailError(text && !validateEmail(text) ? 'Please enter a valid email address' : '');
    };
    const handlePasswordChange = (text: string) => {
        setPassword(text);
        setPasswordError(text && text.length < 6 ? 'Password must be at least 6 characters' : '');
    };
    const handleConfirmPasswordChange = (text: string) => {
        setConfirmPassword(text);
        setConfirmPasswordError(text && text !== password ? 'Passwords do not match' : '');
    };

    const signUpWithEmail = async () => {
        if (!fullName.trim()) { showAlert('Missing Name', 'Please enter your full name'); return; }
        if (!email.trim()) { showAlert('Missing Email', 'Please enter your email address'); return; }
        if (!validateEmail(email)) { showAlert('Invalid Email', 'Please enter a valid email address'); return; }
        if (!password) { showAlert('Missing Password', 'Please enter a password'); return; }
        if (password.length < 6) { showAlert('Weak Password', 'Password must be at least 6 characters'); return; }
        if (password !== confirmPassword) { showAlert('Password Mismatch', 'Passwords do not match'); return; }
        if (!agreeTerms) { showAlert('Terms Required', 'Please agree to the Terms of Service and Privacy Policy'); return; }
        if (!isLoaded) return;
        setLoading(true);
        try {
            await signUp.create({ emailAddress: email.trim(), password, firstName: fullName.trim() });
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setPendingVerification(true);
        } catch (err: any) {
            showAlert('Sign Up Failed', err.errors ? err.errors[0].message : err.message);
        } finally {
            setLoading(false);
        }
    };

    const onPressVerify = async () => {
        if (!isLoaded) return;
        setLoading(true);
        try {
            const result = await signUp.attemptEmailAddressVerification({ code });
            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                router.replace('/');
            }
        } catch (err: any) {
            showAlert('Verification Failed', err.errors ? err.errors[0].message : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignUp = useCallback(async () => {
        try {
            setLoading(true);
            if (clerk.client.activeSessions.length > 0) await clerk.signOut();
            const { createdSessionId, setActive: setOAuthActive, signUp: oauthSignUp, signIn } = await startGoogleOAuthFlow();
            if (createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: createdSessionId });
                router.replace('/');
            } else if (oauthSignUp?.createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: oauthSignUp.createdSessionId });
                router.replace('/');
            } else if (signIn?.createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: signIn.createdSessionId });
                router.replace('/');
            } else if (oauthSignUp?.status === 'missing_requirements') {
                showAlert('Registration Incomplete', 'Please sign up via email.');
            }
        } catch (err: any) {
            const message = err?.errors?.[0]?.message ?? err?.message ?? 'An unknown error occurred';
            if (message.toLowerCase().includes('session already exists')) {
                router.replace('/');
            } else {
                showAlert('Google Sign Up Failed', message);
            }
        } finally {
            setLoading(false);
        }
    }, [startGoogleOAuthFlow, showAlert, clerk]);

    const passwordStrength = getPasswordStrength(password);
    const isFormValid = fullName.trim() !== '' && validateEmail(email) && password.length >= 6 && password === confirmPassword && agreeTerms;

    // ── Shared form content ───────────────────────────────────────────────────
    const renderRegistrationForm = (compact: boolean) => (
        <>
            {/* Full Name */}
            <View style={[styles.inputGroup, compact && { marginBottom: 10 }]}>
                {!compact && <Text style={[styles.label, { color: c.textSecondary }]}>Full Name</Text>}
                <View style={[styles.inputWrapper, compact && { height: 44 }, {
                    backgroundColor: c.inputBg,
                    borderColor: nameFocused ? Colors.brand.secondary : c.inputBorder,
                }]}>
                    <View style={[styles.inputIconContainer, { backgroundColor: nameFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                        <Ionicons name="person-outline" size={17} color={nameFocused ? Colors.brand.secondary : c.icon} />
                    </View>
                    <TextInput
                        style={[styles.input, { color: c.text }]}
                        placeholder="John Doe"
                        placeholderTextColor={c.textTertiary}
                        value={fullName}
                        onChangeText={setFullName}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                        autoCapitalize="words"
                        textContentType="name"
                    />
                </View>
            </View>

            {/* Email */}
            <View style={[styles.inputGroup, compact && { marginBottom: 10 }]}>
                {!compact && <Text style={[styles.label, { color: c.textSecondary }]}>Email Address</Text>}
                <View style={[styles.inputWrapper, compact && { height: 44 }, {
                    backgroundColor: c.inputBg,
                    borderColor: emailError ? c.danger : emailFocused ? Colors.brand.secondary : c.inputBorder,
                }]}>
                    <View style={[styles.inputIconContainer, { backgroundColor: emailFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                        <Ionicons name="mail-outline" size={17} color={emailFocused ? Colors.brand.secondary : c.icon} />
                    </View>
                    <TextInput
                        style={[styles.input, { color: c.text }]}
                        placeholder="you@example.com"
                        placeholderTextColor={c.textTertiary}
                        value={email}
                        onChangeText={handleEmailChange}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                    />
                </View>
                {emailError ? <Text style={[styles.errorText, { color: c.danger }]}>{emailError}</Text> : null}
            </View>

            {/* Password */}
            <View style={[styles.inputGroup, compact && { marginBottom: 10 }]}>
                {!compact && <Text style={[styles.label, { color: c.textSecondary }]}>Password</Text>}
                <View style={[styles.inputWrapper, compact && { height: 44 }, {
                    backgroundColor: c.inputBg,
                    borderColor: passwordError ? c.danger : passwordFocused ? Colors.brand.secondary : c.inputBorder,
                }]}>
                    <View style={[styles.inputIconContainer, { backgroundColor: passwordFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                        <Ionicons name="lock-closed-outline" size={17} color={passwordFocused ? Colors.brand.secondary : c.icon} />
                    </View>
                    <TextInput
                        style={[styles.input, { color: c.text, flex: 1 }]}
                        placeholder="Create a password"
                        placeholderTextColor={c.textTertiary}
                        value={password}
                        onChangeText={handlePasswordChange}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.icon} />
                    </TouchableOpacity>
                </View>
                {password.length > 0 && (
                    <View style={styles.strengthRow}>
                        <View style={[styles.strengthBarBg, { backgroundColor: c.border }]}>
                            <View style={[styles.strengthBarFill, { width: `${passwordStrength.progress * 100}%`, backgroundColor: passwordStrength.color }]} />
                        </View>
                        <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>{passwordStrength.label}</Text>
                    </View>
                )}
            </View>

            {/* Confirm Password */}
            <View style={[styles.inputGroup, compact && { marginBottom: 10 }]}>
                {!compact && <Text style={[styles.label, { color: c.textSecondary }]}>Confirm Password</Text>}
                <View style={[styles.inputWrapper, compact && { height: 44 }, {
                    backgroundColor: c.inputBg,
                    borderColor: confirmPasswordError ? c.danger : confirmPasswordFocused ? Colors.brand.secondary : c.inputBorder,
                }]}>
                    <View style={[styles.inputIconContainer, { backgroundColor: confirmPasswordFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                        <Ionicons name="shield-checkmark-outline" size={17} color={confirmPasswordFocused ? Colors.brand.secondary : c.icon} />
                    </View>
                    <TextInput
                        style={[styles.input, { color: c.text, flex: 1 }]}
                        placeholder="Re-enter password"
                        placeholderTextColor={c.textTertiary}
                        value={confirmPassword}
                        onChangeText={handleConfirmPasswordChange}
                        onFocus={() => setConfirmPasswordFocused(true)}
                        onBlur={() => setConfirmPasswordFocused(false)}
                        secureTextEntry={!showConfirmPassword}
                        textContentType="newPassword"
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                        <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.icon} />
                    </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && (
                    <View style={styles.matchRow}>
                        <Ionicons name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'} size={13} color={password === confirmPassword ? c.success : c.danger} />
                        <Text style={[styles.matchText, { color: password === confirmPassword ? c.success : c.danger }]}>
                            {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Terms */}
            <TouchableOpacity style={[styles.termsContainer, compact && { marginBottom: 12 }]} onPress={() => setAgreeTerms(!agreeTerms)} activeOpacity={0.7}>
                <View style={[styles.checkbox, {
                    borderColor: agreeTerms ? Colors.brand.secondary : c.border,
                    backgroundColor: agreeTerms ? Colors.brand.secondary : 'transparent',
                }]}>
                    {agreeTerms && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[styles.termsText, { color: c.textSecondary, fontSize: compact ? FontSize.xs : FontSize.sm }]}>
                    I agree to the{' '}
                    <Text style={{ color: Colors.brand.secondary, fontWeight: '600' }}>Terms of Service</Text>
                    {' '}and{' '}
                    <Text style={{ color: Colors.brand.secondary, fontWeight: '600' }}>Privacy Policy</Text>
                </Text>
            </TouchableOpacity>

            {/* Create Account button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                    style={[styles.primaryButton, compact && { height: 44 }, { backgroundColor: isFormValid ? Colors.brand.primary : c.border }]}
                    onPress={() => { Animated.sequence([Animated.timing(buttonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }), Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true })]).start(); signUpWithEmail(); }}
                    disabled={loading || !isFormValid}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={styles.loadingText}>Creating account...</Text>
                        </View>
                    ) : (
                        <Text style={styles.primaryButtonText}>Create Account</Text>
                    )}
                </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={[styles.dividerRow, compact && { marginVertical: 12 }]}>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                <Text style={[styles.dividerText, { color: c.textTertiary }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            </View>

            {/* Google */}
            <TouchableOpacity
                style={[styles.googleButton, compact && { height: 42 }, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={handleGoogleSignUp}
                disabled={loading}
                activeOpacity={0.7}
            >
                <GoogleIcon size={18} />
                <Text style={[styles.googleButtonText, { color: c.text }]}>Continue with Google</Text>
            </TouchableOpacity>
        </>
    );

    const renderVerificationForm = (compact: boolean) => (
        <View>
            <Text style={[styles.verifyTitle, { color: c.text }]}>Check your email</Text>
            <Text style={[styles.verifySubtitle, { color: c.textSecondary }]}>
                We sent a 6-digit code to {email}
            </Text>
            <TextInput
                style={[styles.codeInput, compact && { fontSize: 28, height: 64 }, {
                    color: c.text,
                    backgroundColor: c.inputBg,
                    borderColor: c.inputBorder,
                }]}
                value={code}
                onChangeText={setCode}
                keyboardType="numeric"
                placeholder="000000"
                placeholderTextColor={c.textTertiary}
                maxLength={6}
            />
            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: Colors.brand.secondary, marginTop: 16 }]}
                onPress={onPressVerify}
                disabled={loading}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.loadingText}>Verifying...</Text>
                    </View>
                ) : (
                    <Text style={styles.primaryButtonText}>Verify Email</Text>
                )}
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
                <Text style={{ fontSize: FontSize.sm, color: c.textSecondary }}>Didn't receive code?{' '}</Text>
                <TouchableOpacity onPress={signUpWithEmail}>
                    <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.brand.secondary }}>Resend</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // ─── Desktop web layout ───────────────────────────────────────────────────
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
                            boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.5)' : '0 24px 80px rgba(31,70,144,0.13)',
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

                        {/* Right form panel — scrollable */}
                        <ScrollView
                            style={[styles.webRight, { backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF' }]}
                            contentContainerStyle={{ padding: 44, paddingBottom: 32 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {!pendingVerification ? (
                                <>
                                    <Text style={[styles.webFormTitle, { color: c.text }]}>Create Account</Text>
                                    <Text style={[styles.webFormSubtitle, { color: c.textSecondary }]}>Join Tikona Capital today</Text>
                                    <View style={{ marginTop: 20 }}>
                                        {renderRegistrationForm(true)}
                                    </View>
                                </>
                            ) : renderVerificationForm(true)}

                            <View style={styles.webFooter}>
                                <Text style={[styles.footerText, { color: c.textSecondary }]}>Already have an account?{' '}</Text>
                                <Link href="/(auth)/login" asChild>
                                    <TouchableOpacity activeOpacity={0.7}>
                                        <Text style={[styles.linkText, { color: Colors.brand.secondary }]}>Sign In</Text>
                                    </TouchableOpacity>
                                </Link>
                            </View>
                        </ScrollView>

                    </View>
                </Animated.View>
            </LinearGradient>
        );
    }

    // ─── Mobile layout ────────────────────────────────────────────────────────
    return (
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
                    <View style={{ marginBottom: 10 }}>
                        <Logo size={70} fontSize={18} stacked={true} />
                    </View>
                    <Text style={[styles.mobileTitle, { color: c.text }]}>Create Account</Text>
                    <Text style={[styles.brandSubtitle, { color: c.textSecondary }]}>Join TIKONA CAPITAL today</Text>
                </Animated.View>

                {!pendingVerification ? renderRegistrationForm(false) : renderVerificationForm(false)}

                <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                    <Text style={[styles.footerText, { color: c.textSecondary }]}>Already have an account?{' '}</Text>
                    <Link href="/(auth)/login" asChild>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={[styles.linkText, { color: Colors.brand.secondary }]}>Sign In</Text>
                        </TouchableOpacity>
                    </Link>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
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
        width: 860,
        maxWidth: '100%',
        maxHeight: '92%',
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
    webRight: { flex: 1 },
    webFormTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
    webFormSubtitle: { fontSize: 14 },
    webFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },

    // ── Mobile ──
    mobileContainer: {
        flexGrow: 1,
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Platform.select({ ios: 50, default: 30 }),
        paddingBottom: 30,
    },
    brandBlock: { alignItems: 'center', marginBottom: 28 },
    mobileTitle: { fontSize: FontSize['2xl'], fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
    brandSubtitle: { fontSize: FontSize.base },

    // ── Shared form ──
    inputGroup: { marginBottom: Spacing.lg },
    label: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: 8 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: BorderRadius.lg,
        height: 52,
        overflow: 'hidden',
    },
    inputIconContainer: { width: 44, height: '100%', justifyContent: 'center', alignItems: 'center' },
    input: { flex: 1, fontSize: FontSize.base, paddingHorizontal: 12, height: '100%' },
    eyeButton: { padding: 12 },
    errorText: { fontSize: FontSize.xs, marginTop: 4, marginLeft: 4 },
    strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    strengthBarBg: { flex: 1, height: 4, borderRadius: 2, marginRight: 8 },
    strengthBarFill: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: FontSize.xs, fontWeight: '600', width: 44, textAlign: 'right' },
    matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    matchText: { fontSize: FontSize.xs },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.lg,
        paddingHorizontal: 2,
    },
    checkbox: {
        width: 18, height: 18, borderRadius: 5, borderWidth: 2,
        justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2,
    },
    termsText: { flex: 1, lineHeight: 20 },
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
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { marginHorizontal: Spacing.md, fontSize: FontSize.sm, fontWeight: '500' },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 50,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
    },
    googleButtonText: { fontSize: FontSize.sm, fontWeight: '600' },
    verifyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
    verifySubtitle: { fontSize: FontSize.sm, marginBottom: 24, lineHeight: 20 },
    codeInput: {
        fontSize: 32,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 8,
        height: 72,
        borderWidth: 1.5,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: 16,
    },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing['2xl'] },
    footerText: { fontSize: FontSize.base },
    linkText: { fontSize: FontSize.base, fontWeight: '700' },
});
