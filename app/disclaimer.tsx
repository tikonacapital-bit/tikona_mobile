import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DisclaimerScreen() {
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
                <Text style={styles.headerTitle}>Disclaimer</Text>
                <Text style={styles.headerSubtitle}>Important information</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>Last Updated: 1 January 2026</Text>

                    <Text style={[styles.paragraph, { color: c.textSecondary }]}>
                        The information contained on this website is for general information purposes only. The information is provided by the Tikona Capital website, a property of Tikona Capital. While we endeavour to keep the information up to date and correct, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability or availability with respect to the website or the information, products, services, or related graphics contained on the website for any purpose. Any reliance you place on such information is therefore strictly at your own risk.{'\n\n'}
                        In no event will we be liable for any loss or damage including without limitation, indirect or consequential loss or damage, or any loss or damage whatsoever arising from loss of data or profits arising out of, or in connection with, the use of this website. Through this website you are able to link to other websites which are not under the control of Tikona Capital. We have no control over the nature, content and availability of those sites. The inclusion of any links does not necessarily imply a recommendation or endorse the views expressed within them.{'\n\n'}
                        Every effort is made to keep the website up and running smoothly. However, Tikona Capital takes no responsibility for, and will not be liable for, the website being temporarily unavailable due to technical issues beyond our control.
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
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    content: { padding: Spacing.xl },
    card: { padding: Spacing.xl },
    lastUpdated: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.lg, fontStyle: 'italic' },
    paragraph: { fontSize: FontSize.sm, lineHeight: 24 },
    footerSpacer: { height: 40 },
});
