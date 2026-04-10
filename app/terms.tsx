import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <LinearGradient
                colors={[Colors.brand.primary, '#1e3a8a']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Terms of Use</Text>
                <Text style={styles.headerSubtitle}>Last Updated: 31 December 2025</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <Text style={[styles.heading, { color: c.text }]}>Introduction</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        These terms and conditions (“Terms of Use”) shall govern your use of www.tikonacapital.com (“Website”). By using the Website in any manner whatsoever, you accept these Terms of Use in full.{'\n\n'}
                        In these Terms of Use, “we”, “us”, “our” or “Tikona” refers to Tikona Capital.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>1. Usage of the Website</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        (a) Your usage of the Website shall be for personal and non-commercial use only. The information available on the Website shall be for educational and informational purposes only.{'\n'}
                        (b) Nothing on the Website shall be considered a recommendation to buy or an offer to sell, a particular investment opportunity, a security, or any other product or service.{'\n'}
                        (c) The Website is not intended to provide any advice, and should be construed as a recommendation, by us or any third party, to acquire or dispose of any investment or security, or to get involved in any investment related strategy or transaction.{'\n'}
                        (d) There are certain tools available on the Website that provide analyses based upon your personalized input. Under no circumstances shall the results of such input on the Website be construed as us providing investment recommendations or advice.{'\n'}
                        (e) For the avoidance of doubt, all applicable terms related to the Website in these Terms of Use shall apply to communication you receive from the Website as well.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>2. Copyright Notice</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        (a) Unless otherwise stated to the contrary, we, together with our licensors own and control intellectual property rights including the content generated based on your inputs on the Website (all such content on the Website is hereinafter collectively referred to as “Content”); and{'\n'}
                        (b) All rights with respect to the Content are reserved;{'\n'}
                        (c) You must not download, save, copy, alter, edit, modify, disseminate, share, display and/or create derivative works from the Content without our prior written permission.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>3. Disclaimers</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        (a) You expressly acknowledge and agree that use of the Website is entirely at your own risk and that all information provided is on an "as is" basis, without any warranties of any kind.{'\n'}
                        (b) All express and implied warranties, including, without limitation, the warranties of merchantability, fitness for a particular purpose, and non-infringement of proprietary rights are expressly disclaimed to the fullest extent permitted by law. To the extent permitted by law, Tikona Capital its officers, proprietor employees, and agents disclaim all warranties, express or implied, in connection with the Website and your use thereof.{'\n'}
                        (c) We make no warranties or representations about the accuracy or completeness of the information provided on the Website and we assume no liability or responsibility of any kind whatsoever.{'\n'}
                        (d) It is strongly advised you use your best judgment, carry out the necessary due diligence and exercise caution when using information from the Website.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>4. Privacy</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        (a) Please refer to our Privacy Policy.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>5. Limitation of Liability</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        (a) To the extent permissible under the laws of India, we will not be liable for any direct, special, incidental, indirect or consequential damages, including without limitation for any lost profits or lost data, that result from the use of, or the inability to use the Website even if we have been advised of the possibility of such damages. If we are found to be liable to you for any damage or loss which is in any way connected with your use of the Website in, our liability shall not exceed INR 1,000.
                    </Text>

                    <Text style={[styles.heading, { color: c.text }]}>6. Other Terms</Text>
                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        (a) These Terms of Use may be amended from time to time. Such amended Terms of Use shall apply to you as on the date of its publication on the Website.{'\n'}
                        (b) You hereby agree that we may assign, transfer, sub-contract or otherwise deal with our rights and/or obligations under these Terms of Use.{'\n'}
                        (c) If a provision of these Terms of Use is determined by any court to be unlawful and/or unenforceable, the other provisions will continue in effect.{'\n'}
                        (d) These Terms of Use cannot be enforced by any third-party.{'\n'}
                        (e) These Terms of Use shall constitute the entire agreement between you and us and your use of the website to the exclusion of any other terms and conditions.{'\n'}
                        (f) The Terms of Use shall be governed by the Laws of India. Any dispute arising out of or in relation to these Terms of Use shall be brought before a court of competent jurisdiction in Mumbai.{'\n'}
                        (g) You can contact us at contact@tikonacapital.com
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
    heading: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        marginTop: Spacing.xl,
        marginBottom: Spacing.sm,
    },
    paragraph: {
        fontSize: FontSize.sm,
        lineHeight: 22,
    },
    footerSpacer: { height: 40 },
});
