import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Linking as RNLinking,
    ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { RecommendationBadge, ResponsiveScrollView } from '@/components/ui';
import ReportAIChat from '@/components/ReportAIChat';
import { useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
// Audio/Video opened via external links (Linking.openURL)
import type { ResearchReport } from '@/lib/types';

type TabType = 'report' | 'audio' | 'video';

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const { subscription, kyc, profile } = useAuth();
    const { user } = useUser();

    const [activeTab, setActiveTab] = useState<TabType>('report');
    const [showAIChat, setShowAIChat] = useState(false);

    const { data: report, isLoading } = useQuery({
        queryKey: ['report_detail', id],
        queryFn: async (): Promise<ResearchReport | null> => {
            const { data } = await supabase
                .from('research_reports')
                .select('*')
                .eq('report_id', id!)
                .eq('is_published', true)
                .maybeSingle();
            return data;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background }]}>
                <ActivityIndicator size="large" color={Colors.brand.secondary} />
            </View>
        );
    }

    if (!report) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background }]}>
                <Ionicons name="document-text-outline" size={48} color={c.textTertiary} />
                <Text style={[styles.emptyTitle, { color: c.text }]}>Report Not Found</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: Colors.brand.secondary, fontWeight: '600' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!kyc || !profile) {
        const isKycMissing = !kyc;
        const missingText = isKycMissing ? 'KYC' : 'Risk Profiling';
        const route = isKycMissing ? '/(kyc)' : '/(profiling)';
        const btnText = isKycMissing ? 'Complete KYC' : 'Complete Risk Profile';

        return (
            <View style={[styles.loadingWrap, { backgroundColor: c.background, padding: Spacing['2xl'] }]}>
                <Ionicons name="shield-half" size={64} color={c.textTertiary} style={{ marginBottom: Spacing.lg }} />
                <Text style={{ fontSize: FontSize.xl, fontWeight: '800', color: c.text, marginBottom: Spacing.sm, textAlign: 'center' }}>
                    {missingText} Required
                </Text>
                <Text style={{ fontSize: FontSize.base, color: c.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }}>
                    You must complete your {missingText} to access this research report.
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: Spacing.xl, paddingVertical: 14, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => router.push(route)}
                >
                    <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>{btnText}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.xl }}>
                    <Text style={{ color: Colors.brand.secondary, fontWeight: '600', fontSize: FontSize.md }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const hasPdf = !!report.pdf_file_url;
    const hasAudio = !!report.audio_file_url;
    const hasVideo = !!report.video_file_url;

    const hasActiveSubscription = !!subscription?.is_active;
    const canAudio = hasActiveSubscription;
    const canVideo = hasActiveSubscription;

    const tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap; available: boolean; locked: boolean }[] = [
        { key: 'report', label: 'Report', icon: 'document-text', available: hasPdf, locked: false },
        { key: 'audio', label: 'Audio', icon: 'headset', available: hasAudio, locked: !canAudio },
        { key: 'video', label: 'Video', icon: 'videocam', available: hasVideo, locked: !canVideo },
    ];

    const renderTextSection = (title: string, content: string | null) => {
        if (!content) return null;
        return (
            <View style={styles.textSection}>
                <Text style={[styles.sectionHeading, { color: c.text }]} selectable={false}>{title}</Text>
                <Text style={[styles.sectionBody, { color: c.textSecondary }]} selectable={false}>{content}</Text>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={c.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.companyName, { color: c.text }]} numberOfLines={1}>{report.company_name}</Text>
                    <View style={styles.metaRow}>
                        <Text style={[styles.symbol, { color: c.textTertiary }]}>{report.nse_symbol}</Text>
                        {report.recommendation && <RecommendationBadge recommendation={report.recommendation} theme={theme} />}
                        {report.target_price && (
                            <Text style={[styles.targetText, { color: c.textSecondary }]}>
                                Target ₹{report.target_price.toLocaleString('en-IN')}
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Tab Switcher */}
            <View style={[styles.tabRow, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tab,
                            activeTab === tab.key && { borderBottomColor: Colors.brand.primary, borderBottomWidth: 2 },
                            !tab.available && { opacity: 0.3 },
                        ]}
                        onPress={() => {
                            if (tab.locked) {
                                router.push('/subscription');
                            } else if (tab.available) {
                                setActiveTab(tab.key);
                            }
                        }}
                        disabled={!tab.available && !tab.locked}
                    >
                        <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? Colors.brand.primary : c.textTertiary} />
                        <Text style={[styles.tabLabel, { color: activeTab === tab.key ? Colors.brand.primary : c.textTertiary }]}>{tab.label}</Text>
                        {tab.locked && <Ionicons name="lock-closed" size={10} color={Colors.brand.gold} />}
                    </TouchableOpacity>
                ))}
                {/* Ask AI Tab */}
                <TouchableOpacity
                    style={[
                        styles.tab,
                        { borderBottomColor: 'transparent' },
                    ]}
                    onPress={() => setShowAIChat(true)}
                >
                    <Ionicons name="sparkles" size={16} color={Colors.brand.accent} />
                    <Text style={[styles.tabLabel, { color: Colors.brand.accent, fontWeight: '700' }]}>Ask AI</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ResponsiveScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer}>
                {user && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <Text
                                key={i}
                                style={{
                                    color: c.textTertiary,
                                    opacity: 0.1,
                                    fontSize: 14,
                                    transform: [{ rotate: '-45deg' }],
                                    position: 'absolute',
                                    top: Math.random() * 1000 + (i * 50),
                                    left: Math.random() * 400 - 100,
                                }}
                            >
                                {user.primaryEmailAddress?.emailAddress || user.id}
                            </Text>
                        ))}
                    </View>
                )}
                {activeTab === 'report' && (
                    <>
                        {hasPdf && (
                            <TouchableOpacity
                                style={[styles.pdfBtn, { backgroundColor: Colors.brand.primary }]}
                                onPress={() => WebBrowser.openBrowserAsync(report.pdf_file_url!)}
                            >
                                <Ionicons name="document-text" size={18} color="#fff" />
                                <Text style={styles.pdfBtnText}>View Full Report PDF</Text>
                            </TouchableOpacity>
                        )}
                        {renderTextSection('Company Background', report.company_background)}
                        {renderTextSection('Business Model', report.business_model)}
                        {renderTextSection('Management Analysis', report.management_analysis)}
                        {renderTextSection('Industry Overview', report.industry_overview)}
                        {renderTextSection('Industry Tailwinds', report.industry_tailwinds)}
                        {renderTextSection('Demand Drivers', report.demand_drivers)}
                        {renderTextSection('Industry Risks', report.industry_risks)}
                        {report.recommendation_rationale && renderTextSection('Recommendation Rationale', report.recommendation_rationale)}

                        {/* SEBI Disclaimer */}
                        <View style={[styles.sebiDisclaimer, { backgroundColor: c.surface, borderColor: c.border }]}>
                            <View style={styles.sebiDisclaimerHeader}>
                                <Ionicons name="information-circle" size={16} color={c.textTertiary} />
                                <Text style={[styles.sebiDisclaimerTitle, { color: c.textTertiary }]}>Important Disclaimer</Text>
                            </View>
                            <Text style={[styles.sebiDisclaimerText, { color: c.textTertiary }]}>
                                Investment in securities market is subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.{'\n\n'}
                                This report is prepared for informational purposes only and does not constitute investment advice, an offer to sell, or a solicitation to buy any securities. Past performance is not indicative of future results. Investors should consult their financial advisor before making any investment decisions.{'\n\n'}
                                SEBI Research Analyst Reg. No.: INH000069807
                            </Text>
                        </View>
                    </>
                )}

                {activeTab === 'audio' && hasAudio && canAudio && (
                    <View style={[styles.mediaCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                        <View style={[styles.mediaIconCircle, { backgroundColor: Colors.brand.primary + '15' }]}>
                            <Ionicons name="headset" size={32} color={Colors.brand.primary} />
                        </View>
                        <Text style={[styles.mediaTitle, { color: c.text }]}>Audio Summary</Text>
                        <Text style={[styles.mediaSub, { color: c.textSecondary }]}>AI-narrated research brief</Text>
                        <TouchableOpacity
                            style={[styles.playBtn, { backgroundColor: Colors.brand.primary }]}
                            onPress={() => RNLinking.openURL(report.audio_file_url!)}
                        >
                            <Ionicons name="play" size={18} color="#fff" />
                            <Text style={styles.playBtnText}>Play Audio</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {activeTab === 'video' && hasVideo && canVideo && (
                    <View style={[styles.mediaCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                        <View style={[styles.mediaIconCircle, { backgroundColor: Colors.brand.primary + '15' }]}>
                            <Ionicons name="videocam" size={32} color={Colors.brand.primary} />
                        </View>
                        <Text style={[styles.mediaTitle, { color: c.text }]}>Video Research Brief</Text>
                        <Text style={[styles.mediaSub, { color: c.textSecondary }]}>AI-generated video summary</Text>
                        <TouchableOpacity
                            style={[styles.playBtn, { backgroundColor: Colors.brand.primary }]}
                            onPress={() => RNLinking.openURL(report.video_file_url!)}
                        >
                            <Ionicons name="play" size={18} color="#fff" />
                            <Text style={styles.playBtnText}>Watch Video</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ResponsiveScrollView>

            {/* Floating AI Chat Button */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: Colors.brand.primary }]}
                onPress={() => setShowAIChat(true)}
                activeOpacity={0.85}
            >
                <Ionicons name="sparkles" size={22} color="#fff" />
            </TouchableOpacity>

            {/* AI Chat Modal */}
            <ReportAIChat
                visible={showAIChat}
                onClose={() => setShowAIChat(false)}
                report={report}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyTitle: { fontSize: FontSize.md, fontWeight: '600' },
    header: { paddingTop: Platform.select({ ios: 56, web: 16, default: 48 }), paddingBottom: Spacing.md, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderBottomWidth: 1 },
    backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    companyName: { fontSize: FontSize.lg, fontWeight: '800' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    symbol: { fontSize: FontSize.xs, fontFamily: 'monospace' },
    targetText: { fontSize: FontSize.xs },
    tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: Spacing.xl },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
    tabLabel: { fontSize: FontSize.sm, fontWeight: '600' },
    contentContainer: { padding: Spacing.xl, paddingBottom: 40 },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
    pdfBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },
    textSection: { marginBottom: Spacing['2xl'] },
    sectionHeading: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.sm },
    sectionBody: { fontSize: FontSize.base, lineHeight: 24 },
    mediaCard: { alignItems: 'center', padding: Spacing['3xl'], borderRadius: BorderRadius.xl, borderWidth: 1 },
    mediaIconCircle: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
    mediaTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    mediaSub: { fontSize: FontSize.sm, marginTop: 4, marginBottom: Spacing.xl },
    playBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: BorderRadius.md },
    playBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
    fab: { position: 'absolute', bottom: Platform.select({ ios: 40, default: 24 }), right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
    sebiDisclaimer: { marginTop: Spacing['2xl'], padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
    sebiDisclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
    sebiDisclaimerTitle: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    sebiDisclaimerText: { fontSize: 11, lineHeight: 16 },
});
