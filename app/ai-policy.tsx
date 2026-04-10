import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AIPolicyScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <LinearGradient
                colors={isDark ? ['#0f172a', '#1e293b'] : [Colors.brand.primary, '#1e3a8a']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Use of Artificial Intelligence (AI)</Text>
                <Text style={styles.headerSubtitle}>Disclosure Statement</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>Last Updated: 14 January 2026</Text>

                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        This disclosure is made in compliance with the Securities and Exchange Board of India (Research Analysts) (Third Amendment) Regulations, 2024. Tikona Capital, a SEBI-registered Research Analyst, utilizes AI tools to augment its research process. The extent of AI utilization is as follows:
                    </Text>

                    <View style={styles.bulletList}>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Data aggregation and processing from sources including, but not limited to, financial news, company filings, and market data.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Algorithmic analysis for pattern, trend, and correlation identification in financial data.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Summarization and generation of financial information and forecast.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Risk assessment analysis.
                        </Text>
                    </View>

                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        AI tools supplement, and do not replace, human analysis. All research recommendations reflect the Research Analyst's judgment. Tikona Capital is responsible for the due diligence, accuracy, reliability, and regulatory compliance of all research. Reasonable measures are implemented to ensure the security, confidentiality, and integrity of client data used by AI tools if any. The performance of AI tools is regularly reviewed and monitored.{'\n\n'}
                        The AI tools used are subject to ongoing development, and the extent of their utilization may be modified. Clients will be notified of material changes to this disclosure.{'\n\n'}
                        Tikona Capital is committed to providing high-quality research services and ensuring transparency. Inquiries regarding this disclosure or our research methodology may be directed to the contact information provided below.
                    </Text>
                </Card>
                <View style={styles.footerSpacer} />
            </ResponsiveScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: Platform.select({ ios: 60, web: 24, default: 48 }),
        paddingBottom: 32,
        paddingHorizontal: Spacing.xl,
        borderBottomLeftRadius: BorderRadius['3xl'],
        borderBottomRightRadius: BorderRadius['3xl'],
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    content: { padding: Spacing.xl },
    card: { padding: Spacing.xl },
    lastUpdated: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.lg, fontStyle: 'italic' },
    paragraph: { fontSize: FontSize.sm, lineHeight: 24 },
    bold: { fontWeight: '700' },
    bulletList: { marginVertical: Spacing.md, paddingLeft: Spacing.sm, gap: 8 },
    bullet: { fontSize: FontSize.sm, lineHeight: 22 },
    footerSpacer: { height: 40 },
});
