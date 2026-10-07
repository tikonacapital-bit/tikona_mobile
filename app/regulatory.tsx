import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { ThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

function LinkRow({ icon, label, onPress, theme }: { icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, theme: ThemeMode }) {
    const c = Colors[theme];
    return (
        <TouchableOpacity style={[styles.row, { borderBottomColor: c.borderLight }]} onPress={onPress} activeOpacity={0.6}>
            <Ionicons name={icon} size={20} color={Colors.brand.secondary} />
            <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
        </TouchableOpacity>
    );
}

export default function RegulatoryScreen() {
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
                <Text style={styles.headerTitle}>Regulatory & Compliance</Text>
                <Text style={styles.headerSubtitle}>Legal documents and policies</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.card}>
                    <LinkRow theme={theme} icon="document-text-outline" label="Investor Charter (Research Analyst)" onPress={() => Linking.openURL('https://cms.tikonacapital.com/uploads/Investor_Charter_520d9b2317.pdf')} />
                    <LinkRow theme={theme} icon="document-outline" label="Complaints & Compliance Report" onPress={() => Linking.openURL('https://cms.tikonacapital.com/uploads/Complaints_and_Annual_Compliance_Report_2ec571da68.pdf')} />
                    <LinkRow theme={theme} icon="document-text-outline" label="T&C of Research Services" onPress={() => Linking.openURL('https://cms.tikonacapital.com/uploads/T_and_C_of_Research_Services_4138d2d086.pdf')} />
                    <LinkRow theme={theme} icon="alert-circle-outline" label="MITC" onPress={() => router.push('/mitc')} />
                    <LinkRow theme={theme} icon="hardware-chip-outline" label="Use of AI" onPress={() => router.push('/ai-policy')} />
                    <LinkRow theme={theme} icon="information-circle-outline" label="Disclosure" onPress={() => router.push('/disclosure')} />
                    <LinkRow theme={theme} icon="warning-outline" label="Disclaimer" onPress={() => router.push('/disclaimer')} />
                    <LinkRow theme={theme} icon="shield-half-outline" label="Grievance Policy" onPress={() => router.push('/grievance-policy')} />
                    <LinkRow theme={theme} icon="call-outline" label="Grievance Contact" onPress={() => router.push('/grievance-contact')} />
                    <LinkRow theme={theme} icon="open-outline" label="SmartODR" onPress={() => Linking.openURL('https://smartodr.in/login')} />
                    <LinkRow theme={theme} icon="open-outline" label="SEBI Scores Portal" onPress={() => Linking.openURL('https://scores.sebi.gov.in/')} />
                    <LinkRow theme={theme} icon="shield-outline" label="Privacy Policy" onPress={() => router.push('/privacy-policy')} />
                    <View style={{ borderBottomWidth: 0 }}>
                        <LinkRow theme={theme} icon="document-text-outline" label="Terms of Service" onPress={() => router.push('/terms')} />
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
    card: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: Spacing.md },
    rowLabel: { fontSize: FontSize.base, fontWeight: '500', flex: 1 },
    footerSpacer: { height: 40 },
});
