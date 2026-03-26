import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, Pressable } from 'react-native';
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

export default function SettingsScreen() {
    const theme = useColorScheme();
    const { themeOverride, setThemeOverride } = useThemeSettings();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { user, kyc, profile, subscription, signOut } = useAuth();
    const { showAlert } = useAlert();
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showNotifPicker, setShowNotifPicker] = useState(false);
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

    const handleSignOut = () => {
        showAlert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
        ]);
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
                    <Row theme={theme} icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/support')} />
                </Section>

                <Section title="" theme={theme}>
                    <Row theme={theme} icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger />
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
