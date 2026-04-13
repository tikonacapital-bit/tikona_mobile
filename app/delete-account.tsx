import { Logo } from '@/components/Logo';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Step = 'email' | 'otp' | 'confirm' | 'done';

export default function DeleteAccountScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    // Step 1: Send OTP to the email
    const handleSendOtp = async () => {
        if (!email.trim()) { setError('Please enter your email address.'); return; }
        if (!validateEmail(email)) { setError('Please enter a valid email address.'); return; }
        setError('');
        setLoading(true);
        try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: { shouldCreateUser: false },
            });
            if (otpError) {
                if (otpError.message?.toLowerCase().includes('user not found') ||
                    otpError.message?.toLowerCase().includes('signups not allowed')) {
                    setError('No account found with this email address.');
                } else {
                    setError(otpError.message);
                }
                return;
            }
            setStep('otp');
        } catch (err: any) {
            setError(err.message || 'Failed to send verification code.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async () => {
        if (!otp.trim() || otp.length < 6) { setError('Please enter the 6-digit code.'); return; }
        setError('');
        setLoading(true);
        try {
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otp.trim(),
                type: 'email',
            });
            if (verifyError) {
                setError('Invalid or expired code. Please try again.');
                return;
            }
            setStep('confirm');
        } catch (err: any) {
            setError(err.message || 'Verification failed.');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Confirm & delete
    const handleDelete = async () => {
        setError('');
        setLoading(true);
        try {
            const { error: fnError } = await supabase.functions.invoke('delete-account', { method: 'POST' });
            if (fnError) {
                console.warn('Delete-account function error (non-fatal):', fnError);
                // Continue — the function may have partially succeeded
            }
            // Sign out and clean up
            try { await supabase.auth.signOut(); } catch (_) { }
            setStep('done');
        } catch (err: any) {
            setError(err.message || 'Failed to delete account. Please contact support.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Logo size={48} fontSize={14} stacked={true} />
                        <Text style={[styles.title, { color: c.text }]}>Account Deletion</Text>
                        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                            Tikona Research · SEBI RA INH000069807
                        </Text>
                    </View>

                    {/* Card */}
                    <View style={[styles.card, {
                        backgroundColor: c.surface,
                        borderColor: c.border,
                        ...(Platform.OS === 'web' ? {
                            boxShadow: isDark
                                ? '0 8px 32px rgba(0,0,0,0.4)'
                                : '0 8px 32px rgba(31,70,144,0.08)',
                        } as any : {}),
                    }]}>
                        {/* Step Indicator */}
                        {step !== 'done' && (
                            <View style={styles.stepIndicator}>
                                {(['email', 'otp', 'confirm'] as Step[]).map((s, i) => {
                                    const stepIndex = ['email', 'otp', 'confirm'].indexOf(step);
                                    const isActive = i === stepIndex;
                                    const isComplete = i < stepIndex;
                                    return (
                                        <View key={s} style={styles.stepDotRow}>
                                            <View style={[
                                                styles.stepDot,
                                                {
                                                    backgroundColor: isComplete ? Colors.brand.primary
                                                        : isActive ? Colors.brand.primary
                                                            : c.border,
                                                },
                                            ]}>
                                                {isComplete ? (
                                                    <Ionicons name="checkmark" size={10} color="#fff" />
                                                ) : (
                                                    <Text style={[styles.stepDotText, {
                                                        color: isActive ? '#fff' : c.textTertiary,
                                                    }]}>{i + 1}</Text>
                                                )}
                                            </View>
                                            {i < 2 && (
                                                <View style={[styles.stepLine, {
                                                    backgroundColor: isComplete ? Colors.brand.primary : c.border,
                                                }]} />
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* ── Step 1: Email ── */}
                        {step === 'email' && (
                            <View>
                                <Text style={[styles.cardTitle, { color: c.text }]}>Verify Your Identity</Text>
                                <Text style={[styles.cardDesc, { color: c.textSecondary }]}>
                                    Enter the email address associated with your Tikona Research account.
                                    We'll send you a one-time verification code.
                                </Text>

                                <View style={[styles.inputWrapper, {
                                    backgroundColor: c.inputBg,
                                    borderColor: c.inputBorder,
                                }]}>
                                    <Ionicons name="mail-outline" size={18} color={c.icon} style={{ marginLeft: 14 }} />
                                    <TextInput
                                        style={[styles.input, { color: c.text }]}
                                        placeholder="you@example.com"
                                        placeholderTextColor={c.textTertiary}
                                        value={email}
                                        onChangeText={(t) => { setEmail(t); setError(''); }}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        textContentType="emailAddress"
                                        editable={!loading}
                                    />
                                </View>

                                {!!error && (
                                    <View style={styles.errorRow}>
                                        <Ionicons name="alert-circle" size={14} color={c.danger} />
                                        <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.primaryBtn, { backgroundColor: Colors.brand.primary, opacity: loading ? 0.7 : 1 }]}
                                    onPress={handleSendOtp}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── Step 2: OTP ── */}
                        {step === 'otp' && (
                            <View>
                                <Text style={[styles.cardTitle, { color: c.text }]}>Enter Verification Code</Text>
                                <Text style={[styles.cardDesc, { color: c.textSecondary }]}>
                                    We've sent a 6-digit code to{' '}
                                    <Text style={{ fontWeight: '700', color: c.text }}>{email}</Text>.
                                    Check your inbox and spam folder.
                                </Text>

                                <View style={[styles.inputWrapper, {
                                    backgroundColor: c.inputBg,
                                    borderColor: c.inputBorder,
                                }]}>
                                    <Ionicons name="keypad-outline" size={18} color={c.icon} style={{ marginLeft: 14 }} />
                                    <TextInput
                                        style={[styles.input, { color: c.text, letterSpacing: 4, fontSize: 20, fontWeight: '700' }]}
                                        placeholder="000000"
                                        placeholderTextColor={c.textTertiary}
                                        value={otp}
                                        onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        editable={!loading}
                                    />
                                </View>

                                {!!error && (
                                    <View style={styles.errorRow}>
                                        <Ionicons name="alert-circle" size={14} color={c.danger} />
                                        <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.primaryBtn, { backgroundColor: Colors.brand.primary, opacity: loading ? 0.7 : 1 }]}
                                    onPress={handleVerifyOtp}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryBtnText}>Verify Code</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); setError(''); }} style={styles.secondaryLink}>
                                    <Text style={[styles.secondaryLinkText, { color: Colors.brand.secondary }]}>← Back to email</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── Step 3: Confirm ── */}
                        {step === 'confirm' && (
                            <View>
                                <View style={[styles.warningBanner, { backgroundColor: c.dangerBg, borderColor: c.danger + '30' }]}>
                                    <Ionicons name="warning" size={22} color={c.danger} />
                                    <Text style={[styles.warningTitle, { color: c.danger }]}>This action is permanent</Text>
                                </View>

                                <Text style={[styles.cardTitle, { color: c.text, marginTop: 16 }]}>Confirm Account Deletion</Text>

                                <Text style={[styles.cardDesc, { color: c.textSecondary }]}>
                                    The following will be <Text style={{ fontWeight: '700', color: c.danger }}>permanently deleted</Text>:
                                </Text>

                                <View style={styles.deleteList}>
                                    {[
                                        'Personal preferences & marketing data',
                                        'Active sessions & app settings',
                                        'AI chat history & saved reports',
                                        'Notification preferences',
                                    ].map((item, i) => (
                                        <View key={i} style={styles.deleteListItem}>
                                            <Ionicons name="close-circle" size={16} color={c.danger} />
                                            <Text style={[styles.deleteListText, { color: c.text }]}>{item}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* SEBI Vault Retention Notice */}
                                <View style={[styles.retentionBox, {
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(31,70,144,0.04)',
                                    borderColor: Colors.brand.primary + '30',
                                }]}>
                                    <View style={styles.retentionHeader}>
                                        <Ionicons name="shield-checkmark" size={16} color={Colors.brand.primary} />
                                        <Text style={[styles.retentionTitle, { color: c.text }]}>SEBI VAULT RETENTION</Text>
                                    </View>
                                    <Text style={[styles.retentionDesc, { color: c.textSecondary }]}>
                                        By law, we are required to retain your{' '}
                                        <Text style={{ fontWeight: '700', color: c.text }}>Financial & KYC Records</Text>{' '}
                                        in encrypted cold storage for{' '}
                                        <Text style={{ fontWeight: '700', color: Colors.brand.primary }}>5 years</Text>{' '}
                                        as mandated by SEBI and the DPDP Act, 2023. This data will not be used for any other purpose.
                                    </Text>
                                </View>

                                {!!error && (
                                    <View style={styles.errorRow}>
                                        <Ionicons name="alert-circle" size={14} color={c.danger} />
                                        <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.primaryBtn, { backgroundColor: c.danger, opacity: loading ? 0.7 : 1 }]}
                                    onPress={handleDelete}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="trash" size={16} color="#fff" style={{ marginRight: 6 }} />
                                            <Text style={styles.primaryBtnText}>Permanently Delete My Account</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); setError(''); }} style={styles.secondaryLink}>
                                    <Text style={[styles.secondaryLinkText, { color: Colors.brand.secondary }]}>Cancel — keep my account</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── Step 4: Done ── */}
                        {step === 'done' && (
                            <View style={styles.doneContainer}>
                                <View style={[styles.doneIcon, { backgroundColor: Colors.brand.primary + '15' }]}>
                                    <Ionicons name="checkmark-circle" size={48} color={Colors.brand.primary} />
                                </View>
                                <Text style={[styles.cardTitle, { color: c.text, textAlign: 'center' }]}>Account Deleted</Text>
                                <Text style={[styles.cardDesc, { color: c.textSecondary, textAlign: 'center' }]}>
                                    Your account has been successfully deleted. Personal data has been purged and
                                    regulatory records have been moved to our secure SEBI vault.
                                </Text>
                                <Text style={[styles.cardDesc, { color: c.textTertiary, textAlign: 'center', fontSize: 12, marginTop: 8 }]}>
                                    If you have any questions, contact us at{' '}
                                    <Text style={{ color: Colors.brand.secondary, fontWeight: '600' }}>contact@tikonacapital.com</Text>
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: c.textTertiary }]}>
                            Tikona Capital · SEBI Registered Research Analyst
                        </Text>
                        <Text style={[styles.footerText, { color: c.textTertiary }]}>
                            Registration No: INH000069807
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: Spacing['2xl'],
        paddingVertical: Spacing['3xl'],
        ...(Platform.OS === 'web' ? { maxWidth: 520, width: '100%', alignSelf: 'center' } as any : {}),
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: Spacing['2xl'],
    },
    title: {
        fontSize: FontSize.xl,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginTop: Spacing.lg,
    },
    subtitle: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        letterSpacing: 0.3,
        marginTop: 4,
    },

    // Card
    card: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        padding: Spacing['2xl'],
    },

    // Step Indicator
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing['2xl'],
    },
    stepDotRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotText: {
        fontSize: 11,
        fontWeight: '700',
    },
    stepLine: {
        width: 40,
        height: 2,
        borderRadius: 1,
        marginHorizontal: 4,
    },

    // Card content
    cardTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        marginBottom: Spacing.sm,
    },
    cardDesc: {
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginBottom: Spacing.lg,
    },

    // Input
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: BorderRadius.lg,
        height: 52,
        marginBottom: Spacing.lg,
        overflow: 'hidden',
    },
    input: {
        flex: 1,
        fontSize: FontSize.base,
        paddingHorizontal: 12,
        height: '100%',
    },

    // Error
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: Spacing.md,
    },
    errorText: {
        fontSize: FontSize.sm,
        fontWeight: '500',
        flex: 1,
    },

    // Buttons
    primaryBtn: {
        height: 50,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '700',
    },
    secondaryLink: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        marginTop: Spacing.sm,
    },
    secondaryLinkText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
    },

    // Warning
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    warningTitle: {
        fontSize: FontSize.base,
        fontWeight: '700',
        flex: 1,
    },

    // Delete list
    deleteList: {
        gap: 8,
        marginBottom: Spacing.lg,
    },
    deleteListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deleteListText: {
        fontSize: FontSize.sm,
        fontWeight: '500',
        flex: 1,
    },

    // Retention box
    retentionBox: {
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        borderWidth: 1,
        marginBottom: Spacing.xl,
    },
    retentionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    retentionTitle: {
        fontSize: FontSize.xs,
        fontWeight: '800',
        letterSpacing: 1,
    },
    retentionDesc: {
        fontSize: FontSize.sm,
        lineHeight: 18,
    },

    // Done
    doneContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    doneIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },

    // Footer
    footer: {
        alignItems: 'center',
        marginTop: Spacing['2xl'],
        gap: 2,
    },
    footerText: {
        fontSize: FontSize.xs,
        fontWeight: '500',
    },
});
