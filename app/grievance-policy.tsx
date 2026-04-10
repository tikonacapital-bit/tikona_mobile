import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GrievancePolicyScreen() {
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
                <Text style={styles.headerTitle}>Grievance Policy</Text>
                <Text style={styles.headerSubtitle}>Grievance Redressal Process</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>Last Updated: 31 December 2025</Text>

                    <Text style={[styles.heading, { color: c.text }]}>1. Introduction</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        At Tikona Capital, we are committed to providing our clients with exceptional financial services. However, if any client experiences dissatisfaction with our services, we encourage them to raise their concerns through the following grievance redressal process.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>2. Scope</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        This policy applies to any complaints or concerns regarding our services, including small case, equity model portfolio management, and financial planning. This policy covers issues related to:
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  Service quality</Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  Client servicing delays</Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  Portfolio management issues</Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  Any other grievances related to our offerings</Text>
                    </View>

                    <Text style={[styles.heading, { color: c.text }]}>3. How to Submit a Complaint</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        If you have any complaints, please reach out through the following methods:
                    </Text>
                    <View style={styles.contactCard}>
                        <Text style={[styles.contactLabel, { color: c.textTertiary }]}>Email</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@tikonacapital.com')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>contact@tikonacapital.com</Text>
                        </TouchableOpacity>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Phone</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('tel:9324209932')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>9324209932</Text>
                        </TouchableOpacity>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Address</Text>
                        <Text style={[styles.contactValue, { color: c.text }]}>2C 123 Kalpataru estate, JVLR, Andheri East, Mumbai, 400093</Text>
                    </View>

                    <Text style={[styles.subheading, { color: c.text }]}>When submitting a complaint, please include:</Text>
                    <View style={styles.bulletList}>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  Your name and contact information</Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  The details of your grievance</Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  Supporting documents (if any)</Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  Previous communications (if relevant)</Text>
                    </View>

                    <Text style={[styles.heading, { color: c.text }]}>4. Grievance Handling Process</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        Once we receive your complaint, the following steps will be taken:
                    </Text>
                    <View style={styles.stepsList}>
                        <View style={styles.stepRow}>
                            <View style={[styles.stepBadge, { backgroundColor: Colors.brand.secondary }]}>
                                <Text style={styles.stepBadgeText}>1</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.stepTitle, { color: c.text }]}>Acknowledgment</Text>
                                <Text style={[styles.stepDesc, { color: c.textSecondary }]}>We will acknowledge your complaint within 2 business days via email or phone.</Text>
                            </View>
                        </View>
                        <View style={styles.stepRow}>
                            <View style={[styles.stepBadge, { backgroundColor: Colors.brand.secondary }]}>
                                <Text style={styles.stepBadgeText}>2</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.stepTitle, { color: c.text }]}>Assessment</Text>
                                <Text style={[styles.stepDesc, { color: c.textSecondary }]}>Our grievance redressal team will assess the issue and may request additional details.</Text>
                            </View>
                        </View>
                        <View style={styles.stepRow}>
                            <View style={[styles.stepBadge, { backgroundColor: Colors.brand.secondary }]}>
                                <Text style={styles.stepBadgeText}>3</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.stepTitle, { color: c.text }]}>Resolution</Text>
                                <Text style={[styles.stepDesc, { color: c.textSecondary }]}>We aim to resolve all complaints within 10 business days from the date of receipt. If the issue is complex and requires more time, we will keep you informed and provide an expected resolution timeline.</Text>
                            </View>
                        </View>
                        <View style={styles.stepRow}>
                            <View style={[styles.stepBadge, { backgroundColor: Colors.brand.secondary }]}>
                                <Text style={styles.stepBadgeText}>4</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.stepTitle, { color: c.text }]}>Escalation</Text>
                                <Text style={[styles.stepDesc, { color: c.textSecondary }]}>If you are not satisfied with the resolution provided, you may escalate the matter by contacting our Compliance Officer.</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={[styles.heading, { color: c.text }]}>5. Contact Details for Escalation</Text>
                    <View style={styles.contactCard}>
                        <Text style={[styles.contactLabel, { color: c.textTertiary }]}>Compliance Officer</Text>
                        <Text style={[styles.contactValue, { color: c.text }]}>Sumit Poddar</Text>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Phone</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('tel:9833362498')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>9833362498</Text>
                        </TouchableOpacity>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Email</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:sumitpoddar@tikonacapital.com')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>sumitpoddar@tikonacapital.com</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.heading, { color: c.text }]}>6. SEBI SCORES Portal</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        In case your grievance is not resolved to your satisfaction, you may file a complaint with SEBI through the SCORES (SEBI Complaints Redress System) portal. You can register your complaint online and track its status using the SEBI SCORES platform.
                    </Text>
                    <TouchableOpacity
                        style={[styles.linkBtn, { backgroundColor: Colors.brand.secondary + '15', borderColor: Colors.brand.secondary + '30' }]}
                        onPress={() => Linking.openURL('https://scores.sebi.gov.in')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="open-outline" size={16} color={Colors.brand.secondary} />
                        <Text style={[styles.linkBtnText, { color: Colors.brand.secondary }]}>Visit SCORES Portal</Text>
                    </TouchableOpacity>
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
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    content: { padding: Spacing.xl },
    card: { padding: Spacing.xl },
    lastUpdated: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.lg, fontStyle: 'italic' },
    heading: { fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.xl, marginBottom: Spacing.md },
    subheading: { fontSize: FontSize.base, fontWeight: '600', marginTop: Spacing.lg, marginBottom: Spacing.sm },
    paragraph: { fontSize: FontSize.sm, lineHeight: 24 },
    bulletList: { marginVertical: Spacing.sm, paddingLeft: Spacing.sm, gap: 6 },
    bullet: { fontSize: FontSize.sm, lineHeight: 22 },
    stepsList: { marginTop: Spacing.md, gap: 16 },
    stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    stepBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    stepBadgeText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
    stepTitle: { fontSize: FontSize.base, fontWeight: '600', marginBottom: 2 },
    stepDesc: { fontSize: FontSize.sm, lineHeight: 22 },
    contactCard: { marginTop: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg },
    contactLabel: { fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    contactValue: { fontSize: FontSize.base, fontWeight: '600', marginTop: 2 },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.md, alignSelf: 'flex-start' },
    linkBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
    footerSpacer: { height: 40 },
});
