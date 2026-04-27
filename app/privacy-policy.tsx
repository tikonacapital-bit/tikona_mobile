import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicyScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <View style={styles.section}>
            <Text style={[styles.heading, { color: c.text }]}>{title}</Text>
            {children}
        </View>
    );

    const Para = ({ children }: { children: React.ReactNode }) => (
        <Text style={[styles.paragraph, { color: c.textSecondary }]}>{children}</Text>
    );

    const Bullet = ({ children }: { children: React.ReactNode }) => (
        <Text style={[styles.bullet, { color: c.textSecondary }]}>●  {children}</Text>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <LinearGradient
                colors={isDark ? ['#0f172a', '#1e293b'] : [Colors.brand.primary, '#1e3a8a']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
                <Text style={styles.headerSubtitle}>How we collect, use, and protect your data</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>Last Updated: 01 January 2025</Text>

                    <Section title="1. Introduction">
                        <Para>
                            Tikona Capital Finserv Pvt Ltd ("Tikona Capital", "we", "us", or "our"), a company registered under the Companies Act, 2013, and a SEBI Registered Research Analyst (Registration No: INH000009807), is committed to protecting the privacy and security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application ("App") and related services.
                        </Para>
                    </Section>

                    <Section title="2. Information We Collect">
                        <Text style={[styles.subheading, { color: c.text }]}>2.1 Personal Information</Text>
                        <Para>When you register for an account or use our services, we may collect:</Para>
                        <View style={styles.bulletList}>
                            <Bullet>Full name and date of birth</Bullet>
                            <Bullet>Email address and phone number</Bullet>
                            <Bullet>PAN number and other KYC documents</Bullet>
                            <Bullet>Aadhaar number (for verification purposes only)</Bullet>
                            <Bullet>Demat account details</Bullet>
                            <Bullet>Bank account details</Bullet>
                            <Bullet>Investment preferences and risk profile</Bullet>
                        </View>

                        <Text style={[styles.subheading, { color: c.text }]}>2.2 Usage Information</Text>
                        <Para>We automatically collect certain information when you use the App:</Para>
                        <View style={styles.bulletList}>
                            <Bullet>Device information (type, operating system, unique identifiers)</Bullet>
                            <Bullet>Log data (access times, pages viewed, app crashes)</Bullet>
                            <Bullet>Usage patterns and feature interactions</Bullet>
                            <Bullet>IP address and approximate location</Bullet>
                        </View>

                        <Text style={[styles.subheading, { color: c.text }]}>2.3 AI Interaction Data</Text>
                        <Para>When you use our AI-powered features (Sector Analyst, Talk to Report), we collect your queries and interaction history to provide and improve the service. This data is processed in accordance with our AI Policy.</Para>
                    </Section>

                    <Section title="3. How We Use Your Information">
                        <Para>We use the collected information for the following purposes:</Para>
                        <View style={styles.bulletList}>
                            <Bullet>To verify your identity and complete KYC requirements as mandated by SEBI</Bullet>
                            <Bullet>To provide research reports, analysis, and recommendations</Bullet>
                            <Bullet>To process subscriptions and manage your account</Bullet>
                            <Bullet>To power AI-assisted research and analysis features</Bullet>
                            <Bullet>To send service-related notifications and updates</Bullet>
                            <Bullet>To comply with legal and regulatory requirements</Bullet>
                            <Bullet>To improve our services and user experience</Bullet>
                            <Bullet>To detect, prevent, and address fraud or technical issues</Bullet>
                        </View>
                    </Section>

                    <Section title="4. Data Sharing and Disclosure">
                        <Para>We do not sell your personal information to third parties. We may share your information in the following circumstances:</Para>
                        <View style={styles.bulletList}>
                            <Bullet>With SEBI, stock exchanges, and other regulatory bodies as required by law</Bullet>
                            <Bullet>With our technology service providers (Supabase for data hosting, Google for authentication) who are bound by confidentiality agreements</Bullet>
                            <Bullet>With payment processors (Tradebox) to facilitate subscription payments</Bullet>
                            <Bullet>With law enforcement agencies when required by law or court order</Bullet>
                            <Bullet>In connection with a merger, acquisition, or sale of assets (with prior notice to users)</Bullet>
                        </View>
                    </Section>

                    <Section title="5. Data Security">
                        <Para>
                            We implement industry-standard security measures to protect your personal information, including:
                        </Para>
                        <View style={styles.bulletList}>
                            <Bullet>Encryption of data in transit (TLS 1.3) and at rest (AES-256)</Bullet>
                            <Bullet>Secure authentication using OAuth 2.0 and JWT tokens</Bullet>
                            <Bullet>Row-level security policies on database access</Bullet>
                            <Bullet>Regular security audits and vulnerability assessments</Bullet>
                            <Bullet>Access controls and employee training on data protection</Bullet>
                        </View>
                    </Section>

                    <Section title="6. Data Retention">
                        <Para>
                            We retain your personal information for as long as your account is active or as needed to provide services. After account deletion:
                        </Para>
                        <View style={styles.bulletList}>
                            <Bullet>Personal preferences, chat history, and app settings are deleted immediately</Bullet>
                            <Bullet>Financial records and KYC data are retained in encrypted cold storage for 5 years as mandated by SEBI (Research Analysts) Regulations, 2014 and the DPDP Act, 2023</Bullet>
                            <Bullet>Anonymized usage data may be retained for analytics purposes</Bullet>
                        </View>
                    </Section>

                    <Section title="7. Your Rights">
                        <Para>Under the Digital Personal Data Protection Act, 2023, you have the right to:</Para>
                        <View style={styles.bulletList}>
                            <Bullet>Access your personal data held by us</Bullet>
                            <Bullet>Request correction of inaccurate personal data</Bullet>
                            <Bullet>Request deletion of your personal data (subject to regulatory retention requirements)</Bullet>
                            <Bullet>Withdraw consent for data processing</Bullet>
                            <Bullet>File a complaint with the Data Protection Board of India</Bullet>
                        </View>
                    </Section>

                    <Section title="8. Cookies and Tracking">
                        <Para>
                            Our App does not use browser cookies. We may use device identifiers and analytics tools to understand usage patterns and improve the App experience. You can control app-level permissions through your device settings.
                        </Para>
                    </Section>

                    <Section title="9. Children's Privacy">
                        <Para>
                            Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from minors. If we learn that we have collected information from a child under 18, we will take steps to delete it promptly.
                        </Para>
                    </Section>

                    <Section title="10. Changes to This Policy">
                        <Para>
                            We may update this Privacy Policy from time to time. Changes will be posted within the App and, where appropriate, notified to you via email. Continued use of the App after changes constitutes your acceptance of the updated policy.
                        </Para>
                    </Section>

                    <Section title="11. Contact Us">
                        <Para>
                            If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us:
                        </Para>
                        <View style={styles.contactCard}>
                            <Text style={[styles.contactLabel, { color: c.textTertiary }]}>Grievance Officer / Data Protection Officer</Text>
                            <Text style={[styles.contactValue, { color: c.text }]}>Sumit Poddar</Text>
                            <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Email</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@tikonacapital.com')}>
                                <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>contact@tikonacapital.com</Text>
                            </TouchableOpacity>
                            <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Phone</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('tel:9324209932')}>
                                <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>9324209932</Text>
                            </TouchableOpacity>
                            <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Address</Text>
                            <Text style={[styles.contactValue, { color: c.text }]}>2C 123 Kalpataru Estate, JVLR, Andheri East, Mumbai – 400093</Text>
                        </View>
                    </Section>

                    <View style={[styles.sebiFooter, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(31,70,144,0.04)', borderColor: Colors.brand.primary + '20' }]}>
                        <Ionicons name="shield-checkmark" size={16} color={Colors.brand.primary} />
                        <Text style={[styles.sebiFooterText, { color: c.textSecondary }]}>
                            SEBI Registered Research Analyst · Registration No: INH000009807{'\n'}
                            BSE Enlistment No: 5595
                        </Text>
                    </View>
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
    section: { marginBottom: Spacing.xl },
    heading: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
    subheading: { fontSize: FontSize.base, fontWeight: '600', marginTop: Spacing.md, marginBottom: Spacing.sm },
    paragraph: { fontSize: FontSize.sm, lineHeight: 24 },
    bulletList: { marginVertical: Spacing.sm, paddingLeft: Spacing.sm, gap: 6 },
    bullet: { fontSize: FontSize.sm, lineHeight: 22 },
    contactCard: { marginTop: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg },
    contactLabel: { fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    contactValue: { fontSize: FontSize.base, fontWeight: '600', marginTop: 2 },
    sebiFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.xl },
    sebiFooterText: { fontSize: FontSize.xs, lineHeight: 18, flex: 1 },
    footerSpacer: { height: 40 },
});
