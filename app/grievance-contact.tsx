import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

const CONTACTS = [
    { designation: 'Principal Officer', name: 'Sumit Poddar', email: 'sumitpoddar@tikonacapital.com', phone: '9833362498', time: '9:00 AM - 6:00 PM' },
    { designation: 'Customer Care', name: 'Sumit Poddar', email: 'contact@tikonacapital.com', phone: '9833362488', time: '9:00 AM - 6:00 PM' },
    { designation: 'Head of Customer Care', name: 'Sumit Poddar', email: 'contact@tikonacapital.com', phone: '9833362488', time: '9:00 AM - 6:00 PM' },
    { designation: 'Compliance Officer', name: 'Sumit Poddar', email: 'contact@tikonacapital.com', phone: '9833362488', time: '9:00 AM - 6:00 PM' },
    { designation: 'CEO', name: 'Sumit Poddar', email: 'contact@tikonacapital.com', phone: '9833362488', time: '9:00 AM - 6:00 PM' },
];

export default function GrievanceContactScreen() {
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
                <Text style={styles.headerTitle}>Grievance Contact</Text>
                <Text style={styles.headerSubtitle}>Escalation Matrix</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                {CONTACTS.map((contact, index) => (
                    <Card key={index} theme={theme} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconWrap, { backgroundColor: Colors.brand.secondary + '15' }]}>
                                <Ionicons name="person-outline" size={20} color={Colors.brand.secondary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.designation, { color: Colors.brand.secondary }]}>{contact.designation}</Text>
                                <Text style={[styles.name, { color: c.text }]}>{contact.name}</Text>
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: c.borderLight }]} />

                        <View style={styles.detailRow}>
                            <Ionicons name="mail-outline" size={16} color={c.textTertiary} />
                            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
                                <Text style={[styles.detailValue, { color: Colors.brand.secondary }]}>{contact.email}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name="call-outline" size={16} color={c.textTertiary} />
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
                                <Text style={[styles.detailValue, { color: Colors.brand.secondary }]}>{contact.phone}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name="time-outline" size={16} color={c.textTertiary} />
                            <Text style={[styles.detailValue, { color: c.textSecondary }]}>{contact.time}</Text>
                        </View>
                    </Card>
                ))}
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
    content: { padding: Spacing.xl, gap: 12 },
    card: { padding: Spacing.lg },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
    iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    designation: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    name: { fontSize: FontSize.lg, fontWeight: '700' },
    divider: { height: 1, marginVertical: Spacing.sm },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    detailValue: { fontSize: FontSize.sm, fontWeight: '500' },
    footerSpacer: { height: 40 },
});
