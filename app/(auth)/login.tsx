import React, { useState, useRef } from 'react';
import {
    View, TextInput, TouchableOpacity, Text, StyleSheet,
    ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView,
    Animated, Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSignIn, useOAuth, useClerk } from '@clerk/clerk-expo';
import { useCallback } from 'react';
import { useAlert } from '@/context/AlertContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

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

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    useWarmUpBrowser();
    const theme = useColorScheme();
    const c = Colors[theme];
    const { showAlert } = useAlert();
    const { signOut } = useAuth();

    // Clerk hooks
    const { signIn, setActive, isLoaded } = useSignIn();
    const clerk = useClerk();
    const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSignIn = async () => {
        if (!email.trim()) {
            showAlert('Missing Email', 'Please enter your email address.');
            return;
        }
        if (!validateEmail(email)) {
            showAlert('Invalid Email', 'Please enter a valid email address.');
            return;
        }
        if (!password) {
            showAlert('Missing Password', 'Please enter your password.');
            return;
        }

        if (!isLoaded) return;
        setLoading(true);

        try {
            const result = await signIn.create({
                identifier: email.trim(),
                password,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                router.replace('/');
            } else {
                console.log(result);
                showAlert('Sign In Info', 'Require further action to complete sign in.');
            }
        } catch (err: any) {
            showAlert('Sign In Failed', err.errors ? err.errors[0].message : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = useCallback(async () => {
        try {
            setLoading(true);

            // Pre-emptively clear any stuck Clerk client state before starting OAuth
            if (clerk.client.activeSessions.length > 0) {
                await clerk.signOut();
            }

            const { createdSessionId, setActive: setOAuthActive, signUp, signIn: oauthSignIn } = await startGoogleOAuthFlow();

            if (createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: createdSessionId });
                router.replace('/');
            } else if (oauthSignIn?.createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: oauthSignIn.createdSessionId });
                router.replace('/');
            } else if (signUp?.createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: signUp.createdSessionId });
                router.replace('/');
            } else {
                if (signUp?.status === 'missing_requirements') {
                    showAlert('Registration Incomplete', 'Your account requires more information. Please sign up via email.');
                }
            }
        } catch (err: any) {
            const message = err?.errors?.[0]?.message ?? err?.message ?? 'An unknown error occurred';
            if (message.toLowerCase().includes('session already exists')) {
                router.replace('/');
            } else {
                showAlert('Google Sign In Failed', message);
            }
        } finally {
            setLoading(false);
        }
    }, [startGoogleOAuthFlow, showAlert, clerk]);

    const animateButton = () => {
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
    };

    const handleSubmit = () => {
        animateButton();
        handleSignIn();
    };

    const isFormValid = email.trim() !== '' && password !== '';

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={[
                    styles.container,
                    { backgroundColor: c.background },
                    Platform.OS === 'web' && { maxWidth: 440, width: '100%', alignSelf: 'center' as const },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Animated Brand Section */}
                <Animated.View
                    style={[
                        styles.brandBlock,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={{ marginBottom: 12 }}>
                        <Logo size={64} fontSize={22} />
                    </View>
                    <Text style={[styles.brandSubtitle, { color: c.textSecondary }]}>
                        Welcome back! Sign in to continue
                    </Text>
                </Animated.View>

                {/* Form Section */}
                <View style={styles.formSection}>
                    {/* Email Input */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: c.textSecondary }]}>Email Address</Text>
                        <View
                            style={[
                                styles.inputWrapper,
                                {
                                    backgroundColor: c.inputBg,
                                    borderColor: emailFocused ? Colors.brand.secondary : c.inputBorder,
                                }
                            ]}
                        >
                            <View style={[styles.inputIconContainer, { backgroundColor: emailFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                                <Ionicons
                                    name="mail-outline"
                                    size={18}
                                    color={emailFocused ? Colors.brand.secondary : c.icon}
                                />
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
                                    <Ionicons name="close-circle" size={20} color={c.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={[styles.label, { color: c.textSecondary }]}>Password</Text>
                            <TouchableOpacity onPress={() => showAlert('Reset Password', 'Password reset functionality will be available soon.')}>
                                <Text style={[styles.forgotText, { color: Colors.brand.secondary }]}>
                                    Forgot?
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View
                            style={[
                                styles.inputWrapper,
                                {
                                    backgroundColor: c.inputBg,
                                    borderColor: passwordFocused ? Colors.brand.secondary : c.inputBorder,
                                }
                            ]}
                        >
                            <View style={[styles.inputIconContainer, { backgroundColor: passwordFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={18}
                                    color={passwordFocused ? Colors.brand.secondary : c.icon}
                                />
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
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeButton}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={c.icon}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Remember Me & Forgot Row */}
                    <View style={styles.optionsRow}>
                        <TouchableOpacity
                            style={styles.rememberMeContainer}
                            onPress={() => setRememberMe(!rememberMe)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.checkbox,
                                {
                                    borderColor: rememberMe ? Colors.brand.secondary : c.border,
                                    backgroundColor: rememberMe ? Colors.brand.secondary : 'transparent'
                                }
                            ]}>
                                {rememberMe && (
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                )}
                            </View>
                            <Text style={[styles.rememberMeText, { color: c.textSecondary }]}>
                                Remember me
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Sign In Button */}
                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                {
                                    backgroundColor: isFormValid ? Colors.brand.primary : c.border,
                                }
                            ]}
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
                    <View style={styles.dividerRow}>
                        <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                        <Text style={[styles.dividerText, { color: c.textTertiary }]}>or continue with</Text>
                        <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                    </View>

                    {/* Social Login Buttons */}
                    <View style={styles.socialButtonsRow}>
                        <TouchableOpacity
                            style={[styles.socialButton, { backgroundColor: c.surface, borderColor: c.border }]}
                            onPress={handleGoogleSignIn}
                            disabled={loading}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="logo-google" size={22} color="#DB4437" />
                        </TouchableOpacity>

                        {Platform.OS === 'ios' && (
                            <TouchableOpacity
                                style={[styles.socialButton, { backgroundColor: c.surface, borderColor: c.border }]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="logo-apple" size={22} color={c.text} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Footer */}
                <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                    <Text style={[styles.footerText, { color: c.textSecondary }]}>
                        Don't have an account?{' '}
                    </Text>
                    <Link href="/(auth)/register" asChild>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={[styles.linkText, { color: Colors.brand.secondary }]}>
                                Create Account
                            </Text>
                        </TouchableOpacity>
                    </Link>
                </Animated.View>

                {/* Terms Footer */}
                <Text style={[styles.termsText, { color: c.textTertiary }]}>
                    By signing in, you agree to our{' '}
                    <Text style={{ color: Colors.brand.secondary }}>Terms of Service</Text>
                    {' '}and{' '}
                    <Text style={{ color: Colors.brand.secondary }}>Privacy Policy</Text>
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Platform.select({ ios: 60, web: 20, default: 40 }),
        paddingBottom: 30,
    },
    brandBlock: {
        alignItems: 'center',
        marginBottom: 36,
    },
    logoImage: {
        width: 64,
        height: 64,
        marginBottom: 16,
    },
    brandTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        letterSpacing: 3,
        marginBottom: 8,
    },
    brandSubtitle: {
        fontSize: FontSize.base,
        textAlign: 'center',
    },
    formSection: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginBottom: 8,
    },
    forgotText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: BorderRadius.lg,
        paddingLeft: 0,
        height: 56,
        overflow: 'hidden',
    },
    inputIconContainer: {
        width: 48,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: BorderRadius.lg,
        borderBottomLeftRadius: BorderRadius.lg,
    },
    input: {
        flex: 1,
        fontSize: FontSize.base,
        paddingHorizontal: 12,
        height: '100%',
    },
    clearButton: {
        padding: 8,
        marginRight: 4,
    },
    eyeButton: {
        padding: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    rememberMeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    rememberMeText: {
        fontSize: FontSize.sm,
        fontWeight: '500',
    },
    primaryButton: {
        height: 56,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    loadingText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xl,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: Spacing.md,
        fontSize: FontSize.sm,
        fontWeight: '500',
    },
    socialButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    socialButton: {
        width: 56,
        height: 56,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing['3xl'],
    },
    footerText: {
        fontSize: FontSize.base,
    },
    linkText: {
        fontSize: FontSize.base,
        fontWeight: '700',
    },
    termsText: {
        fontSize: FontSize.xs,
        textAlign: 'center',
        marginTop: Spacing.xl,
        lineHeight: 18,
    },
});
