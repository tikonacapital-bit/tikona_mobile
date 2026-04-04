import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SECTOR_ANALYSTS } from '@/lib/analysts';
import { appendMessages, createChatSession } from '@/lib/chatLogger';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    Keyboard,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
    'What is the outlook for this sector?',
    'Which stocks are best positioned?',
    'What are the key risks to watch?',
    'What valuation metrics matter most here?',
    'How does macro environment affect this sector?',
];

function TypingDots({ color }: { color: string }) {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: -5, duration: 280, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 280, useNativeDriver: true }),
                    Animated.delay(600),
                ])
            );
        const a1 = animate(dot1, 0);
        const a2 = animate(dot2, 140);
        const a3 = animate(dot3, 280);
        a1.start(); a2.start(); a3.start();
        return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, []);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 }}>
            {[dot1, dot2, dot3].map((dot, i) => (
                <Animated.View
                    key={i}
                    style={{
                        width: 7, height: 7, borderRadius: 4,
                        backgroundColor: color,
                        opacity: 0.75,
                        transform: [{ translateY: dot }],
                    }}
                />
            ))}
        </View>
    );
}

function formatTime(date: Date) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AIChatScreen() {
    const { sector } = useLocalSearchParams<{ sector: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';
    const insets = useSafeAreaInsets();
    const { userId, wallet, refreshWallet } = useAuth();
    const sessionIdRef = useRef<string | null>(null);

    const analyst = SECTOR_ANALYSTS.find((a) => a.sector === sector);
    const analystColor = analyst?.color ?? Colors.brand.secondary;
    const analystBg = isDark ? analyst?.darkBg : analyst?.bg;

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            role: 'assistant',
            content: `Hi! I'm ${analyst?.analyst ?? 'your AI analyst'}, covering the ${sector} sector. Ask me anything — company outlooks, valuations, risks, or sector trends.`,
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const listRef = useRef<FlatList>(null);

    const resetChat = useCallback(() => {
        sessionIdRef.current = null;
        setMessages([{
            id: '0',
            role: 'assistant',
            content: `Hi! I'm ${analyst?.analyst ?? 'your AI analyst'}, covering the ${sector} sector. Ask me anything — company outlooks, valuations, risks, or sector trends.`,
            timestamp: new Date(),
        }]);
    }, [analyst, sector]);

    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading || !sector) return;

        const balance = wallet ? wallet.credits_balance : 50;
        if (balance < 1) {
            Alert.alert(
                'Insufficient Credits',
                'Sector AI Chat requires 1 AI credit. Please upgrade your plan or top up to continue.'
            );
            return;
        }

        setInput('');
        if (Platform.OS !== 'web') Keyboard.dismiss();

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: trimmed,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        const history = messages
            .slice(1)
            .map((m) => ({ role: m.role, content: m.content }));

        try {
            // Verify we have an active session before calling the edge function
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                console.error('[AI Chat] No active session — user may need to re-login');
                throw new Error('No active session');
            }

            // Use supabase.functions.invoke directly — it carries the persisted session JWT automatically.
            const { data, error } = await supabase.functions.invoke('sector-ai-chat', {
                body: { sector, message: trimmed, history },
            });
            if (error) throw error;

            refreshWallet(); // Refresh credits
            const replyContent = data?.reply || 'Sorry, I could not generate a response.';

            setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: replyContent,
                timestamp: new Date(),
            }]);

            // Save to chat_sessions
            if (userId) {
                if (!sessionIdRef.current) {
                    sessionIdRef.current = await createChatSession({
                        userId,
                        reportId: null,
                        companyName: sector,
                        nseSymbol: 'SECTOR',
                        chatType: 'sector'
                    });
                }
                if (sessionIdRef.current) {
                    await appendMessages(sessionIdRef.current, [
                        { role: 'user', text: trimmed, timestamp: new Date().toISOString() },
                        { role: 'assistant', text: replyContent, timestamp: new Date().toISOString() }
                    ]);
                }
            }

        } catch (err: any) {
            let realMsg = err?.message || 'Unknown error';
            if (err?.context?.json) {
                try {
                    const ctx = await err.context.json();
                    if (ctx.error) realMsg = ctx.error;
                } catch (e) { }
            }
            console.error('[AI Chat] Error calling sector-ai-chat:', realMsg, '| Full err:', err);
            Alert.alert("Debug Error", `Edge Function Error: ${realMsg}`);
            setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Response from analyst failed: ${realMsg}`,
                timestamp: new Date(),
            }]);
        } finally {
            setLoading(false);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [loading, sector, messages]);

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
                {!isUser && (
                    <View style={[styles.avatarWrap, { backgroundColor: analystBg }]}>
                        <Ionicons name={analyst?.icon ?? 'person'} size={13} color={analystColor} />
                    </View>
                )}
                <View style={{ maxWidth: '78%' }}>
                    {isUser ? (
                        <LinearGradient
                            colors={[Colors.brand.primary, '#1e40af']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.bubble, styles.bubbleUser]}
                        >
                            <Text style={[styles.bubbleText, { color: '#fff' }]}>{item.content}</Text>
                        </LinearGradient>
                    ) : (
                        <View style={[styles.bubble, styles.bubbleAssistant, {
                            backgroundColor: c.surfaceElevated,
                            borderColor: c.border,
                        }]}>
                            <Text style={[styles.bubbleText, { color: c.text }]}>{item.content}</Text>
                        </View>
                    )}
                    <Text style={[
                        styles.timestamp,
                        isUser ? styles.timestampRight : styles.timestampLeft,
                        { color: c.textTertiary },
                    ]}>
                        {formatTime(item.timestamp)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <LinearGradient
                    colors={isDark ? ['#0f172a', '#1e293b'] : ['#ffffff', '#f8fafc']}
                    style={[styles.header, { borderBottomColor: c.border, paddingTop: Math.max(insets.top, 16) }]}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[styles.iconBtn, { backgroundColor: c.borderLight }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chevron-back" size={20} color={c.text} />
                    </TouchableOpacity>

                    <View style={{ position: 'relative' }}>
                        <View style={[styles.analystAvatar, { backgroundColor: analystBg }]}>
                            <Ionicons name={analyst?.icon ?? 'person'} size={22} color={analystColor} />
                        </View>
                        <View style={[styles.onlineDot, { borderColor: isDark ? '#0f172a' : '#ffffff' }]} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerName, { color: c.text }]} numberOfLines={1}>
                            {analyst?.analyst ?? sector}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={styles.onlineDotSmall} />
                            <Text style={[styles.headerStatus, { color: analystColor }]}>
                                Online · {wallet?.credits_balance ?? 0} Credits
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/sector-chat-history', params: { sector } })}
                        style={[styles.iconBtn, { backgroundColor: c.borderLight, marginRight: 8 }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="time-outline" size={16} color={c.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={resetChat}
                        style={[styles.iconBtn, { backgroundColor: c.borderLight }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="refresh-outline" size={16} color={c.textSecondary} />
                    </TouchableOpacity>
                </LinearGradient>

                {/* Sector pill bar */}
                <View style={[styles.sectorBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
                    <View style={[styles.sectorPill, { backgroundColor: analystBg }]}>
                        <Text style={[styles.sectorPillText, { color: analystColor }]}>{sector}</Text>
                    </View>
                    <Text style={[styles.sectorDesc, { color: c.textTertiary }]} numberOfLines={1}>
                        {analyst?.description}
                    </Text>
                </View>

                {/* Messages */}
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                    ListFooterComponent={
                        loading ? (
                            <View style={styles.typingRow}>
                                <View style={[styles.avatarWrap, { backgroundColor: analystBg }]}>
                                    <Ionicons name={analyst?.icon ?? 'person'} size={13} color={analystColor} />
                                </View>
                                <View style={[styles.typingBubble, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
                                    <TypingDots color={analystColor} />
                                </View>
                            </View>
                        ) : null
                    }
                />

                {/* Suggested questions — horizontal scroll */}
                {messages.length === 1 && !loading && (
                    <View style={styles.suggestionsWrap}>
                        <Text style={[styles.suggestionsLabel, { color: c.textTertiary }]}>Try asking</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.suggestionsScroll}
                        >
                            {SUGGESTED_QUESTIONS.map((q) => (
                                <TouchableOpacity
                                    key={q}
                                    style={[styles.suggestionChip, { backgroundColor: analystBg, borderColor: analystColor + '35' }]}
                                    onPress={() => sendMessage(q)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="sparkles" size={10} color={analystColor} />
                                    <Text style={[styles.suggestionText, { color: analystColor }]}>{q}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Input Bar */}
                <View style={[styles.inputBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={[
                        styles.inputWrap,
                        {
                            backgroundColor: c.inputBg,
                            borderColor: input.trim() ? analystColor + '55' : c.inputBorder,
                        },
                    ]}>
                        <TextInput
                            style={[styles.input, { color: c.text }]}
                            placeholder={`Ask ${analyst?.analyst?.split(' ')[0] ?? 'the analyst'}...`}
                            placeholderTextColor={c.textTertiary}
                            value={input}
                            onChangeText={setInput}
                            multiline
                            maxLength={500}
                            returnKeyType="send"
                            onSubmitEditing={() => sendMessage(input)}
                            blurOnSubmit
                        />
                    </View>
                    <TouchableOpacity
                        onPress={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={input.trim() && !loading
                                ? [Colors.brand.primary, '#1e40af']
                                : [c.surfaceElevated, c.surfaceElevated]
                            }
                            style={styles.sendBtn}
                        >
                            <Ionicons
                                name="send"
                                size={17}
                                color={input.trim() && !loading ? '#fff' : c.textTertiary}
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    analystAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    onlineDot: {
        position: 'absolute', bottom: 1, right: 1,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#22c55e', borderWidth: 2,
    },
    onlineDotSmall: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
    headerName: { fontSize: FontSize.base, fontWeight: '700', letterSpacing: -0.2 },
    headerStatus: { fontSize: 11, fontWeight: '600' },

    // Sector bar
    sectorBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: Spacing.xl,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectorPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
    sectorPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    sectorDesc: { fontSize: 11, flex: 1 },

    // Messages
    messageList: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
    msgRowUser: { flexDirection: 'row-reverse' },
    avatarWrap: {
        width: 28, height: 28, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
        flexShrink: 0, marginBottom: 18,
    },
    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
    bubbleUser: { borderBottomRightRadius: 4 },
    bubbleAssistant: { borderWidth: 1, borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: FontSize.sm, lineHeight: 22 },
    timestamp: { fontSize: 10, marginTop: 4 },
    timestampRight: { textAlign: 'right', marginRight: 2 },
    timestampLeft: { marginLeft: 2 },

    // Typing
    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
    },
    typingBubble: {
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1,
    },

    // Suggestions
    suggestionsWrap: { paddingLeft: Spacing.xl, paddingBottom: Spacing.sm, paddingTop: 4 },
    suggestionsLabel: {
        fontSize: 10, fontWeight: '700',
        letterSpacing: 0.8, textTransform: 'uppercase',
        marginBottom: 8,
    },
    suggestionsScroll: { gap: 8, paddingRight: Spacing.xl },
    suggestionChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: BorderRadius.full, borderWidth: 1,
    },
    suggestionText: { fontSize: 12, fontWeight: '600' },

    // Input
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingHorizontal: Spacing.xl,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    inputWrap: {
        flex: 1, borderWidth: 1.5,
        borderRadius: 24,
        paddingHorizontal: 16, paddingVertical: 10,
        maxHeight: 120,
    },
    input: { fontSize: FontSize.base, lineHeight: 22 },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
    },
});
