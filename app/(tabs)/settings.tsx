import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, Pressable, Linking, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as IntentLauncher from 'expo-intent-launcher';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme, useThemeSettings } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/lib/logger';
import { useAlert } from '@/context/AlertContext';
import { Card, StatusChip, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { Switch } from 'react-native';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import type { ThemeMode } from '@/constants/theme';

function Section({ title, children, theme }: { title: string; children: React.ReactNode; theme: ThemeMode }) {
    const c = Colors[theme];
    return (
        <View style={styles.section}>
            {title ? <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>{title}</Text> : null}
            <Card theme={theme} style={styles.sectionCard}>{children}</Card>
        </View>
    );
}

function Row({ icon, label, value, onPress, danger, theme }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
    theme: ThemeMode;
}) {
    const c = Colors[theme];
    return (
        <TouchableOpacity style={[styles.row, { borderBottomColor: c.borderLight }]} onPress={onPress} activeOpacity={0.6}>
            <Ionicons name={icon} size={20} color={danger ? c.danger : Colors.brand.secondary} />
            <Text style={[styles.rowLabel, { color: danger ? c.danger : c.text }]}>{label}</Text>
            {value && <Text style={[styles.rowValue, { color: c.textTertiary }]}>{value}</Text>}
            <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
        </TouchableOpacity>
    );
}

// ── Theme Picker Options ──
const THEME_OPTIONS: Array<{ value: 'system' | 'light' | 'dark'; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }> = [
    { value: 'light', label: 'Light', icon: 'sunny', desc: 'Clean, bright interface' },
    { value: 'dark', label: 'Dark', icon: 'moon', desc: 'Easy on the eyes at night' },
    { value: 'system', label: 'System Default', icon: 'phone-portrait', desc: 'Follows your device setting' },
];

// ── Accessibility Guide Steps (Web) ──
function getAccessibilitySteps(): Array<{ title: string; desc: string; icon?: string }> {
    if (Platform.OS !== 'web') return [];

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isAndroid = ua.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(ua);

    if (isAndroid) {
        return [
            { title: 'Open Settings', desc: 'Swipe down from the top of your screen and tap the gear icon, or find Settings in your app drawer.', icon: 'settings-outline' },
            { title: 'Tap "Accessibility"', desc: 'Scroll down in Settings and look for the Accessibility option.', icon: 'accessibility-outline' },
            { title: 'Enable Features', desc: 'Turn on TalkBack, magnification, font size, display size, color correction, or any feature you need.', icon: 'checkmark-circle-outline' },
        ];
    } else if (isIOS) {
        return [
            { title: 'Open Settings', desc: 'Find the Settings app on your home screen (gray gear icon).', icon: 'settings-outline' },
            { title: 'Tap "Accessibility"', desc: 'It\u2019s listed in the third group of settings, after General.', icon: 'accessibility-outline' },
            { title: 'Enable Features', desc: 'Turn on VoiceOver, Zoom, Display & Text Size, AssistiveTouch, or any feature you need.', icon: 'checkmark-circle-outline' },
        ];
    } else {
        // Desktop browser
        return [
            { title: 'Windows', desc: 'Open Settings \u2192 Accessibility (or press Win + U).', icon: 'logo-windows' },
            { title: 'macOS', desc: 'Open System Settings \u2192 Accessibility.', icon: 'logo-apple' },
            { title: 'Browser Zoom', desc: 'Press Ctrl/Cmd + Plus (+) to increase text size, or Ctrl/Cmd + Minus (-) to decrease.', icon: 'resize-outline' },
        ];
    }
}

