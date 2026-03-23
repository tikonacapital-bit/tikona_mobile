import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, RefreshControl, Platform, Image, Animated,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { Card, StatusChip, SectionHeader, RecommendationBadge, EmptyState, ResponsiveScrollView, ResponsiveContainer } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import type { ResearchReport } from '@/lib/types';

export default function HomeScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { user, kyc, profile, subscription, refreshUserData, isLoadingData } = useAuth();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const displayName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Investor';

    // ── Header Animation ──
    const floatAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: 1, duration: 5000, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(floatAnim, { toValue: 0, duration: 5000, useNativeDriver: Platform.OS !== 'web' }),
            ])
        ).start();
    }, [floatAnim]);

    const userEmail = user?.primaryEmailAddress?.emailAddress;

    const { data: recentReports } = useQuery({
        queryKey: ['recent_reports', userEmail],
        queryFn: async (): Promise<ResearchReport[]> => {
            if (!userEmail) return [];

            // Fetch only reports assigned to this user's email
            const { data: assignments } = await supabase
                .from('user_report_assignments')
                .select('report_id')
                .eq('email', userEmail);

            if (!assignments || assignments.length === 0) return [];

            const assignedIds = assignments.map((a) => a.report_id);

            const { data } = await supabase
                .from('research_reports')
                .select('*')
                .eq('is_published', true)
                .in('report_id', assignedIds)
                .order('published_at', { ascending: false })
                .limit(3);
            return data ?? [];
        },
        enabled: !!userEmail,
        staleTime: 60000,
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            refreshUserData(),
            queryClient.invalidateQueries({ queryKey: ['recent_reports'] }),
        ]);
        setRefreshing(false);
    }, [refreshUserData, queryClient]);

    const kycStatus = kyc?.status || 'not_started';
    const kycVariant = kycStatus === 'approved' ? 'success' : kycStatus === 'pending' ? 'warning' : 'danger';
    const planLabel = subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'Free';

    // ── Push Notifications (native only) ──
    const hasNotified = useRef(false);
    useEffect(() => {
        if (Platform.OS === 'web') return; // Notifications not supported on web
        if (isLoadingData) return; // Wait until data is loaded

        const scheduleReminder = async () => {
            if (hasNotified.current || !user) return;
            const uid = user.id;

            // Load preferences
            let saved: string | null = null;
            try {
                if (Platform.OS === 'web') {
                    saved = localStorage.getItem('notification_preferences');
                } else {
                    saved = await SecureStore.getItemAsync('notification_preferences');
                }
            } catch (e) {
                logger.warn('[Notifications] Preference read error:', e);
            }

            const prefs = saved ? JSON.parse(saved) : { master: true, reports: true, kyc: true };
            if (!prefs.master) return;

            hasNotified.current = true;

            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') return;

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            // ── KYC & Profile Alerts ──
            if (prefs.kyc) {
                if (kycStatus === 'not_started' || kycStatus === 'rejected') {
                    setTimeout(async () => {
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'Complete your KYC 🛡️',
                                body: 'Verify your identity to unlock full access to Tikona research reports.',
                                sound: true,
                            },
                            trigger: null,
                        });
                    }, 5000);
                } else if (!profile) {
                    setTimeout(async () => {
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'Set your risk profile 📊',
                                body: 'Take a quick quiz to get personalized report recommendations.',
                                sound: true,
                            },
                            trigger: null,
                        });
                    }, 5000);
                }
            }

            // ── New Reports Alerts ──
            if (prefs.reports && kycStatus === 'approved' && subscription?.is_active) {
                try {
                    const { count } = await supabase
                        .from('research_reports')
                        .select('*', { count: 'exact', head: true })
                        .eq('is_published', true);

                    if (count !== null) {
                        let lastCountStr: string | null = null;
                        const countKey = `last_report_count_${uid}`;
                        try {
                            if (Platform.OS === 'web') {
                                lastCountStr = localStorage.getItem(countKey);
                            } else {
                                lastCountStr = await SecureStore.getItemAsync(countKey);
                            }
                        } catch (e) { }

                        const lastCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;

                        if (count > lastCount) {
                            const newCount = count - lastCount;
                            setTimeout(async () => {
                                await Notifications.scheduleNotificationAsync({
                                    content: {
                                        title: 'New Reports Available 📈',
                                        body: `There are ${newCount} new published research report${newCount > 1 ? 's' : ''}. Tap to view.`,
                                        sound: true,
                                    },
                                    trigger: null,
                                });
                            }, 3000);
                        }
                        
                        try {
                            if (Platform.OS === 'web') {
                                localStorage.setItem(countKey, count.toString());
                            } else {
                                await SecureStore.setItemAsync(countKey, count.toString());
                            }
                        } catch (e) { }
                    }
                } catch (e) {
                    logger.warn('[Notifications] Failed to check for new reports:', e);
                }
            }
        };

        if (user && !hasNotified.current) scheduleReminder();
    }, [user, kycStatus, profile, isLoadingData]);

    // ── Greeting based on time ──
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const glowOffset = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
    const glowScale = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

    return (
        <ResponsiveScrollView
            style={[styles.container, { backgroundColor: c.background }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.secondary} />}
        >
            {/* ── Premium Animated Header ── */}
            <View style={{ position: 'relative', overflow: 'hidden' }}>
                <View style={[styles.header, { backgroundColor: isDark ? Colors.brand.primary : c.surface }]}>
                    {/* Animated Ambient Glow */}
                    <Animated.View style={[
                        StyleSheet.absoluteFill,
                        { transform: [{ translateY: glowOffset }, { scale: glowScale }], opacity: isDark ? 0.3 : 0.8 }
                    ]}>
                        <LinearGradient
                            colors={isDark ? ['#3b82f6', '#1d4ed8'] : ['#eff6ff', '#dbeafe']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1, width: '150%', left: '-25%', top: '-50%', height: '200%', borderRadius: 1000, filter: 'blur(50px)' as any }}
                        />
                    </Animated.View>

                    <ResponsiveContainer>
                        <View style={styles.headerContent}>
                            <View style={styles.headerLeft}>
                                <View style={styles.avatarContainer}>
                                    <View style={[styles.avatarRing, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.2)' }, kyc?.status === 'approved' && styles.avatarRingVerified]}>
                                        {user?.imageUrl ? (
                                            <Image source={{ uri: user.imageUrl }} style={styles.headerAvatar} />
                                        ) : (
                                            <View style={[styles.headerAvatarFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : Colors.brand.primary + '10' }]}>
                                                <Text style={[styles.headerAvatarText, { color: isDark ? '#fff' : Colors.brand.primary }]}>
                                                    {displayName.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    {kyc?.status === 'approved' && (
                                        <View style={[styles.verifiedBadge, { backgroundColor: isDark ? '#10b981' : Colors.brand.accent, borderColor: isDark ? Colors.brand.primary : c.surface, borderWidth: 2 }]}>
                                            <Ionicons name="checkmark-sharp" size={10} color="#fff" />
                                        </View>
                                    )}
                                </View>
                                <View style={{ zIndex: 2 }}>
                                    <Text style={[styles.greetingText, { color: isDark ? 'rgba(255,255,255,0.7)' : c.textSecondary, letterSpacing: 0.5 }]}>{greeting},</Text>
                                    <Text style={[styles.nameText, { color: isDark ? '#fff' : c.text, fontWeight: '800', letterSpacing: -0.5 }]}>{displayName}</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.planPill, {
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : Colors.brand.gold + '15',
                                    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : Colors.brand.gold + '30',
                                    zIndex: 2
                                }]}
                                onPress={() => router.push('/subscription')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="diamond" size={13} color={Colors.brand.gold} />
                                <Text style={[styles.planPillText, { fontWeight: '700' }]}>{planLabel}</Text>
                            </TouchableOpacity>
                        </View>
                    </ResponsiveContainer>
                </View>
            </View>

            {/* ── Status Cards ── */}
            <ResponsiveContainer style={{ paddingHorizontal: Spacing.xl }}>
                <View style={[styles.statusRow, { marginTop: -20 }]}>
                    <Card theme={theme} style={styles.statusCard} onPress={() => router.push('/(kyc)')}>
                        <View style={[styles.statusIconBox, { backgroundColor: c.infoBg }]}>
                            <Ionicons name="shield-checkmark" size={18} color={c.info} />
                        </View>
                        <Text style={[styles.statusLabel, { color: c.textSecondary }]}>KYC Status</Text>
                        <StatusChip label={kycStatus === 'approved' ? 'Verified' : kycStatus === 'pending' ? 'Pending' : 'Not Done'} variant={kycVariant} theme={theme} />
                    </Card>

                    <Card theme={theme} style={styles.statusCard} onPress={() => router.push('/(profiling)')}>
                        <View style={[styles.statusIconBox, { backgroundColor: c.successBg }]}>
                            <Ionicons name="bar-chart" size={18} color={c.success} />
                        </View>
                        <Text style={[styles.statusLabel, { color: c.textSecondary }]}>Risk Profile</Text>
                        <StatusChip
                            label={profile?.display_label || profile?.risk_profile || 'Not Set'}
                            variant={profile ? 'success' : 'neutral'}
                            theme={theme}
                        />
                    </Card>
                </View>

                {/* ── Quick Actions ── */}
                <View style={styles.section}>
                    <SectionHeader title="Quick Actions" theme={theme} />
                    <View style={styles.actionRow}>
                        {[
                            { icon: 'document-text-outline' as const, label: 'Reports', route: '/(tabs)/reports' as const },
                            { icon: 'pie-chart-outline' as const, label: 'Portfolio', route: '/(tabs)/portfolio' as const },
                            { icon: 'diamond-outline' as const, label: 'Plans', route: '/subscription' as const },
                        ].map((item) => (
                            <TouchableOpacity
                                key={item.label}
                                style={[styles.actionBtn, { backgroundColor: c.surface, borderColor: c.cardBorder }]}
                                onPress={() => router.push(item.route)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.actionIconCircle, { backgroundColor: Colors.brand.secondary + '10' }]}>
                                    <Ionicons name={item.icon} size={20} color={Colors.brand.secondary} />
                                </View>
                                <Text style={[styles.actionLabel, { color: c.text }]}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Latest Research ── */}
                <View style={styles.section}>
                    <SectionHeader
                        title="Latest Research"
                        theme={theme}
                        action={
                            <TouchableOpacity onPress={() => router.push('/(tabs)/reports')}>
                                <Text style={{ color: Colors.brand.secondary, fontSize: FontSize.sm, fontWeight: '600' }}>View All</Text>
                            </TouchableOpacity>
                        }
                    />

                    {recentReports && recentReports.length > 0 ? (
                        recentReports.map((report) => (
                            <Card
                                key={report.report_id}
                                theme={theme}
                                style={styles.reportCard}
                                onPress={() => router.push(`/report/${report.report_id}` as any)}
                            >
                                <View style={styles.reportRow}>
                                    <View style={[styles.reportIconBg, { backgroundColor: c.infoBg }]}>
                                        <Ionicons name="document-text" size={18} color={c.info} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.reportName, { color: c.text }]} numberOfLines={1}>{report.company_name}</Text>
                                        <View style={styles.reportMeta}>
                                            <Text style={[styles.reportSymbol, { color: c.textTertiary }]}>{report.nse_symbol}</Text>
                                            {report.target_price && (
                                                <Text style={[styles.reportTarget, { color: c.success }]}>
                                                    ₹{report.target_price.toLocaleString('en-IN')}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.reportRight}>
                                        {report.recommendation && <RecommendationBadge recommendation={report.recommendation} theme={theme} />}
                                        <View style={styles.mediaIcons}>
                                            {report.pdf_file_url && <Ionicons name="document" size={12} color={c.textTertiary} />}
                                            {report.audio_file_url && <Ionicons name="headset" size={12} color={c.textTertiary} />}
                                            {report.video_file_url && <Ionicons name="videocam" size={12} color={c.textTertiary} />}
                                        </View>
                                    </View>
                                </View>
                            </Card>
                        ))
                    ) : (
                        <EmptyState icon="document-text-outline" title="No Reports Yet" subtitle="Published research reports will appear here." theme={theme} />
                    )}
                </View>

                <View style={{ height: 32 }} />
            </ResponsiveContainer>
        </ResponsiveScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // ── Header — Dark navy band at top ──
    header: {
        paddingTop: Platform.select({ ios: 58, web: 24, default: 44 }),
        paddingBottom: 44, /* increased to give room for overlapping cards */
        borderBottomLeftRadius: BorderRadius['2xl'],
        borderBottomRightRadius: BorderRadius['2xl'],
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, // Moved padding to inner content so it respects max width
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    avatarContainer: { position: 'relative' },
    avatarRing: { borderRadius: 18, padding: 2, borderWidth: 2 },
    avatarRingVerified: { borderColor: Colors.brand.accent },
    verifiedBadge: { position: 'absolute', bottom: -2, right: -2, borderRadius: 10 },
    headerAvatar: { width: 40, height: 40, borderRadius: 14 },
    headerAvatarFallback: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    headerAvatarText: { fontSize: 17, fontWeight: '700' },
    greetingText: { fontSize: FontSize.sm },
    nameText: { fontSize: FontSize.lg, fontWeight: '700', letterSpacing: -0.2 },
    planPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
    planPillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.brand.gold },

    // ── Status Cards ──
    statusRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.md, marginTop: -12, marginBottom: Spacing.xl },
    statusCard: { flex: 1, padding: Spacing.lg, alignItems: 'flex-start' },
    statusIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
    statusLabel: { fontSize: FontSize.sm, fontWeight: '500', marginBottom: 6 },

    // ── Quick Actions ──
    section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    actionRow: { flexDirection: 'row', gap: Spacing.md },
    actionBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
    actionIconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
    actionLabel: { fontSize: FontSize.sm, fontWeight: '600' },

    // ── Report Cards ──
    reportCard: { padding: Spacing.lg, marginBottom: Spacing.sm },
    reportRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    reportIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    reportName: { fontSize: FontSize.base, fontWeight: '600', marginBottom: 2 },
    reportMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reportSymbol: { fontSize: FontSize.xs, fontFamily: 'monospace' },
    reportTarget: { fontSize: FontSize.xs, fontWeight: '600' },
    reportRight: { alignItems: 'flex-end', gap: 6 },
    mediaIcons: { flexDirection: 'row', gap: 4 },
});
