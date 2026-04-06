import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { deleteChatSession, fetchChatSessions, type ChatSession } from '@/lib/chatLogger';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getPreview(session: ChatSession): string {
    const msgs = session.messages || [];
    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
    return lastUser?.text?.slice(0, 80) || 'No messages';
}

export default function SectorChatHistoryScreen() {
    const { sector } = useLocalSearchParams<{ sector: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const { userId } = useAuth();

    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    const loadSessions = useCallback(async () => {
        if (!userId || !sector) return;
        setLoading(true);
        const data = await fetchChatSessions(userId, null, 'sector', 50);
        // Filter to only this sector by checking company_name (which stores sector name)
        const filtered = data.filter(s => s.company_name === sector);
        setSessions(filtered);
        setLoading(false);
    }, [userId, sector]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleDelete = (session: ChatSession) => {
        const doDelete = async () => {
            setSessions(prev => prev.filter(s => s.id !== session.id));
            await deleteChatSession(session.id);
        };

        if (Platform.OS === 'web') {
            if (confirm('Delete this chat session?')) doDelete();
        } else {
            Alert.alert(
                'Delete Chat',
                'Are you sure you want to delete this conversation?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: doDelete },
                ]
            );
        }
    };

    const handleContinue = (session: ChatSession) => {
        // Navigate to ai-chat with the session data so the user can continue chatting
        router.replace({
            pathname: '/ai-chat',
            params: {
                sector: sector!,
                resumeSessionId: session.id,
                resumeMessages: JSON.stringify(session.messages || []),
            },
        } as any);
    };

    const renderSession = ({ item }: { item: ChatSession }) => {
        const preview = getPreview(item);
        const msgCount = item.message_count || (item.messages?.length || 0);

        return (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                {/* Top row: preview + time */}
                <TouchableOpacity
                    style={styles.cardContent}
                    onPress={() => handleContinue(item)}
                    activeOpacity={0.7}
                >
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconBg, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]}>
                            <Ionicons name="chatbubble-ellipses" size={16} color={Colors.brand.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.previewText, { color: c.text }]} numberOfLines={2}>
                                {preview}
                            </Text>
                            <View style={styles.metaRow}>
                                <Text style={[styles.metaText, { color: c.textTertiary }]}>
                                    {formatDate(item.started_at)}
                                </Text>
                                <View style={[styles.dot, { backgroundColor: c.textTertiary }]} />
                                <Text style={[styles.metaText, { color: c.textTertiary }]}>
                                    {msgCount} messages
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Bottom actions */}
                <View style={[styles.cardActions, { borderTopColor: c.borderLight }]}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}
                        onPress={() => handleContinue(item)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chatbubble-outline" size={14} color={Colors.brand.primary} />
                        <Text style={[styles.actionText, { color: Colors.brand.primary }]}>Continue</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDark ? '#3b1c1c' : '#fef2f2' }]}
                        onPress={() => handleDelete(item)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: c.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={c.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: c.text }]}>Chat History</Text>
                    <Text style={[styles.headerSubtitle, { color: c.textTertiary }]}>{sector}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.brand.primary} />
                    <Text style={[styles.emptyText, { color: c.textTertiary, marginTop: 12 }]}>Loading chats...</Text>
                </View>
            ) : sessions.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="chatbubbles-outline" size={48} color={c.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: c.text }]}>No Past Conversations</Text>
                    <Text style={[styles.emptyText, { color: c.textTertiary }]}>
                        Start a new chat with the {sector} analyst to see your history here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSession}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        gap: Spacing.md,
    },
    backBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    headerSubtitle: { fontSize: FontSize.xs, fontWeight: '500', marginTop: 1 },

    list: { padding: Spacing.xl, gap: Spacing.md },

    card: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardContent: {
        padding: Spacing.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
    },
    iconBg: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    previewText: {
        fontSize: FontSize.sm,
        fontWeight: '500',
        lineHeight: 20,
        marginBottom: 6,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        fontSize: 11,
        fontWeight: '500',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 2,
    },

    cardActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        gap: 8,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: BorderRadius.lg,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
    },

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
    },
    emptyTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: FontSize.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
});
