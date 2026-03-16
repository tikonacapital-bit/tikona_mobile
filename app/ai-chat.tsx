import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    FlatList, ActivityIndicator, KeyboardAvoidingView,
    Platform, Keyboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { SECTOR_ANALYSTS } from '@/lib/analysts';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

const SUGGESTED_QUESTIONS = [
    'What is the outlook for this sector?',
    'Which stocks are best positioned?',
    'What are the key risks to watch?',
    'What valuation metrics matter most here?',
];

export default function AIChatScreen() {
    const { sector } = useLocalSearchParams<{ sector: string }>();
    const theme = useColorScheme();
    const c = Colors[theme];
    const isDark = theme === 'dark';

    const analyst = SECTOR_ANALYSTS.find((a) => a.sector === sector);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            role: 'assistant',
            content: `Hi! I'm ${analyst?.analyst ?? 'your AI analyst'}, covering the ${sector} sector. Ask me anything — company outlooks, valuations, risks, or sector trends.`,
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const listRef = useRef<FlatList>(null);

    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading || !sector) return;

        setInput('');
        if (Platform.OS !== 'web') Keyboard.dismiss();

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        // Build history for the API (exclude greeting message)
        const history = messages
            .slice(1)
            .map((m) => ({ role: m.role, content: m.content }));

        try {
            const { data, error } = await supabase.functions.invoke('sector-ai-chat', {
                body: { sector, message: trimmed, history },
            });

            if (error) throw error;

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.reply || 'Sorry, I could not generate a response.',
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (err: any) {
            const errMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, something went wrong. Please try again.',
            };
            setMessages((prev) => [...prev, errMsg]);
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
                    <View style={[styles.avatarWrap, { backgroundColor: isDark ? analyst?.darkBg : analyst?.bg }]}>
                        <Ionicons name={analyst?.icon ?? 'person'} size={14} color={analyst?.color ?? Colors.brand.secondary} />
                    </View>
                )}
                <View style={[
                    styles.bubble,
                    isUser
                        ? { backgroundColor: Colors.brand.primary }
                        : { backgroundColor: c.surfaceElevated, borderColor: c.border, borderWidth: 1 },
                    isUser && styles.bubbleUser,
                ]}>
                    <Text style={[
                        styles.bubbleText,
                        { color: isUser ? '#fff' : c.text },
                    ]}>
                        {item.content}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: c.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backBtn, { backgroundColor: c.borderLight }]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="chevron-back" size={20} color={c.text} />
                </TouchableOpacity>
                <View style={[styles.analystAvatar, { backgroundColor: isDark ? analyst?.darkBg : analyst?.bg }]}>
                    <Ionicons name={analyst?.icon ?? 'person'} size={20} color={analyst?.color ?? Colors.brand.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerName, { color: c.text }]} numberOfLines={1}>
                        {analyst?.analyst ?? sector}
                    </Text>
                    <Text style={[styles.headerRole, { color: analyst?.color ?? c.textSecondary }]}>
                        {analyst?.title} · {sector}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setMessages([{
                        id: '0', role: 'assistant',
                        content: `Hi! I'm ${analyst?.analyst ?? 'your AI analyst'}, covering the ${sector} sector. Ask me anything — company outlooks, valuations, risks, or sector trends.`,
                    }])}
                    style={[styles.clearBtn, { backgroundColor: c.borderLight }]}
                    activeOpacity={0.7}
                >
                    <Ionicons name="refresh-outline" size={16} color={c.textSecondary} />
                </TouchableOpacity>
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
                            <View style={[styles.avatarWrap, { backgroundColor: isDark ? analyst?.darkBg : analyst?.bg }]}>
                                <Ionicons name={analyst?.icon ?? 'person'} size={14} color={analyst?.color ?? Colors.brand.secondary} />
                            </View>
                            <View style={[styles.typingBubble, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
                                <ActivityIndicator size="small" color={analyst?.color ?? Colors.brand.secondary} />
                                <Text style={[styles.typingText, { color: c.textTertiary }]}>Thinking...</Text>
                            </View>
                        </View>
                    ) : null
                }
            />

            {/* Suggested questions (shown when only greeting exists) */}
            {messages.length === 1 && !loading && (
                <View style={styles.suggestionsWrap}>
                    <Text style={[styles.suggestionsLabel, { color: c.textTertiary }]}>Suggested questions</Text>
                    <View style={styles.suggestionsRow}>
                        {SUGGESTED_QUESTIONS.map((q) => (
                            <TouchableOpacity
                                key={q}
                                style={[styles.suggestionChip, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
                                onPress={() => sendMessage(q)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.suggestionText, { color: c.textSecondary }]}>{q}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Input Bar */}
            <View style={[styles.inputBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
                <View style={[styles.inputWrap, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
                    <TextInput
                        style={[styles.input, { color: c.text }]}
                        placeholder={`Ask ${analyst?.analyst?.split(' ')[0] ?? 'the analyst'} anything...`}
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
                    style={[
                        styles.sendBtn,
                        { backgroundColor: input.trim() && !loading ? Colors.brand.primary : c.surfaceElevated },
                    ]}
                    onPress={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name="send"
                        size={18}
                        color={input.trim() && !loading ? '#fff' : c.textTertiary}
                    />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
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
        paddingTop: Platform.select({ ios: 56, default: 40 }),
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    analystAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerName: { fontSize: FontSize.base, fontWeight: '700' },
    headerRole: { fontSize: FontSize.xs, fontWeight: '600', marginTop: 1 },
    clearBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

    // Messages
    messageList: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.lg },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: Spacing.sm },
    msgRowUser: { flexDirection: 'row-reverse' },
    avatarWrap: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    bubble: { maxWidth: '78%', padding: 12, borderRadius: 16, borderBottomLeftRadius: 4 },
    bubbleUser: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
    bubbleText: { fontSize: FontSize.sm, lineHeight: 22 },

    // Typing
    typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
    typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, borderWidth: 1 },
    typingText: { fontSize: FontSize.xs },

    // Suggestions
    suggestionsWrap: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm },
    suggestionsLabel: { fontSize: FontSize.xs, fontWeight: '600', marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
    suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    suggestionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
    suggestionText: { fontSize: FontSize.xs, fontWeight: '500' },

    // Input
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.sm,
        paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.lg,
        borderTopWidth: 1,
    },
    inputWrap: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120 },
    input: { fontSize: FontSize.base, lineHeight: 22 },
    sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
});
