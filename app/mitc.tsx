import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MITCScreen() {
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
                <Text style={styles.headerTitle}>MITC</Text>
                <Text style={styles.headerSubtitle}>Most Important Terms and Conditions</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>Last Updated: 5 January 2026</Text>
                    
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        <Text style={[styles.bold, { color: c.text }]}>1.</Text> These terms and conditions, and consent thereon are for the research services provided by the Research Analyst (RA) and RA cannot execute/carry out any trade (purchase/sell transaction) on behalf of the client. Thus, the clients are advised not to permit RA to execute any trade on their behalf.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>2.</Text> The fee charged by RA to the client will be subject to the maximum of amount prescribed by SEBI/ Research Analyst Administration and Supervisory Body (RAASB) from time to time (applicable only for Individual and HUF Clients).{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>Note:</Text>{'\n'}
                        2.1. The current fee limit is Rs 1,51,000/- per annum per family of client for all research services of the RA.{'\n'}
                        2.2. The fee limit does not include statutory charges.{'\n'}
                        2.3. The fee limits do not apply to a non-individual client / accredited investor.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>3.</Text> RA may charge fees in advance if agreed by the client. Such advance shall not exceed the period stipulated by SEBI; presently it is upto one year. In case of pre-mature termination of the RA services by either the client or the RA, the client shall be entitled to seek refund of proportionate fees only for an unexpired period.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>4.</Text> Fees to RA may be paid by the client through any of the specified modes like cheque, online bank transfer, UPI, etc. Cash payment is not allowed. Optionally the client can make payments through Centralized Fee Collection Mechanism (CeFCoM) managed by BSE Limited (i.e. currently recognized RAASB).{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>5.</Text> The RA is required to abide by the applicable regulations/ circulars/ directions specified by SEBI and RAASB from time to time in relation to disclosure and mitigation of any actual or potential conflict of interest. The RA will endeavor to promptly inform the client of any conflict of interest that may affect the services being rendered to the client.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>6.</Text> Any assured/guaranteed/fixed returns schemes or any other schemes of similar nature are prohibited by law. No scheme of this nature shall be offered to the client by the RA.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>7.</Text> The RA cannot guarantee returns, profits, accuracy, or risk-free investments from the use of the RA’s research services. All opinions, projections, estimates of the RA are based on the analysis of available data under certain assumptions as of the date of preparation/publication of the research report.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>8.</Text> Any investment made based on recommendations in research reports are subject to market risks, and recommendations do not provide any assurance of returns. There is no recourse to claim any losses incurred on the investments made based on the recommendations in the research report. Any reliance placed on the research report provided by the RA shall be as per the client’s own judgement and assessment of the conclusions contained in the research report.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>9.</Text> The SEBI registration, Enlistment with RAASB, and NISM certification do not guarantee the performance of the RA or assure any returns to the client.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>10. For any grievances:</Text>{'\n'}
                        <Text style={[styles.bold, { color: c.text }]}>Step 1:</Text> The client should first contact the RA using the details grievance/ escalation matrix on its website or following contact details:{'\n'}
                        Principal Officer : Sumit Poddar , 2C/123 Kalpataru Estate, JVLR, Andheri East, Mumbai : 400093{'\n'}
                        Contact Details: 98333 62498 / sumitpoddar@tikonacapital.com{'\n'}
                        Timing: 9:00 AM to 6:00 PM{'\n\n'}
                        <Text style={[styles.bold, { color: c.text }]}>Step 2:</Text> If the resolution is unsatisfactory, the client can also lodge grievances through SEBI’s SCORES platform at www.scores.sebi.gov.in{'\n\n'}
                        <Text style={[styles.bold, { color: c.text }]}>Step 3:</Text> The client may also consider the Online Dispute Resolution (ODR) through the Smart ODR portal at https://smartodr.in{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>11.</Text> Clients are required to keep contact details, including email id and mobile number/s updated with the RA at all times.{'\n\n'}
                        
                        <Text style={[styles.bold, { color: c.text }]}>12.</Text> The RA shall never ask for the client’s login credentials and OTPs for the client’s Trading Account Demat Account and Bank Account. Never share such information with anyone including RA.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>Terms and Conditions</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        By ordering Services you are agreeing to these Terms & Conditions.{'\n\n'}
                        We are SEBI registered Research Analyst registered under SEBI (Research Analysts) Regulations, 2014 Registration No. INH000009807.{'\n\n'}
                        Tikona Capital shall have no responsibility for any loss incurred from services, decisions/ actions taken on the market for stock transactions, the information provided here is based on our knowledge and we do not ask/force you to take market positions in any particular investment.{'\n\n'}
                        We are not bound and liable for your market loss as profits and losses in equity are subjected to market risk. We are not responsible for any future liability arise under Prevention and Money Laundering Act, 2002 and other similar Act, Regulation, and rules.{'\n\n'}
                        This is no guaranteed return product or service. Markets are of risk and can never be eliminated. As per SEBI guidelines, we cannot guarantee the returns too.{'\n\n'}
                        Our clients (Paid or Unpaid), Any third party or anyone else have no rights to forward or share our investment ideas or SMS or Report or Any Information provided by us to / with anyone which is received directly or indirectly by them. If found so then Legal Actions can be taken.{'\n\n'}
                        Tikona Capital and their owners, partners, employees, affiliates, agents, representatives or subcontractors shall not be liable for any loss or liability resulting, directly or indirectly, from delays or interruptions due to electronic or mechanical equipment failures, telephone interconnect problems, defects, weather, strikes, walkouts, fire, acts of God, riots, armed conflicts, acts of war, or other like causes.{'\n\n'}
                        Unauthorized attempts to upload information, change or delete information on our website or smallcase or online are strictly prohibited and punishable under Indian IT Act.{'\n\n'}
                        Payment of fee will only be through online or proper banking channel. No cash receipt will be accepted. The Amount of fee is the consideration for our services.{'\n\n'}
                        We provide advice through email only. Please do not act on the advice which is not provided through registered email.{'\n\n'}
                        All research that we conduct is based on Fundamental studies, Technical analysis and Primary market analysis. It has a model and methods to decide upon stocks and their buy sell prices. Though this has worked well in the past doesn’t guarantee to work all the time or every time in future.{'\n\n'}
                        We received your express and implied consent on the point that Fee is reasonable and fair for you.{'\n\n'}
                        The Research Analyst and the Client hereby confirm and agree that they shall execute an Terms of services as per the terms prescribed by the Securities and Exchange Board of India (SEBI).{'\n\n'}
                        At the time of your subscription Tikona capital their owners, relatives, clients partners, employees, affiliates, agents, representatives etc may have position in the recommendations.{'\n\n'}
                        The Client hereby represents and warrants to the Research Analyst that he/she wants to avail the Research services only for himself / herself and not for any other person.
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
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    content: { padding: Spacing.xl },
    card: { padding: Spacing.xl },
    lastUpdated: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.lg, fontStyle: 'italic' },
    heading: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        marginTop: Spacing.xl,
        marginBottom: Spacing.md,
    },
    paragraph: {
        fontSize: FontSize.sm,
        lineHeight: 24,
    },
    bold: {
        fontWeight: '700',
    },
    footerSpacer: { height: 40 },
});
