import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DisclosureScreen() {
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
                <Text style={styles.headerTitle}>Disclosure</Text>
                <Text style={styles.headerSubtitle}>SEBI Research Analyst Disclosures</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>Last Updated: 3 January 2026</Text>

                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        Sumit Poddar is registered with SEBI with INH000009807 as the SEBI registration number. The registered office address of Sumit Poddar is 2C / 123, Kalpataru estate, JVLR, Opp Oberoi International School, Andheri East, MUMBAI, MAHARASHTRA, 400093.{'\n\n'}
                        Investments in securities market are subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI, membership of BSE and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>About Us</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        Research Analyst is registered with SEBI as Research Analyst with Registration No. INH000009807. BSE Enlistment No 5585. The firm got its registration on June 13, 2022 and is engaged in research services. Disciplinary history: No penalties / directions have been issued by SEBI under the SEBI Act or Regulations made there under.{'\n\n'}
                        There are no pending material litigations or legal proceedings, findings of inspections or investigations for which action has been taken or initiated by any regulatory authority. Details of its associates: Directorship in Tikona Capital Finserv Pvt Ltd.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>Disclosures with respect to Research and Recommendations Services</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        Registration granted by SEBI, membership of BASL and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors. Investment in securities market are subject to market risks. Read all the related documents carefully before investing.{'\n\n'}
                        Research Analyst may have financial interest or actual / beneficial ownership in the securities recommended in its personal portfolio. There are no actual or potential conflicts of interest arising from any connection to or association with any issuer of products/ securities, including any material information or facts that might compromise its objectivity or independence in the carrying on of Research Analyst services.
                    </Text>

                    <View style={styles.bulletList}>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Research Analyst or its employee or its associates have not received any compensation from the subject company in past 12 months.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Research Analyst or its employee or its associates have not managed or co-managed the public offering of Subject Company in past 12 months.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Research Analyst or its employee or its associates have not received any compensation for investment banking or merchant banking of brokerage services from the subject company in past 12 months.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Research Analyst or its employee or its associates have not received any compensation for products or services other than above from the subject company in past 12 months.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Research Analyst or its employee or its associates have not received any compensation or other benefits from the Subject Company or 3rd party in connection with the research report/ recommendation.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  The subject company was not a client of Research Analyst or its employee or its associates during twelve months preceding the date of distribution of the research report and recommendation services provided.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Research Analysts or its employee or its associates has not served as an officer, director or employee of the subject company.
                        </Text>
                        <Text style={[styles.bullet, { color: c.textSecondary }]}>
                            <Text style={[styles.bold, { color: c.text }]}>•</Text>  Research Analysts has not been engaged in market making activity of the subject company.
                        </Text>
                    </View>

                    <Text style={[styles.heading, { color: c.text }]}>Disclosure Statement Regarding the Use of AI</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        In compliance with the Securities and Exchange Board of India (Research Analysts) (Third Amendment) Regulations, 2024.{'\n\n'}
                        Tikona Capital, a SEBI-registered Research Analyst, utilizes AI tools to augment its research process. The extent of AI utilization is as follows: Data aggregation and processing from sources including, but not limited to, financial news, company filings, and market data. Algorithmic analysis for pattern, trend, and correlation identification in financial data. Summarization and generation of financial information and forecast. Risk assessment analysis. AI tools supplement, and do not replace, human analysis. All research recommendations reflect the Research Analyst's judgment. Tikona Capital is responsible for the due diligence, accuracy, reliability, and regulatory compliance of all research. Reasonable measures are implemented to ensure the security, confidentiality, and integrity of client data used by AI tools if any. The performance of AI tools is regularly reviewed and monitored. The AI tools used are subject to ongoing development, and the extent of their utilization may be modified. Clients will be notified of material changes to this disclosure.{'\n\n'}
                        Tikona Capital is committed to providing high-quality research services and ensuring transparency. Inquiries regarding this disclosure or our research methodology may be directed to the contact information provided below.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>Contact Details</Text>
                    <View style={styles.contactCard}>
                        <Text style={[styles.contactLabel, { color: c.textTertiary }]}>Support Telephone</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('tel:9833362498')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>9833362498</Text>
                        </TouchableOpacity>

                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Support Email</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:support.smallcase@tikonacapital.com')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>support.smallcase@tikonacapital.com</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.heading, { color: c.text }]}>Compliance Office Details</Text>
                    <View style={styles.contactCard}>
                        <Text style={[styles.contactLabel, { color: c.textTertiary }]}>Name</Text>
                        <Text style={[styles.contactValue, { color: c.text }]}>Sumit Poddar</Text>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Email</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@tikonacapital.com')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>contact@tikonacapital.com</Text>
                        </TouchableOpacity>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Contact</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('tel:9833362498')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>9833362498</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.heading, { color: c.text }]}>Grievance Office Details</Text>
                    <View style={styles.contactCard}>
                        <Text style={[styles.contactLabel, { color: c.textTertiary }]}>Name</Text>
                        <Text style={[styles.contactValue, { color: c.text }]}>Sumit Poddar</Text>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Email</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@tikonacapital.com')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>contact@tikonacapital.com</Text>
                        </TouchableOpacity>
                        <Text style={[styles.contactLabel, { color: c.textTertiary, marginTop: 12 }]}>Contact</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('tel:9833362498')}>
                            <Text style={[styles.contactValue, { color: Colors.brand.secondary }]}>9833362498</Text>
                        </TouchableOpacity>
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
    heading: { fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.xl, marginBottom: Spacing.md },
    paragraph: { fontSize: FontSize.sm, lineHeight: 24 },
    bold: { fontWeight: '700' },
    bulletList: { marginVertical: Spacing.md, paddingLeft: Spacing.sm, gap: 10 },
    bullet: { fontSize: FontSize.sm, lineHeight: 22 },
    contactCard: { marginTop: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg },
    contactLabel: { fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    contactValue: { fontSize: FontSize.base, fontWeight: '600', marginTop: 2 },
    footerSpacer: { height: 40 },
});
