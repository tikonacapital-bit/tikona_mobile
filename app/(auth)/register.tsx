import React, { useState, useRef, useEffect } from 'react';
import {
    View, TextInput, TouchableOpacity, Text, StyleSheet,
    ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView,
    Animated, Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { Logo } from '@/components/Logo';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSignUp, useOAuth, useClerk } from '@clerk/clerk-expo';
import { useCallback } from 'react';
import { useAlert } from '@/context/AlertContext';
import { useAuth } from '@/context/AuthContext';

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

    // Focus states
    const [nameFocused, setNameFocused] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

    // Errors
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    useWarmUpBrowser();
    const theme = useColorScheme();
    const c = Colors[theme];
    const { showAlert } = useAlert();
    const { signOut } = useAuth();

    // Clerk hooks
    const { isLoaded, signUp, setActive } = useSignUp();
    const clerk = useClerk();
    const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

    // Code verification logic
    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState('');

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
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

    const getPasswordStrength = (pwd: string): { strength: PasswordStrength; progress: number; label: string; color: string } => {
        let score = 0;
        if (pwd.length >= 6) score++;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[a-z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;

        if (score <= 2) return { strength: 'weak', progress: 0.25, label: 'Weak', color: c.danger };
        if (score <= 3) return { strength: 'fair', progress: 0.5, label: 'Fair', color: c.warning };
        if (score <= 4) return { strength: 'good', progress: 0.75, label: 'Good', color: Colors.brand.accent };
        return { strength: 'strong', progress: 1, label: 'Strong', color: c.success };
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePassword = (pwd: string): boolean => {
        return pwd.length >= 6;
    };

    const handleEmailChange = (text: string) => {
        setEmail(text);
        if (text && !validateEmail(text)) {
            setEmailError('Please enter a valid email address');
        } else {
            setEmailError('');
        }
    };

    const handlePasswordChange = (text: string) => {
        setPassword(text);
        if (text && !validatePassword(text)) {
            setPasswordError('Password must be at least 6 characters');
        } else {
            setPasswordError('');
        }
    };

    const handleConfirmPasswordChange = (text: string) => {
        setConfirmPassword(text);
        if (text && text !== password) {
            setConfirmPasswordError('Passwords do not match');
        } else {
            setConfirmPasswordError('');
        }
    };

    const animateButton = () => {
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.97, duration: 100, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
    };

    const signUpWithEmail = async () => {
        // Validation
        if (!fullName.trim()) {
            showAlert('Missing Name', 'Please enter your full name');
            return;
        }
        if (!email.trim()) {
            showAlert('Missing Email', 'Please enter your email address');
            return;
        }
        if (!validateEmail(email)) {
            showAlert('Invalid Email', 'Please enter a valid email address');
            return;
        }
        if (!password) {
            showAlert('Missing Password', 'Please enter a password');
            return;
        }
        if (password.length < 6) {
            showAlert('Weak Password', 'Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('Password Mismatch', 'Passwords do not match');
            return;
        }
        if (!agreeTerms) {
            showAlert('Terms Required', 'Please agree to the Terms of Service and Privacy Policy');
            return;
        }

        if (!isLoaded) return;
        setLoading(true);

        try {
            // Initiate the signup process with Clerk
            await signUp.create({
                emailAddress: email.trim(),
                password,
                firstName: fullName.trim(), // Storing name
            });

            // Send an email verification code
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

            setPendingVerification(true);
        } catch (err: any) {
            showAlert('Sign Up Failed', err.errors ? err.errors[0].message : err.message);
        } finally {
            setLoading(false);
        }
    };

    // Step 2 of Email Registration: Verify Code
    const onPressVerify = async () => {
        if (!isLoaded) return;
        setLoading(true);

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            });

            if (completeSignUp.status === 'complete') {
                await setActive({ session: completeSignUp.createdSessionId });
                router.replace('/');
            } else {
                console.error(JSON.stringify(completeSignUp, null, 2));
            }
        } catch (err: any) {
            showAlert('Verification Failed', err.errors ? err.errors[0].message : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        animateButton();
        signUpWithEmail();
    };

    const handleGoogleSignUp = useCallback(async () => {
        try {
            setLoading(true);

            // Pre-emptively clear any stuck Clerk client state before starting OAuth
            if (clerk.client.activeSessions.length > 0) {
                await clerk.signOut();
            }

            const { createdSessionId, setActive: setOAuthActive, signUp, signIn } = await startGoogleOAuthFlow();

            if (createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: createdSessionId });
                router.replace('/');
            } else if (signUp?.createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: signUp.createdSessionId });
                router.replace('/');
            } else if (signIn?.createdSessionId && setOAuthActive) {
                await setOAuthActive({ session: signIn.createdSessionId });
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
                showAlert('Google Sign Up Failed', message);
            }
        } finally {
            setLoading(false);
        }
    }, [startGoogleOAuthFlow, showAlert, clerk]);

    const passwordStrength = getPasswordStrength(password);
    const isFormValid =
        fullName.trim() !== '' &&
        validateEmail(email) &&
        password.length >= 6 &&
        password === confirmPassword &&
        agreeTerms;

    const renderInput = (
        label: string,
        value: string,
        onChangeText: (text: string) => void,
        icon: string,
        placeholder: string,
        focused: boolean,
        setFocused: (focused: boolean) => void,
        options: {
            isPassword?: boolean;
            showPassword?: boolean;
            setShowPassword?: (show: boolean) => void;
            error?: string;
            autoCapitalize?: 'none' | 'words' | 'characters';
            keyboardType?: 'default' | 'email-address';
            textContentType?: 'name' | 'emailAddress' | 'newPassword';
            showToggle?: boolean;
        } = {}
    ) => {
        const {
            isPassword = false,
            showPassword,
            setShowPassword,
            error,
            autoCapitalize = 'none',
            keyboardType = 'default',
            textContentType = 'none',
            showToggle = false,
        } = options;

        return (
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
                <View
                    style={[
                        styles.inputWrapper,
                        {
                            backgroundColor: c.inputBg,
                            borderColor: error ? c.danger : (focused ? Colors.brand.secondary : c.inputBorder),
                        }
                    ]}
                >
                    <View style={[styles.inputIconContainer, { backgroundColor: focused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                        <Ionicons
                            name={icon as any}
                            size={18}
                            color={focused ? Colors.brand.secondary : c.icon}
                        />
                    </View>
                    <TextInput
                        style={[styles.input, { color: c.text }]}
                        placeholder={placeholder}
                        placeholderTextColor={c.textTertiary}
                        value={value}
                        onChangeText={onChangeText}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        secureTextEntry={isPassword && !showPassword}
                        autoCapitalize={autoCapitalize}
                        keyboardType={keyboardType}
                        textContentType={textContentType}
                    />
                    {value.length > 0 && !isPassword && (
                        <TouchableOpacity
                            onPress={() => onChangeText('')}
                            style={styles.clearButton}
                        >
                            <Ionicons name="close-circle" size={20} color={c.textTertiary} />
                        </TouchableOpacity>
                    )}
                    {showToggle && (
                        <TouchableOpacity
                            onPress={() => setShowPassword?.(!showPassword)}
                            style={styles.eyeButton}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={c.icon}
                            />
                        </TouchableOpacity>
                    )}
                </View>
                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={14} color={c.danger} />
                        <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
                    </View>
                )}
            </View>
        );
    };

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
                    <View style={{ marginBottom: 10 }}>
                        <Logo size={70} fontSize={18} stacked={true} textColor="#1F4690" />
                    </View>
                    <Text style={[styles.brandTitle, { color: c.text }]}>Create Account</Text>
                    <Text style={[styles.brandSubtitle, { color: c.textSecondary }]}>
                        Join TIKONA CAPITAL today
                    </Text>
                </Animated.View>

                {/* Form Section */}
                {!pendingVerification && (
                    <View style={styles.formSection}>
                        {/* Full Name */}
                        {renderInput(
                            'Full Name',
                            fullName,
                            setFullName,
                            'person-outline',
                            'John Doe',
                            nameFocused,
                            setNameFocused,
                            { autoCapitalize: 'words', textContentType: 'name' }
                        )}

                        {/* Email */}
                        {renderInput(
                            'Email Address',
                            email,
                            handleEmailChange,
                            'mail-outline',
                            'you@example.com',
                            emailFocused,
                            setEmailFocused,
                            {
                                error: emailError,
                                keyboardType: 'email-address',
                                textContentType: 'emailAddress'
                            }
                        )}

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: c.textSecondary }]}>Password</Text>
                            <View
                                style={[
                                    styles.inputWrapper,
                                    {
                                        backgroundColor: c.inputBg,
                                        borderColor: passwordError ? c.danger : (passwordFocused ? Colors.brand.secondary : c.inputBorder),
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
                                    style={[styles.input, { color: c.text }]}
                                    placeholder="Create a password"
                                    placeholderTextColor={c.textTertiary}
                                    value={password}
                                    onChangeText={handlePasswordChange}
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                    secureTextEntry={!showPassword}
                                    textContentType="newPassword"
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

                            {/* Password Strength Indicator */}
                            {password.length > 0 && (
                                <View style={styles.strengthContainer}>
                                    <View style={styles.strengthBarBg}>
                                        <View
                                            style={[
                                                styles.strengthBarFill,
                                                {
                                                    width: `${passwordStrength.progress * 100}%`,
                                                    backgroundColor: passwordStrength.color
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                                        {passwordStrength.label}
                                    </Text>
                                </View>
                            )}

                            {passwordError && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={14} color={c.danger} />
                                    <Text style={[styles.errorText, { color: c.danger }]}>{passwordError}</Text>
                                </View>
                            )}

                            {/* Password Requirements */}
                            {password.length > 0 && (
                                <View style={styles.requirementsContainer}>
                                    <View style={styles.requirementRow}>
                                        <Ionicons
                                            name={password.length >= 6 ? "checkmark-circle" : "ellipse-outline"}
                                            size={14}
                                            color={password.length >= 6 ? c.success : c.textTertiary}
                                        />
                                        <Text style={[styles.requirementText, { color: c.textTertiary }]}>
                                            At least 6 characters
                                        </Text>
                                    </View>
                                    <View style={styles.requirementRow}>
                                        <Ionicons
                                            name={/\d/.test(password) ? "checkmark-circle" : "ellipse-outline"}
                                            size={14}
                                            color={/\d/.test(password) ? c.success : c.textTertiary}
                                        />
                                        <Text style={[styles.requirementText, { color: c.textTertiary }]}>
                                            Contains a number
                                        </Text>
                                    </View>
                                    <View style={styles.requirementRow}>
                                        <Ionicons
                                            name={/[^A-Za-z0-9]/.test(password) ? "checkmark-circle" : "ellipse-outline"}
                                            size={14}
                                            color={/[^A-Za-z0-9]/.test(password) ? c.success : c.textTertiary}
                                        />
                                        <Text style={[styles.requirementText, { color: c.textTertiary }]}>
                                            Contains a special character
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Confirm Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: c.textSecondary }]}>Confirm Password</Text>
                            <View
                                style={[
                                    styles.inputWrapper,
                                    {
                                        backgroundColor: c.inputBg,
                                        borderColor: confirmPasswordError ? c.danger : (confirmPasswordFocused ? Colors.brand.secondary : c.inputBorder),
                                    }
                                ]}
                            >
                                <View style={[styles.inputIconContainer, { backgroundColor: confirmPasswordFocused ? Colors.brand.secondary + '20' : c.borderLight }]}>
                                    <Ionicons
                                        name="shield-checkmark-outline"
                                        size={18}
                                        color={confirmPasswordFocused ? Colors.brand.secondary : c.icon}
                                    />
                                </View>
                                <TextInput
                                    style={[styles.input, { color: c.text }]}
                                    placeholder="Re-enter password"
                                    placeholderTextColor={c.textTertiary}
                                    value={confirmPassword}
                                    onChangeText={handleConfirmPasswordChange}
                                    onFocus={() => setConfirmPasswordFocused(true)}
                                    onBlur={() => setConfirmPasswordFocused(false)}
                                    secureTextEntry={!showConfirmPassword}
                                    textContentType="newPassword"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={styles.eyeButton}
                                >
                                    <Ionicons
                                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={c.icon}
                                    />
                                </TouchableOpacity>
                            </View>

                            {confirmPassword.length > 0 && (
                                <View style={styles.matchContainer}>
                                    <Ionicons
                                        name={password === confirmPassword ? "checkmark-circle" : "close-circle"}
                                        size={14}
                                        color={password === confirmPassword ? c.success : c.danger}
                                    />
                                    <Text style={[
                                        styles.matchText,
                                        { color: password === confirmPassword ? c.success : c.danger }
                                    ]}>
                                        {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                                    </Text>
                                </View>
                            )}

                            {confirmPasswordError && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={14} color={c.danger} />
                                    <Text style={[styles.errorText, { color: c.danger }]}>{confirmPasswordError}</Text>
                                </View>
                            )}
                        </View>

                        {/* Terms Checkbox */}
                        <TouchableOpacity
                            style={styles.termsContainer}
                            onPress={() => setAgreeTerms(!agreeTerms)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.checkbox,
                                {
                                    borderColor: agreeTerms ? Colors.brand.secondary : c.border,
                                    backgroundColor: agreeTerms ? Colors.brand.secondary : 'transparent'
                                }
                            ]}>
                                {agreeTerms && (
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                )}
                            </View>
                            <Text style={[styles.termsText, { color: c.textSecondary }]}>
                                I agree to the{' '}
                                <Text style={{ color: Colors.brand.secondary, fontWeight: '600' }}>Terms of Service</Text>
                                {' '}and{' '}
                                <Text style={{ color: Colors.brand.secondary, fontWeight: '600' }}>Privacy Policy</Text>
                            </Text>
                        </TouchableOpacity>

                        {/* Sign Up Button */}
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
                                        <Text style={styles.loadingText}>Creating account...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.primaryButtonText}>Create Account</Text>
                                )}
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}
                {/* Email Verification Form */}
                {pendingVerification && (
                    <View style={[styles.formSection, { marginTop: 20 }]}>
                        <View style={{ marginBottom: 20 }}>
                            <Text style={[styles.label, { color: c.textSecondary, marginBottom: 8 }]}>Verification Code</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        color: c.text,
                                        backgroundColor: c.surface,
                                        borderColor: c.border,
                                        textAlign: 'center',
                                        fontSize: 24,
                                        letterSpacing: 4
                                    }
                                ]}
                                value={code}
                                onChangeText={setCode}
                                keyboardType="numeric"
                                placeholder="000000"
                                placeholderTextColor={c.textTertiary}
                            />
                        </View>

                        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    { backgroundColor: Colors.brand.secondary }
                                ]}
                                onPress={() => {
                                    animateButton();
                                    onPressVerify();
                                }}
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
                        </Animated.View>

                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
                            <Text style={{ fontSize: FontSize.md, fontWeight: '500', color: c.textSecondary }}>
                                Didn't receive code?{' '}
                            </Text>
                            <TouchableOpacity onPress={signUpWithEmail}>
                                <Text style={{ fontSize: FontSize.md, fontWeight: '700', color: Colors.brand.secondary }}>Resend</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!pendingVerification && (
                    <>

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
                                onPress={handleGoogleSignUp}
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
                    </>
                )}

                {/* Footer */}
                <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                    <Text style={[styles.footerText, { color: c.textSecondary }]}>
                        Already have an account?{' '}
                    </Text>
                    <Link href="/(auth)/login" asChild>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={[styles.linkText, { color: Colors.brand.secondary }]}>
                                Sign In
                            </Text>
                        </TouchableOpacity>
                    </Link>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Platform.select({ ios: 50, web: 20, default: 30 }),
        paddingBottom: 30,
    },
    brandBlock: {
        alignItems: 'center',
        marginBottom: 28,
    },
    logoImage: {
        width: 56,
        height: 56,
        marginBottom: 14,
    },
    brandTitle: {
        fontSize: FontSize['2xl'],
        fontWeight: '800',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    brandSubtitle: {
        fontSize: FontSize.base,
    },
    formSection: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: BorderRadius.lg,
        paddingLeft: 0,
        height: 54,
        overflow: 'hidden',
    },
    inputIconContainer: {
        width: 44,
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
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        marginLeft: 4,
    },
    errorText: {
        fontSize: FontSize.xs,
        marginLeft: 6,
    },
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    strengthBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginRight: 10,
    },
    strengthBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        width: 50,
        textAlign: 'right',
    },
    requirementsContainer: {
        marginTop: 10,
        gap: 4,
    },
    requirementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    requirementText: {
        fontSize: FontSize.xs,
    },
    matchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 6,
    },
    matchText: {
        fontSize: FontSize.xs,
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.lg,
        paddingHorizontal: 4,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    termsText: {
        flex: 1,
        fontSize: FontSize.sm,
        lineHeight: 20,
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
        marginTop: Spacing['2xl'],
    },
    footerText: {
        fontSize: FontSize.base,
    },
    linkText: {
        fontSize: FontSize.base,
        fontWeight: '700',
    },
});
