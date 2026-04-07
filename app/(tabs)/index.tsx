import { Card, EmptyState, RecommendationBadge, ResponsiveContainer, ResponsiveScrollView, SectionHeader, StatusChip } from '@/components/ui';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { ResearchReport } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_ACTIONS = [
    { icon: 'document-text-outline' as const, label: 'Reports', route: '/(tabs)/reports' as const, color: '#3A5BA0', bg: '#EFF6FF' },
    { icon: 'pie-chart-outline' as const, label: 'Portfolio', route: '/(tabs)/portfolio' as const, color: '#059669', bg: '#ECFDF5' },
    { icon: 'people-outline' as const, label: 'Analysts', route: '/(tabs)/analyst' as const, color: '#7C3AED', bg: '#F5F3FF' },
    { icon: 'diamond-outline' as const, label: 'Plans', route: '/subscription' as const, color: '#FFA500', bg: '#FFF7ED' },
] as const;

const QUICK_ACTIONS_DARK = [
    { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
    { color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
    { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
    { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
];

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HomeScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { user, kyc, profile, subscription, wallet, refreshUserData, isLoadingData } = useAuth();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const isNarrow = screenWidth < 360;     // very small phones (SE 1st gen = 320)
    const [refreshing, setRefreshing] = useState(false);
    const displayName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Investor';


    const userEmail = user?.primaryEmailAddress?.emailAddress;

    const { data: recentReports } = useQuery({
        queryKey: ['recent_reports', subscription?.plan],
        queryFn: async (): Promise<ResearchReport[]> => {
            if (!subscription?.is_active) return [];

            let query = supabase
                .from('research_reports')
                .select('report_id, company_name, nse_symbol, recommendation, target_price, published_at, pdf_file_url, audio_file_url, video_file_url')
                .eq('is_published', true)
                .order('published_at', { ascending: false })
                .limit(3);

            if (subscription.plan !== 'all_in_growth') {
                query = query.eq('plan', subscription.plan);
            }

            const { data } = await query;
            return data ?? [];
        },
        enabled: !isLoadingData && !!subscription?.is_active,
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
        if (Platform.OS === 'web') return;
        if (isLoadingData) return;

        const scheduleReminder = async () => {
            if (hasNotified.current || !user) return;
            const uid = user.id;

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

            if (prefs.reports && kycStatus === 'approved' && subscription?.is_active) {
                try {
                    const { count } = await supabase
                        .from('research_reports')
                        .select('report_id', { count: 'exact', head: true })
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <ResponsiveScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.secondary} />}
            >
                {/* ── Header ── */}
                <View style={{ position: 'relative', overflow: 'hidden' }}>
                    <LinearGradient
                        colors={isDark ? ['#0F1B35', '#1a2d52', '#0C0F14'] : ['#1F4690', '#2d5ab5', '#3A5BA0']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.header, { paddingTop: Math.max(insets.top + 12, 32) }]}
                    >
                        <ResponsiveContainer>
                            {/* Top row: avatar + greeting + pills */}
                            <View style={styles.headerContent}>
                                <View style={styles.headerLeft}>
                                    <View style={styles.avatarContainer}>
                                        <View style={[styles.avatarRing, kyc?.status === 'approved' && styles.avatarRingVerified]}>
                                            {user?.imageUrl ? (
                                                <Image source={{ uri: user.imageUrl }} style={styles.headerAvatar} />
                                            ) : (
                                                <View style={styles.headerAvatarFallback}>
                                                    <Text style={styles.headerAvatarText}>
                                                        {displayName.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        {kyc?.status === 'approved' && (
                                            <View style={styles.verifiedBadge}>
                                                <Ionicons name="checkmark-sharp" size={9} color="#fff" />
                                            </View>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={styles.greetingText}>{greeting},</Text>
                                        <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.pill, styles.pillGold]}
                                    onPress={() => router.push('/subscription')}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="diamond" size={11} color={Colors.brand.gold} />
                                    <Text style={[styles.pillText, { color: Colors.brand.gold }]} numberOfLines={1}>
                                        {planLabel}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Bottom stats strip */}
                            <View style={[styles.statsStrip, isNarrow && styles.statsStripCompact]}>
                                <TouchableOpacity style={styles.statItem} onPress={() => router.push('/(kyc)')} activeOpacity={0.7}>
                                    <Ionicons name="shield-checkmark-outline" size={isNarrow ? 12 : 14} color="rgba(255,255,255,0.6)" />
                                    <Text style={[styles.statLabel, isNarrow && { fontSize: 9 }]}>KYC</Text>
                                    <Text style={[styles.statValue, isNarrow && { fontSize: 10 }, {
                                        color: kycStatus === 'approved' ? '#34D399' : kycStatus === 'pending' ? '#FBBF24' : '#F87171'
                                    }]} numberOfLines={1}>
                                        {kycStatus === 'approved' ? 'Verified' : kycStatus === 'pending' ? 'Pending' : 'Incomplete'}
                                    </Text>
                                </TouchableOpacity>
                                <View style={styles.statDivider} />
                                <TouchableOpacity style={styles.statItem} onPress={() => router.push('/(profiling)')} activeOpacity={0.7}>
                                    <Ionicons name="bar-chart-outline" size={isNarrow ? 12 : 14} color="rgba(255,255,255,0.6)" />
                                    <Text style={[styles.statLabel, isNarrow && { fontSize: 9 }]}>Profile</Text>
                                    <Text style={[styles.statValue, isNarrow && { fontSize: 10 }, { color: profile ? '#34D399' : '#9CA3AF' }]} numberOfLines={1}>
                                        {profile?.display_label || profile?.risk_profile || 'Not Set'}
                                    </Text>
                                </TouchableOpacity>
                                <View style={styles.statDivider} />
                                <TouchableOpacity style={styles.statItem} onPress={() => router.push('/buy-credits')} activeOpacity={0.7}>
                                    <Ionicons name="wallet-outline" size={isNarrow ? 12 : 14} color="rgba(255,255,255,0.6)" />
                                    <Text style={[styles.statLabel, isNarrow && { fontSize: 9 }]}>Credits</Text>
                                    <Text style={[styles.statValue, isNarrow && { fontSize: 10 }, { color: '#fff' }]} numberOfLines={1}>
                                        {wallet?.credits_balance?.toLocaleString() || '0'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ResponsiveContainer>
                    </LinearGradient>
                </View>

                <ResponsiveContainer style={styles.bodyContainer}>
                    {/* ── Quick Actions ── */}
                    <View style={styles.section}>
                        <SectionHeader title="Quick Actions" theme={theme} />
                        <View style={styles.actionScrollWrapper}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.actionScroll}
                            >
                                {QUICK_ACTIONS.map((item, idx) => {
                                    const accent = isDark ? QUICK_ACTIONS_DARK[idx] : { color: item.color, bg: item.bg };
                                    return (
                                        <TouchableOpacity
                                            key={item.label}
                                            style={[styles.actionBtnPhone, { backgroundColor: c.surface, borderColor: c.cardBorder }]}
                                            onPress={() => router.push(item.route)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.actionIconCircleLarge, { backgroundColor: accent.bg }]}>
                                                <Ionicons name={item.icon} size={26} color={accent.color} />
                                            </View>
                                            <Text style={[styles.actionLabelPhone, { color: c.text }]}>{item.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            {/* Right-edge fade — signals more content */}
                            <LinearGradient
                                colors={['transparent', c.background]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionFade}
                                pointerEvents="none"
                            />
                        </View>
                    </View>

                    {/* ── Latest Research ── */}
                    <View style={styles.section}>
                        <SectionHeader
                            title="Latest Research"
                            theme={theme}
                            action={
                                <TouchableOpacity
                                    onPress={() => router.push('/(tabs)/reports')}
                                    style={styles.viewAllBtn}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.viewAllText}>View All</Text>
                                    <Ionicons name="arrow-forward" size={13} color={Colors.brand.secondary} />
                                </TouchableOpacity>
                            }
                        />

                        {recentReports && recentReports.length > 0 ? (
                            recentReports.map((report, idx) => (
                                <TouchableOpacity
                                    key={report.report_id}
                                    style={[
                                        styles.reportCard,
                                        {
                                            backgroundColor: c.surface,
                                            borderColor: c.cardBorder,
                                            marginBottom: idx < recentReports.length - 1 ? Spacing.sm : 0,
                                        }
                                    ]}
                                    onPress={() => router.push(`/report/${report.report_id}` as any)}
                                    activeOpacity={0.75}
                                >
                                    {/* Left accent bar */}
                                    <View style={[styles.reportAccentBar, { backgroundColor: isDark ? c.info : Colors.brand.secondary }]} />

                                    <View style={[styles.reportIconBg, { backgroundColor: isDark ? c.infoBg : '#EFF6FF' }]}>
                                        <Ionicons name="document-text" size={18} color={isDark ? c.info : Colors.brand.secondary} />
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.reportName, { color: c.text }]} numberOfLines={1}>{report.company_name}</Text>
                                        <View style={styles.reportMeta}>
                                            <Text style={[styles.reportSymbol, { color: c.textTertiary }]}>{report.nse_symbol}</Text>
                                            {report.target_price && (
                                                <>
                                                    <View style={[styles.metaDot, { backgroundColor: c.textTertiary }]} />
                                                    <Text style={[styles.reportTarget, { color: c.success }]}>
                                                        ₹{report.target_price.toLocaleString('en-IN')}
                                                    </Text>
                                                </>
                                            )}
                                        </View>
                                        {report.published_at && (
                                            <Text style={[styles.reportDate, { color: c.textTertiary }]}>
                                                {formatDate(report.published_at)}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={styles.reportRight}>
                                        {report.recommendation && <RecommendationBadge recommendation={report.recommendation} theme={theme} />}
                                        <View style={styles.mediaIcons}>
                                            {report.pdf_file_url && <Ionicons name="document" size={12} color={c.textTertiary} />}
                                            {report.audio_file_url && <Ionicons name="headset" size={12} color={c.textTertiary} />}
                                            {report.video_file_url && <Ionicons name="videocam" size={12} color={c.textTertiary} />}
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <EmptyState icon="document-text-outline" title="No Reports Yet" subtitle="Published research reports will appear here." theme={theme} />
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ResponsiveContainer>
            </ResponsiveScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // ── Header ──
    header: {
        paddingBottom: 32,
        borderBottomLeftRadius: BorderRadius['3xl'],
        borderBottomRightRadius: BorderRadius['3xl'],
        overflow: 'hidden',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.xl,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
        marginRight: Spacing.md,
    },
    avatarContainer: { position: 'relative' },
    avatarRing: {
        borderRadius: 20,
        padding: 2,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    avatarRingVerified: { borderColor: '#34D399' },
    verifiedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#10b981',
        borderRadius: 10,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.brand.primary,
    },
    headerAvatar: { width: 44, height: 44, borderRadius: 16 },
    headerAvatarFallback: {
        width: 44,
        height: 44,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    headerAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
    greetingText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.4, marginBottom: 1 },
    nameText: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },

    // Pills
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: BorderRadius.full,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pillStack: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
    },
    pillGold: {
        backgroundColor: 'rgba(255,165,0,0.12)',
        borderColor: 'rgba(255,165,0,0.2)',
    },
    pillCompact: {
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    pillText: { fontSize: FontSize.xs, fontWeight: '700' },

    // Stats strip at bottom of header
    statsStrip: {
        flexDirection: 'row',
        marginHorizontal: Spacing.xl,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500', letterSpacing: 0.5 },
    statValue: { fontSize: FontSize.xs, fontWeight: '700' },
    statsStripCompact: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 2 },

    // ── Body ──
    bodyContainer: {
        paddingTop: Spacing.xl,
        paddingHorizontal: Spacing.xl,
    },

    // ── Quick Actions ──
    section: { marginBottom: Spacing['2xl'] },

    // Tablet / web: 4-in-a-row
    actionGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    actionBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xs,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        gap: 4,
    },
    actionIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    actionLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

    // Quick actions horizontal scroll
    actionScrollWrapper: {
        position: 'relative',
    },
    actionScroll: {
        flexDirection: 'row',
        gap: Spacing.md,
        paddingBottom: Spacing.xs,
    },
    actionFade: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 48,
    },

    // Phone: 2×2 grid (kept for potential future use)
    actionGridPhone: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    actionBtnPhone: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        width: 80,
    },
    actionIconCircleLarge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionLabelPhone: { fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },

    // ── View All ──
    viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    viewAllText: { color: Colors.brand.secondary, fontSize: FontSize.sm, fontWeight: '600' },

    // ── Report Cards ──
    reportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
    },
    reportAccentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        borderTopLeftRadius: BorderRadius.xl,
        borderBottomLeftRadius: BorderRadius.xl,
    },
    reportIconBg: {
        width: 42,
        height: 42,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    reportName: { fontSize: FontSize.base, fontWeight: '700', marginBottom: 2 },
    reportMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    metaDot: { width: 3, height: 3, borderRadius: 2 },
    reportSymbol: { fontSize: FontSize.xs, fontFamily: 'monospace', fontWeight: '500' },
    reportTarget: { fontSize: FontSize.xs, fontWeight: '700' },
    reportDate: { fontSize: 10, fontWeight: '400', marginTop: 1 },
    reportRight: { alignItems: 'flex-end', gap: 6 },
    mediaIcons: { flexDirection: 'row', gap: 5 },
});
