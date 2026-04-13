import { EmptyState, RecommendationBadge, ResponsiveScrollView } from '@/components/ui';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { ResearchReport } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Quick Actions Config ────────────────────────────────────────────────────
const QUICK_ACTIONS = [
    {
        icon: 'document-text' as const,
        label: 'Reports',
        route: '/(tabs)/reports' as const,
        gradientLight: ['#1F4690', '#3A5BA0'] as [string, string],
        gradientDark: ['#0d1b35', '#1F4690'] as [string, string],
        iconColor: '#ffffff',
        glow: '#1F4690',
    },
    {
        icon: 'pie-chart' as const,
        label: 'Portfolio',
        route: '/(tabs)/portfolio' as const,
        gradientLight: ['#1F4690', '#3A5BA0'] as [string, string],
        gradientDark: ['#0d1b35', '#1F4690'] as [string, string],
        iconColor: '#ffffff',
        glow: '#1F4690',
    },
    {
        icon: 'people' as const,
        label: 'Analysts',
        route: '/(tabs)/analyst' as const,
        gradientLight: ['#1F4690', '#3A5BA0'] as [string, string],
        gradientDark: ['#0d1b35', '#1F4690'] as [string, string],
        iconColor: '#ffffff',
        glow: '#1F4690',
    },
    {
        icon: 'diamond' as const,
        label: 'Plans',
        route: '/subscription' as const,
        gradientLight: ['#1F4690', '#3A5BA0'] as [string, string],
        gradientDark: ['#0d1b35', '#1F4690'] as [string, string],
        iconColor: '#ffffff',
        glow: '#1F4690',
    },
] as const;


