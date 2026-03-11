import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme, useThemeSettings } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { Card, StatusChip, ResponsiveScrollView } from '@/components/ui';
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
        <>
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
                </Section>

                <Section title="PREFERENCES" theme={theme}>
                    <Row theme={theme} icon="notifications-outline" label="Notifications" />
                    <Row theme={theme} icon="moon-outline" label="Appearance" value={themeLabel} onPress={() => setShowThemePicker(true)} />
                    <Row theme={theme} icon="help-circle-outline" label="Help & Support" />
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
        </>
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
});