export default function SettingsScreen() {
    const theme = useColorScheme();
    const { themeOverride, setThemeOverride } = useThemeSettings();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { user, kyc, profile, subscription, wallet, signOut } = useAuth();
    const { showAlert } = useAlert();
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showNotifPicker, setShowNotifPicker] = useState(false);
    const [showAccessibilityGuide, setShowAccessibilityGuide] = useState(false);
    // ── Notifications Settings State ──
    const [notifSettings, setNotifSettings] = useState({
        master: true,
        reports: true,
        kyc: true,
        insights: false
    });

    const PREFS_KEY = 'notification_preferences';

    React.useEffect(() => {
        const loadSettings = async () => {
            try {
                let saved: string | null = null;
                if (Platform.OS === 'web') {
                    saved = localStorage.getItem(PREFS_KEY);
                } else {
                    saved = await SecureStore.getItemAsync(PREFS_KEY);
                }
                if (saved) setNotifSettings(JSON.parse(saved));
            } catch (e) {
                logger.warn('Failed to load settings:', e);
            }
        };
        loadSettings();
    }, []);

    const saveNotifSettings = async (newSettings: typeof notifSettings) => {
        setNotifSettings(newSettings);
        
        // If master is turned ON, register for push notifications
        if (newSettings.master && !notifSettings.master && user?.id) {
            try {
                await registerForPushNotificationsAsync(user.id);
            } catch (error) {
                logger.warn('Failed to register notifications:', error);
            }
        }

        try {
            if (Platform.OS === 'web') {
                localStorage.setItem(PREFS_KEY, JSON.stringify(newSettings));
            } else {
                await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(newSettings));
            }
        } catch (e) {
            logger.warn('Failed to save settings:', e);
        }
    };

    const displayName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Investor';
    const initial = displayName.charAt(0).toUpperCase();

    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const handleSignOut = () => {
        showAlert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all associated data. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete My Account',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Are you absolutely sure?',
                            'All your data will be permanently removed and you will be logged out immediately.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Yes, Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                        setIsDeletingAccount(true);
                                        try {
                                            await supabase.functions.invoke('delete-account', { method: 'POST' });
                                        } catch (err: any) {
                                            logger.warn('Delete-account function error (non-fatal):', err);
                                            // Continue to sign out even if the function errors —
                                            // the account may already be deleted.
                                        } finally {
                                            // Always force-clear local session, which triggers
                                            // the auth guard in _layout.tsx to redirect to login.
                                            try { await signOut(); } catch (_) { }
                                            setIsDeletingAccount(false);
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    const handleOpenAccessibilitySettings = async () => {
        try {
            if (Platform.OS === 'android') {
                await IntentLauncher.startActivityAsync(
                    IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS
                );
            } else if (Platform.OS === 'ios') {
                // Deep-link into iOS Settings → Accessibility
                await Linking.openURL('App-Prefs:ACCESSIBILITY');
            } else {
                // Web: show a rich modal with step-by-step instructions
                setShowAccessibilityGuide(true);
            }
        } catch (error) {
            logger.warn('Failed to open accessibility settings:', error);
            showAlert(
                'Unable to Open Settings',
                'Please manually open your device\'s Settings app and navigate to Accessibility.',
                [{ text: 'OK' }]
            );
        }
    };

    const themeLabel = themeOverride === 'system' ? 'System' : themeOverride === 'dark' ? 'Dark' : 'Light';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <ResponsiveScrollView style={[styles.container, { backgroundColor: c.background }]}>
                {/* Profile Header */}
                <View style={[styles.profileHeader, { backgroundColor: isDark ? Colors.brand.primary : c.surface, borderBottomWidth: isDark ? 0 : 1, borderBottomColor: c.border }]}>
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarRing, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : c.border }, kyc?.status === 'approved' && styles.avatarRingVerified]}>
                            {user?.imageUrl ? (
                                <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : Colors.brand.primary + '10' }]}>
                                    <Text style={[styles.avatarText, { color: isDark ? '#fff' : Colors.brand.primary }]}>{initial}</Text>
                                </View>
                            )}
                        </View>
                        {kyc?.status === 'approved' && (
                            <View style={[styles.verifiedBadge, { backgroundColor: isDark ? Colors.brand.primary : c.surface }]}>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.brand.accent} />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.name, { color: isDark ? '#fff' : c.text }]}>{displayName}</Text>
                    <Text style={[styles.email, { color: isDark ? 'rgba(255,255,255,0.6)' : c.textSecondary }]}>{user?.primaryEmailAddress?.emailAddress}</Text>
                    <View style={styles.statusPills}>
                        <StatusChip
                            label={kyc?.status === 'approved' ? '✓ KYC Verified' : kyc?.status === 'pending' ? '⏳ Pending' : '✗ KYC Required'}
                            variant={kyc?.status === 'approved' ? 'success' : kyc?.status === 'pending' ? 'warning' : 'danger'}
                            theme={theme}
                        />
                        {profile && (
                            <StatusChip label={`${profile.display_label || profile.risk_profile}`} variant="info" theme={theme} />
                        )}
                    </View>
                </View>

                <Section title="ACCOUNT" theme={theme}>
                    <Row theme={theme} icon="flash-outline" label="AI Credits" value={`${((wallet?.credits_balance ?? 0) >= 1000000 ? `${((wallet?.credits_balance ?? 0) / 1000000).toFixed(1)}M` : (wallet?.credits_balance ?? 0) >= 1000 ? `${Math.round((wallet?.credits_balance ?? 0) / 1000)}K` : (wallet?.credits_balance ?? 0))} remaining`} onPress={() => router.push('/buy-credits' as any)} />
                    <Row theme={theme} icon="shield-checkmark" label="KYC Verification" value={kyc?.status || 'Not Done'} onPress={() => router.push('/(kyc)')} />
                    <Row theme={theme} icon="bar-chart" label="Risk Profile" value={profile?.display_label || profile?.risk_profile || 'Not Set'} onPress={() => router.push('/(profiling)')} />
                    <Row theme={theme} icon="diamond" label="Subscription" value={(subscription?.plan || 'None').charAt(0).toUpperCase() + (subscription?.plan || 'None').slice(1)} onPress={() => router.push('/subscription')} />
                    {subscription?.is_active && (
                        <Row theme={theme} icon="arrow-undo" label="Request Refund" onPress={() => router.push('/refund' as any)} />
                    )}
                </Section>

                <Section title="PREFERENCES" theme={theme}>
                    <Row theme={theme} icon="notifications-outline" label="Notifications" value={notifSettings.master ? 'On' : 'Off'} onPress={() => setShowNotifPicker(true)} />
                    <Row theme={theme} icon="moon-outline" label="Appearance" value={themeLabel} onPress={() => setShowThemePicker(true)} />
                    <Row theme={theme} icon="accessibility-outline" label="Accessibility" onPress={handleOpenAccessibilitySettings} />
                    <Row theme={theme} icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/support')} />
                </Section>

                <Section title="LEGAL" theme={theme}>
                    <Row theme={theme} icon="document-text-outline" label="Terms of Service" onPress={() => Linking.openURL('https://www.tikonacapital.com/terms-of-service')} />
                    <Row theme={theme} icon="shield-outline" label="Privacy Policy" onPress={() => Linking.openURL('https://www.tikonacapital.com/privacy-policy')} />
                </Section>

                <Section title="" theme={theme}>
                    <Row theme={theme} icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger />
                    {isDeletingAccount ? (
                        <View style={[styles.row, { borderBottomColor: Colors[theme].borderLight, justifyContent: 'center' }]}>
                            <ActivityIndicator size="small" color={Colors[theme].danger} />
                            <Text style={[styles.rowLabel, { color: Colors[theme].danger, flex: 0, marginLeft: 8 }]}>Deleting account...</Text>
                        </View>
                    ) : (
                        <Row theme={theme} icon="trash-outline" label="Delete Account" onPress={handleDeleteAccount} danger />
                    )}
                </Section>

                <View style={{ height: 40 }} />
            </ResponsiveScrollView>

            {/* ── Theme Picker Bottom Sheet ── */}
            <Modal
                visible={showThemePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowThemePicker(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowThemePicker(false)}>
                    <Pressable style={[styles.modalSheet, { backgroundColor: c.surface }]} onPress={() => { }}>
                        {/* Handle bar */}
                        <View style={styles.modalHandle}>
                            <View style={[styles.modalHandleBar, { backgroundColor: c.border }]} />
                        </View>

                        <Text style={[styles.modalTitle, { color: c.text }]}>Appearance</Text>
                        <Text style={[styles.modalSubtitle, { color: c.textSecondary }]}>Choose how Tikona looks on your device</Text>

                        <View style={styles.themeOptions}>
                            {THEME_OPTIONS.map((opt) => {
                                const isSelected = themeOverride === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[
                                            styles.themeOption,
                                            { backgroundColor: c.background, borderColor: isSelected ? Colors.brand.secondary : c.border },
                                            isSelected && { borderWidth: 2 },
                                        ]}
                                        onPress={() => {
                                            setThemeOverride(opt.value);
                                            setShowThemePicker(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.themeOptionIcon, { backgroundColor: isSelected ? Colors.brand.secondary + '15' : c.borderLight }]}>
                                            <Ionicons name={opt.icon} size={22} color={isSelected ? Colors.brand.secondary : c.textTertiary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.themeOptionLabel, { color: c.text }]}>{opt.label}</Text>
                                            <Text style={[styles.themeOptionDesc, { color: c.textTertiary }]}>{opt.desc}</Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={22} color={Colors.brand.secondary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={[styles.modalDoneBtn, { backgroundColor: c.background }]}
                            onPress={() => setShowThemePicker(false)}
                        >
                            <Text style={[styles.modalDoneBtnText, { color: c.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── Notifications Settings Modal ── */}
            <Modal
                visible={showNotifPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowNotifPicker(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowNotifPicker(false)}>
                    <Pressable style={[styles.modalSheet, { backgroundColor: c.surface }]} onPress={() => { }}>
                        <View style={styles.modalHandle}>
                            <View style={[styles.modalHandleBar, { backgroundColor: c.border }]} />
                        </View>

                        <Text style={[styles.modalTitle, { color: c.text }]}>Notifications</Text>
                        <Text style={[styles.modalSubtitle, { color: c.textSecondary }]}>Manage how and when you receive alerts</Text>

                        <View style={styles.themeOptions}>
                            {/* Master Toggle */}
                            <View style={[styles.notifRow, { borderBottomColor: c.borderLight, marginBottom: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.notifLabel, { color: c.text }]}>Allow Notifications</Text>
                                    <Text style={[styles.notifDesc, { color: c.textTertiary }]}>Master switch for all push alerts</Text>
                                </View>
                                <Switch
                                    value={notifSettings.master}
                                    onValueChange={(v) => saveNotifSettings({ ...notifSettings, master: v })}
                                    trackColor={{ false: c.border, true: Colors.brand.secondary }}
                                    thumbColor="#fff"
                                />
                            </View>

                            {/* Specific Settings */}
                            <View style={{ opacity: notifSettings.master ? 1 : 0.5 }}>
                                <NotifToggle
                                    label="New Research Reports"
                                    desc="Alerts when new reports are assigned to you"
                                    value={notifSettings.reports}
                                    onToggle={(v) => saveNotifSettings({ ...notifSettings, reports: v })}
                                    disabled={!notifSettings.master}
                                    theme={theme}
                                />
                                <NotifToggle
                                    label="Account & Security"
                                    desc="KYC updates and security reminders"
                                    value={notifSettings.kyc}
                                    onToggle={(v) => saveNotifSettings({ ...notifSettings, kyc: v })}
                                    disabled={!notifSettings.master}
                                    theme={theme}
                                />
                                <NotifToggle
                                    label="Daily Strategy Insights"
                                    desc="Morning briefings and market summaries"
                                    value={notifSettings.insights}
                                    onToggle={(v) => saveNotifSettings({ ...notifSettings, insights: v })}
                                    disabled={!notifSettings.master}
                                    theme={theme}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.modalDoneBtn, { backgroundColor: Colors.brand.secondary }]}
                            onPress={() => setShowNotifPicker(false)}
                        >
                            <Text style={[styles.modalDoneBtnText, { color: '#fff' }]}>Done</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── Accessibility Guide Modal (Web) ── */}
            <Modal
                visible={showAccessibilityGuide}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAccessibilityGuide(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowAccessibilityGuide(false)}>
                    <Pressable style={[styles.modalSheet, { backgroundColor: c.surface }]} onPress={() => { }}>
                        <View style={styles.modalHandle}>
                            <View style={[styles.modalHandleBar, { backgroundColor: c.border }]} />
                        </View>

                        {/* Header with icon */}
                        <View style={a11yStyles.header}>
                            <View style={[a11yStyles.iconContainer, { backgroundColor: Colors.brand.secondary + '15' }]}>
                                <Ionicons name="accessibility" size={32} color={Colors.brand.secondary} />
                            </View>
                            <Text style={[styles.modalTitle, { color: c.text }]}>Accessibility Settings</Text>
                            <Text style={[styles.modalSubtitle, { color: c.textSecondary }]}>
                                Follow these steps to enable accessibility features on your device
                            </Text>
                        </View>

                        {/* Steps */}
                        <View style={a11yStyles.steps}>
                            {getAccessibilitySteps().map((step: { title: string; desc: string; icon?: string }, index: number) => (
                                <View key={index} style={[a11yStyles.step, { borderBottomColor: c.borderLight }]}>
                                    <View style={[a11yStyles.stepBadge, { backgroundColor: Colors.brand.secondary }]}>
                                        <Text style={a11yStyles.stepBadgeText}>{index + 1}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[a11yStyles.stepTitle, { color: c.text }]}>{step.title}</Text>
                                        <Text style={[a11yStyles.stepDesc, { color: c.textTertiary }]}>{step.desc}</Text>
                                    </View>
                                    {step.icon && <Ionicons name={step.icon as any} size={20} color={c.textTertiary} />}
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.modalDoneBtn, { backgroundColor: Colors.brand.secondary }]}
                            onPress={() => setShowAccessibilityGuide(false)}
                        >
                            <Text style={[styles.modalDoneBtnText, { color: '#fff' }]}>Got it</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

function NotifToggle({ label, desc, value, onToggle, disabled, theme }: {
    label: string,
    desc: string,
    value: boolean,
    onToggle: (v: boolean) => void,
    disabled: boolean,
    theme: ThemeMode
}) {
    const c = Colors[theme];
    return (
        <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.notifLabelSmall, { color: c.text }]}>{label}</Text>
                <Text style={[styles.notifDesc, { color: c.textTertiary }]}>{desc}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                disabled={disabled}
                trackColor={{ false: c.border, true: Colors.brand.secondary + '80' }}
                thumbColor={value ? Colors.brand.secondary : '#f4f3f4'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    profileHeader: {
        alignItems: 'center',
        paddingTop: Platform.select({ ios: 66, web: 24, default: 52 }),
        paddingBottom: Spacing['3xl'],
        borderBottomLeftRadius: BorderRadius['2xl'],
        borderBottomRightRadius: BorderRadius['2xl'],
        marginBottom: Spacing.xl,
    },
    avatarContainer: { position: 'relative', marginBottom: Spacing.md },
    avatarRing: { borderRadius: 22, padding: 3, borderWidth: 2.5 },
    avatarRingVerified: { borderColor: Colors.brand.accent },
    avatarImage: { width: 72, height: 72, borderRadius: 20 },
    avatarFallback: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 30, fontWeight: '700' },
    verifiedBadge: { position: 'absolute', bottom: 0, right: 0, borderRadius: 12 },
    name: { fontSize: FontSize.xl, fontWeight: '700' },
    email: { fontSize: FontSize.sm, marginTop: 2 },
    statusPills: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
    section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    sectionTitle: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: Spacing.sm, marginLeft: 4 },
    sectionCard: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, gap: Spacing.md },
    rowLabel: { fontSize: FontSize.base, fontWeight: '500', flex: 1 },
    rowValue: { fontSize: FontSize.sm },

    // ── Modal / Bottom Sheet ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        ...(Platform.OS === 'web' ? { alignItems: 'center' } as any : {}),
    },
    modalSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: Spacing['2xl'],
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        ...(Platform.OS === 'web' ? {
            maxWidth: 480,
            width: '100%',
            borderRadius: 24,
            marginBottom: 24,
        } as any : {}),
    },
    modalHandle: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    modalHandleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: FontSize.sm,
        marginBottom: Spacing.xl,
    },
    themeOptions: {
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        gap: Spacing.md,
    },
    themeOptionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    themeOptionLabel: {
        fontSize: FontSize.base,
        fontWeight: '600',
        marginBottom: 2,
    },
    themeOptionDesc: {
        fontSize: FontSize.xs,
    },
    modalDoneBtn: {
        height: 48,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalDoneBtnText: {
        fontSize: FontSize.base,
        fontWeight: '600',
    },
    notifRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: Spacing.md,
    },
    notifLabel: {
        fontSize: FontSize.lg,
        fontWeight: '700',
    },
    notifLabelSmall: {
        fontSize: FontSize.base,
        fontWeight: '600',
        marginBottom: 2,
    },
    notifDesc: {
        fontSize: FontSize.xs,
        lineHeight: 16,
    },
});

const a11yStyles = StyleSheet.create({
    header: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    steps: {
        gap: 4,
        marginBottom: Spacing.xl,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        gap: Spacing.md,
    },
    stepBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepBadgeText: {
        color: '#fff',
        fontSize: FontSize.sm,
        fontWeight: '700',
    },
    stepTitle: {
        fontSize: FontSize.base,
        fontWeight: '600',
        marginBottom: 2,
    },
    stepDesc: {
        fontSize: FontSize.xs,
        lineHeight: 16,
    },
});
