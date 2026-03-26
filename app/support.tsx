import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Card, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SupportScreen() {
    const theme = useColorScheme();
    const c = Colors[theme];

    const handleEmail = () => Linking.openURL('mailto:contact@tikonacapital.com');
    const handlePhone = () => Linking.openURL('tel:+919967271135');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <LinearGradient
                colors={[Colors.brand.primary, '#1e3a8a']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help & Support</Text>
                <Text style={styles.headerSubtitle}>How can we assist you today?</Text>
            </LinearGradient>

            <ResponsiveScrollView contentContainerStyle={styles.content}>
                <Card theme={theme} style={styles.contactCard}>
                    <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>CONTACT DETAILS</Text>

                    <TouchableOpacity style={styles.item} onPress={() => {
                        const addr = '2C 123 Kalpataru Estate, JVLR, Andheri East, Mumbai, 400093';
                        const url = Platform.select({
                            ios: `maps:0,0?q=${addr}`,
                            android: `geo:0,0?q=${addr}`,
                            default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
                        });
                        Linking.openURL(url);
                    }} activeOpacity={0.6}>
                        <View style={[styles.iconBox, { backgroundColor: Colors.brand.primary + '10' }]}>
                            <Ionicons name="location" size={20} color={Colors.brand.primary} />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemLabel, { color: c.textTertiary }]}>Registered Address</Text>
                            <Text style={[styles.itemValue, { color: c.text }]}>2C 123 Kalpataru Estate, JVLR, Andheri East, Mumbai, 400093</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.item} onPress={handleEmail} activeOpacity={0.6}>
                        <View style={[styles.iconBox, { backgroundColor: Colors.brand.secondary + '10' }]}>
                            <Ionicons name="mail" size={20} color={Colors.brand.secondary} />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemLabel, { color: c.textTertiary }]}>Email Support</Text>
                            <Text style={[styles.itemValue, { color: c.text }]}>contact@tikonacapital.com</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.item} onPress={handlePhone} activeOpacity={0.6}>
                        <View style={[styles.iconBox, { backgroundColor: Colors.brand.accent + '10' }]}>
                            <Ionicons name="call" size={20} color={Colors.brand.accent} />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemLabel, { color: c.textTertiary }]}>Phone Number</Text>
                            <Text style={[styles.itemValue, { color: c.text }]}>+91 99672 71135</Text>
                        </View>
                    </TouchableOpacity>


                    <View style={styles.item}>
                        <View style={[styles.iconBox, { backgroundColor: c.success + '10' }]}>
                            <Ionicons name="time" size={20} color={c.success} />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemLabel, { color: c.textTertiary }]}>Office Hours</Text>
                            <Text style={[styles.itemValue, { color: c.text }]}>Mon - Fri: 9:00 AM to 6:00 PM</Text>
                        </View>
                    </View>

                    <View style={styles.item}>
                        <View style={[styles.iconBox, { backgroundColor: Colors.brand.accent + '10' }]}>
                            <Ionicons name="calendar" size={20} color={Colors.brand.accent} />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemLabel, { color: c.textTertiary }]}>Validity</Text>
                            <Text style={[styles.itemValue, { color: c.text }]}>Jun 13, 2022 to Jun 12, 2027</Text>
                        </View>
                    </View>
                </Card>

                <View style={[styles.footer, { borderColor: c.borderLight }]}>
                    <Text style={[styles.footerText, { color: c.textTertiary }]}>Tikona Capital Private Limited</Text>
                    <Text style={[styles.footerVersion, { color: c.textTertiary }]}>v1.0.3</Text>
                </View>
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
    contactCard: { padding: Spacing.xl },
    sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: Spacing.xl },
    item: { flexDirection: 'row', gap: Spacing.lg, marginBottom: 24 },
    iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    itemContent: { flex: 1 },
    itemLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase' },
    itemValue: { fontSize: FontSize.base, fontWeight: '500', lineHeight: 22 },
    footer: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, alignItems: 'center' },
    footerText: { fontSize: 12, fontWeight: '600' },
    footerVersion: { fontSize: 10, marginTop: 4 },
});