function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ActionTile({
    item,
    isDark,
    isNarrow,
}: {
    item: typeof QUICK_ACTIONS[number];
    isDark: boolean;
    isNarrow: boolean;
}) {
    const scale = useRef(new Animated.Value(1)).current;
    const glow = useRef(new Animated.Value(0)).current;

    const handlePressIn = () => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: 0.92,
                useNativeDriver: true,
                speed: 50,
                bounciness: 4,
            }),
            Animated.timing(glow, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            })
        ]).start();
    };
    const handlePressOut = () => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
                bounciness: 8,
            }),
            Animated.timing(glow, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start();
    };

    return (
        <Animated.View style={[{ transform: [{ scale }], flex: 1, position: 'relative' }]}>
            {/* Animated Glow Backdrop */}
            <Animated.View
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFillObject,
                    {
                        backgroundColor: '#1F4690',
                        borderRadius: 24,
                        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
                        shadowColor: '#1F4690',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 20,
                        elevation: 10,
                        transform: [{ scale: 1.05 }],
                    }
                ]}
            />
            <TouchableOpacity
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push(item.route);
                }}
                activeOpacity={0.9}
                style={[
                    styles.actionTileModern,
                    {
                        backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        shadowColor: isDark ? '#000' : '#8A9BBD',
                    }
                ]}
            >
                <View style={styles.actionIconContainer}>
                    <LinearGradient
                        colors={isDark ? ['rgba(31,70,144,0.4)', 'rgba(31,70,144,0.1)'] : ['#F0F4FA', '#E1E9F6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionIconPulse}
                    >
                        <Ionicons name={item.icon} size={isNarrow ? 22 : 24} color={isDark ? '#93c5fd' : '#1F4690'} />
                    </LinearGradient>
                </View>
                <Text style={[
                    styles.actionLabelModern,
                    isNarrow && { fontSize: 10 },
                    { color: isDark ? '#F1F5F9' : '#0F172A' }
                ]} numberOfLines={1}>
                    {item.label}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}


// ─── Home Screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { user, kyc, profile, subscription, wallet, refreshUserData, isLoadingData } = useAuth();
    const { isWideWeb } = useResponsiveLayout();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const isNarrow = screenWidth < 360;
    const [refreshing, setRefreshing] = useState(false);
    const displayName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Investor';
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    // Pulse animation for the KYC dot
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (kyc?.status !== 'not_started' && kyc?.status !== 'rejected') return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [kyc?.status]);

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
    const planLabel = subscription?.plan
        ? subscription.plan.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : 'Free';

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

    // ── Greeting ──
    const hour = new Date().getHours();
    const greeting = hour < 12 ? '☀️ Good morning' : hour < 17 ? '🌤 Good afternoon' : '🌙 Good evening';

    // ── KYC Banner (only when not approved) ──
    const showKycBanner = kycStatus !== 'approved';

    // ── AI Credit display ──
    const displayCredits = (() => {
        const dc = Math.round((wallet?.credits_balance ?? 0) / 502);
        return dc >= 1000000 ? `${(dc / 1000000).toFixed(1)}M` : dc >= 1000 ? `${(dc / 1000).toFixed(1)}K` : `${dc}`;
    })();

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            <ResponsiveScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.secondary} />}
            >
                {/* ── HERO HEADER ── */}
                <View style={styles.heroWrapper}>
                    <LinearGradient
                        colors={isDark
                            ? ['#060d1f', '#0d1b35', '#101c38']
                            : ['#1a3a7a', '#1F4690', '#2a52a8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.heroGradient, { paddingTop: Math.max(insets.top + 16, 32) }]}
                    >
                        {/* Decorative orbs */}
                        <View style={[styles.orb, styles.orbTopRight, isDark && styles.orbDark]} />
                        <View style={[styles.orb, styles.orbBottomLeft, isDark && styles.orbDark]} />

                        {/* ── Top Row ── */}
                        <View style={styles.heroTopRow}>
                            <View style={styles.heroLeft}>
                                {/* Avatar */}
                                <View style={styles.avatarOuter}>
                                    <View style={[
                                        styles.avatarInner,
                                        kycStatus === 'approved' && styles.avatarInnerVerified,
                                    ]}>
                                        {user?.imageUrl ? (
                                            <Image source={{ uri: user.imageUrl }} style={styles.avatarImg} />
                                        ) : (
                                            <LinearGradient
                                                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                                                style={styles.avatarFallback}
                                            >
                                                <Text style={styles.avatarInitial}>
                                                    {displayName.charAt(0).toUpperCase()}
                                                </Text>
                                            </LinearGradient>
                                        )}
                                    </View>
                                    {kycStatus === 'approved' && (
                                        <View style={styles.verifiedBadge}>
                                            <Ionicons name="checkmark-sharp" size={8} color="#fff" />
                                        </View>
                                    )}
                                </View>

                                {/* Greeting */}
                                <View>
                                    <Text style={styles.greetText}>{greeting},</Text>
                                    <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
                                </View>
                            </View>

                            {/* Plan Pill */}
                            <TouchableOpacity
                                style={styles.planPill}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/subscription'); }}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="diamond" size={11} color="#FFD700" />
                                <Text style={styles.planPillText} numberOfLines={1}>{planLabel}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Stats Glass Card ── */}
                        <BlurView
                            intensity={isDark ? 20 : 50}
                            tint={isDark ? 'dark' : 'light'}
                            style={styles.statsCard}
                        >
                            {/* KYC Stat */}
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(kyc)'); }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.statIconBg, {
                                    backgroundColor: kycStatus === 'approved'
                                        ? 'rgba(31,70,144,0.25)'
                                        : 'rgba(255,165,0,0.2)',
                                }]}>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={15}
                                        color={kycStatus === 'approved' ? '#FFE5B4' : kycStatus === 'pending' ? '#FFA500' : '#FFA500'}
                                    />
                                </View>
                                <View>
                                    <Text style={styles.statLabel}>KYC</Text>
                                    <Text style={styles.statValue} numberOfLines={1}>
                                        {kycStatus === 'approved' ? 'Verified' : kycStatus === 'pending' ? 'Pending' : 'Incomplete'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.statDivider} />

                            {/* Profile Stat */}
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(profiling)'); }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.statIconBg, { backgroundColor: 'rgba(58,91,160,0.3)' }]}>
                                    <Ionicons name="analytics" size={15} color="#FFE5B4" />
                                </View>
                                <View>
                                    <Text style={styles.statLabel}>Profile</Text>
                                    <Text style={styles.statValue} numberOfLines={1}>
                                        {profile?.display_label || profile?.risk_profile || 'Not Set'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.statDivider} />

                            {/* Credits Stat */}
                            <TouchableOpacity
                                style={styles.statItem}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/buy-credits'); }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.statIconBg, { backgroundColor: 'rgba(255,165,0,0.2)' }]}>
                                    <Ionicons name="flash" size={15} color="#FFA500" />
                                </View>
                                <View>
                                    <Text style={styles.statLabel}>AI Credits</Text>
                                    <Text style={styles.statValue} numberOfLines={1}>{displayCredits}</Text>
                                </View>
                            </TouchableOpacity>
                        </BlurView>
                    </LinearGradient>

                    {/* Curved bottom */}
                    <View style={[styles.heroCurve, { backgroundColor: c.background }]} />
                </View>

                {/* ── BODY ── */}
                <View style={[styles.body, isWideWeb && styles.bodyWide]}>

                    {/* ── KYC Action Banner ── */}
                    {showKycBanner && (
                        <TouchableOpacity
                            style={[styles.kycBanner, isDark ? styles.kycBannerDark : styles.kycBannerLight]}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(kyc)'); }}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={kycStatus === 'pending'
                                    ? ['rgba(251,191,36,0.12)', 'rgba(251,191,36,0.04)']
                                    : ['rgba(248,113,113,0.12)', 'rgba(248,113,113,0.04)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.kycBannerGradient}
                            >
                                <View style={[styles.kycBannerIcon, {
                                    backgroundColor: kycStatus === 'pending' ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.2)',
                                }]}>
                                    <Animated.View style={{ transform: [{ scale: pulse }] }}>
                                        <Ionicons
                                            name={kycStatus === 'pending' ? 'time' : 'alert-circle'}
                                            size={20}
                                            color={kycStatus === 'pending' ? '#FBBF24' : '#F87171'}
                                        />
                                    </Animated.View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.kycBannerTitle, {
                                        color: kycStatus === 'pending'
                                            ? (isDark ? '#FBBF24' : '#D97706')
                                            : (isDark ? '#F87171' : '#DC2626'),
                                    }]}>
                                        {kycStatus === 'pending' ? 'KYC Under Review' : 'Complete Your KYC'}
                                    </Text>
                                    <Text style={[styles.kycBannerSub, { color: c.textSecondary }]}>
                                        {kycStatus === 'pending'
                                            ? 'Your documents are being verified. This usually takes 1–2 business days.'
                                            : 'Verify your identity to access premium research reports.'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {/* ── Quick Actions ── */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={[styles.sectionTitle, { color: c.text }]}>Quick Actions</Text>
                        </View>
                        <View style={styles.actionRow}>
                            {QUICK_ACTIONS.map((item) => (
                                <ActionTile key={item.label} item={item} isDark={isDark} isNarrow={isNarrow} />
                            ))}
                        </View>
                    </View>

                    {/* ── Latest Research ── */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={[styles.sectionTitle, { color: c.text }]}>Latest Research</Text>
                            <TouchableOpacity
                                onPress={() => router.push('/(tabs)/reports')}
                                style={styles.viewAllBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.viewAllText}>View All</Text>
                                <Ionicons name="arrow-forward" size={13} color={Colors.brand.secondary} />
                            </TouchableOpacity>
                        </View>

                        {recentReports && recentReports.length > 0 ? (
                            <View style={styles.reportsList}>
                                {recentReports.map((report, idx) => (
                                    <TouchableOpacity
                                        key={report.report_id}
                                        style={[
                                            styles.reportCard,
                                            { backgroundColor: c.surface },
                                            isDark ? styles.reportCardDark : styles.reportCardLight,
                                            idx > 0 && { marginTop: Spacing.md },
                                        ]}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            router.push(`/report/${report.report_id}` as any);
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        {/* Icon */}
                                        <View style={[styles.reportIconBg, {
                                            backgroundColor: isDark ? 'rgba(31,70,144,0.2)' : '#EEF2FF',
                                        }]}>
                                            <Ionicons name="document-text" size={20} color={isDark ? '#FFE5B4' : Colors.brand.secondary} />
                                        </View>

                                        {/* Info */}
                                        <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                                            <Text style={[styles.reportName, { color: c.text }]} numberOfLines={1}>
                                                {report.company_name}
                                            </Text>
                                            <View style={styles.reportMeta}>
                                                <Text style={[styles.reportSymbol, { color: c.textTertiary }]}>
                                                    {report.nse_symbol}
                                                </Text>
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

                                        {/* Right side */}
                                        <View style={styles.reportRight}>
                                            {report.recommendation && (
                                                <RecommendationBadge recommendation={report.recommendation} theme={theme} />
                                            )}
                                            <View style={[styles.mediaIconRow, {
                                                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
                                            }]}>
                                                {report.pdf_file_url && <Ionicons name="document" size={11} color={isDark ? '#FFE5B4' : Colors.brand.secondary} />}
                                                {report.audio_file_url && <Ionicons name="headset" size={11} color={isDark ? '#FFE5B4' : Colors.brand.secondary} />}
                                                {report.video_file_url && <Ionicons name="videocam" size={11} color={isDark ? '#FFE5B4' : Colors.brand.secondary} />}
                                                <Ionicons name="chevron-forward" size={13} color={isDark ? '#FFA500' : Colors.brand.secondary} />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <EmptyState
                                icon="document-text-outline"
                                title="No Reports Yet"
                                subtitle={subscription?.is_active
                                    ? 'New research reports will appear here as they are published.'
                                    : 'Subscribe to a plan to access premium research reports.'}
                                theme={theme}
                            />
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </View>
            </ResponsiveScrollView>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },

    // ── Hero ──
    heroWrapper: {
        position: 'relative',
    },
    heroGradient: {
        paddingBottom: 40,
        overflow: 'hidden',
    },
    heroCurve: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },

    // Decorative orbs
    orb: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(96,165,250,0.10)',
    },
    orbDark: {
        backgroundColor: 'rgba(96,165,250,0.06)',
    },
    orbTopRight: {
        top: -60,
        right: -60,
    },
    orbBottomLeft: {
        bottom: 20,
        left: -80,
        backgroundColor: 'rgba(167,139,250,0.08)',
        width: 160,
        height: 160,
        borderRadius: 80,
    },

    // Top row
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing['2xl'],
    },
    heroLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
        marginRight: Spacing.md,
    },

    // Avatar
    avatarOuter: { position: 'relative' },
    avatarInner: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInnerVerified: { borderColor: '#FFA500' },
    avatarImg: { width: 50, height: 50, borderRadius: 25 },
    avatarFallback: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },
    verifiedBadge: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 17,
        height: 17,
        borderRadius: 9,
        backgroundColor: '#FFA500',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1F4690',
    },

    // Name
    greetText: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
        letterSpacing: 0.2,
        marginBottom: 2,
    },
    nameText: {
        fontSize: FontSize.lg,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.4,
    },

    // Plan pill
    planPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: BorderRadius.full,
        backgroundColor: 'rgba(255,215,0,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.35)',
    },
    planPillText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFD700',
        letterSpacing: 0.3,
    },

    // Stats card
    statsCard: {
        flexDirection: 'row',
        marginHorizontal: Spacing['2xl'],
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.md,
        overflow: 'hidden',
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    statIconBg: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.65)',
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#fff',
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginVertical: 4,
    },

    // ── Body ──
    body: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xs,
    },
    bodyWide: {
        maxWidth: 768,
        alignSelf: 'center',
        width: '100%',
    },

    // ── KYC Banner ──
    kycBanner: {
        borderRadius: 18,
        marginBottom: Spacing.lg,
        overflow: 'hidden',
        borderWidth: 1,
    },
    kycBannerLight: {
        borderColor: 'rgba(220,38,38,0.15)',
    },
    kycBannerDark: {
        borderColor: 'rgba(248,113,113,0.15)',
    },
    kycBannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: Spacing.lg,
    },
    kycBannerIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    kycBannerTitle: {
        fontSize: FontSize.sm,
        fontWeight: '800',
        marginBottom: 3,
    },
    kycBannerSub: {
        fontSize: 11,
        lineHeight: 16,
        fontWeight: '500',
    },

    // ── Section Headers ──
    section: { marginBottom: Spacing.xl },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    sectionTitle: {
        fontSize: FontSize.base,
        fontWeight: '800',
        letterSpacing: -0.2,
    },

    // View All
    viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
    viewAllText: { color: Colors.brand.secondary, fontSize: FontSize.sm, fontWeight: '700' },


    // ── Quick Actions ──
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionTileModern: {
        flex: 1,
        borderRadius: 24,
        paddingVertical: 18,
        paddingHorizontal: 4,
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    actionIconContainer: {
        shadowColor: '#1F4690',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    actionIconPulse: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionLabelModern: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
        textAlign: 'center',
    },

    // ── Report Cards ──
    reportsList: {},
    reportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: 20,
    },
    reportCardLight: {
        shadowColor: '#8A9BBD',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    reportCardDark: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },

    reportIconBg: {
        width: 46,
        height: 46,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportName: {
        fontSize: FontSize.base,
        fontWeight: '800',
        marginBottom: 3,
        letterSpacing: -0.3,
    },
    reportMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    metaDot: { width: 3, height: 3, borderRadius: 2 },
    reportSymbol: {
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: '600',
    },
    reportTarget: { fontSize: 11, fontWeight: '800' },
    reportDate: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
    reportRight: { alignItems: 'flex-end', gap: 8 },
    mediaIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 10,
    },
});
