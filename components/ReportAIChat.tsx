/**
 * ReportAIChat — Speech-to-Speech AI Assistant for Research Reports
 *
 * A beautiful full-screen modal chat interface powered by Sarvam AI.
 * Users can speak questions about a report and hear AI answers spoken back.
 * Also supports text-based chat as a fallback.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Animated, Modal, Platform, KeyboardAvoidingView,
  ActivityIndicator, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  speechToText,
  chatWithReport,
  textToSpeech,
  buildReportContext,
  type ChatHistoryEntry,
} from '@/lib/sarvamAI';
import type { ResearchReport } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  audioBase64?: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface ReportAIChatProps {
  visible: boolean;
  onClose: () => void;
  report: ResearchReport;
}

// ─── Pulse Animation Component ─────────────────────────────────────────────
function PulseRing({ color, delay = 0 }: { color: string; delay?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

// ─── Wave Bars (for recording indicator) ────────────────────────────────────
function WaveBars({ color }: { color: string }) {
  const bars = [0, 1, 2, 3, 4];
  const anims = useRef(bars.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.waveBars}>
      {bars.map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              transform: [{ scaleY: anims[i] }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ReportAIChat({ visible, onClose, report }: ReportAIChatProps) {
  const theme = useColorScheme();
  const c = Colors[theme];
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const reportContext = useRef<string>('');
  const chatHistory = useRef<ChatHistoryEntry[]>([]);

  // Build report context on mount/report change
  useEffect(() => {
    if (report) {
      reportContext.current = buildReportContext(report);
    }
  }, [report]);

  // Add welcome message when modal opens
  useEffect(() => {
    if (visible && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: `Hi! I'm your AI research assistant. I've analyzed the report on ${report.company_name} (${report.nse_symbol}). Ask me anything about this company — tap the mic to speak or use the keyboard!`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        if (!permission.canAskAgain) {
          addSystemMessage('Microphone permission is permanently denied. Please enable it in your device settings.');
        } else {
          addSystemMessage('Microphone permission is required for voice chat.');
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      if (Platform.OS !== 'web') Vibration.vibrate(50);
    } catch (err) {
      console.error('[Recording] Start error:', err);
      addSystemMessage('Could not start recording. Please check microphone permissions.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      setIsProcessing(true);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        addSystemMessage('Recording failed — no audio captured.');
        setIsProcessing(false);
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      // Read audio file as base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      // Step 1: Speech to Text
      const sttResult = await speechToText(base64, 'en-IN');
      const userText = sttResult.transcript;

      if (!userText.trim()) {
        addSystemMessage("I couldn't hear you clearly. Please try again.");
        setIsProcessing(false);
        return;
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: userText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add loading message
      const loadingId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: 'assistant', text: '', timestamp: new Date(), isLoading: true },
      ]);

      // Step 2: Chat with AI (pass conversation history)
      const chatResult = await chatWithReport(userText, reportContext.current, chatHistory.current);

      // Update history
      chatHistory.current = [
        ...chatHistory.current,
        { role: 'user', content: userText },
        { role: 'assistant', content: chatResult.reply },
      ];

      // Step 3: Text to Speech (use language detected by STT)
      let audioBase64 = '';
      try {
        const ttsResult = await textToSpeech(chatResult.reply, sttResult.language_code || 'en-IN');
        audioBase64 = ttsResult.audio;
      } catch (ttsErr) {
        console.warn('[TTS] Error, continuing without audio:', ttsErr);
      }

      // Replace loading message with actual response
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, text: chatResult.reply, audioBase64, isLoading: false }
            : m
        )
      );

      // Auto-play the response
      if (audioBase64) {
        await playAudioBase64(audioBase64);
      }
    } catch (err) {
      console.error('[Recording] Processing error:', err);
      addSystemMessage('Something went wrong processing your voice. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // ── Text Chat ─────────────────────────────────────────────────────────
  const sendTextMessage = useCallback(async () => {
    const text = textInput.trim();
    if (!text || isProcessing) return;

    setTextInput('');
    setIsProcessing(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const loadingId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', text: '', timestamp: new Date(), isLoading: true },
    ]);

    try {
      const chatResult = await chatWithReport(text, reportContext.current, chatHistory.current);

      // Update history
      chatHistory.current = [
        ...chatHistory.current,
        { role: 'user', content: text },
        { role: 'assistant', content: chatResult.reply },
      ];

      let audioBase64 = '';
      try {
        const ttsResult = await textToSpeech(chatResult.reply, 'en-IN');
        audioBase64 = ttsResult.audio;
      } catch (ttsErr) {
        console.warn('[TTS] Error:', ttsErr);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, text: chatResult.reply, audioBase64, isLoading: false }
            : m
        )
      );

      if (audioBase64) {
        await playAudioBase64(audioBase64);
      }
    } catch (err) {
      console.error('[Chat] Error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, text: 'Sorry, I encountered an error. Please try again.', isLoading: false }
            : m
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, [textInput, isProcessing]);

  // ── Audio Playback ────────────────────────────────────────────────────
  const playAudioBase64 = async (base64: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      setIsSpeaking(true);

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64}` },
        { shouldPlay: true }
      );

      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          sound.unloadAsync();
        }
      });
    } catch (err) {
      console.error('[Audio] Playback error:', err);
      setIsSpeaking(false);
    }
  };

  const replayAudio = async (audioBase64: string) => {
    await playAudioBase64(audioBase64);
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'system', text, timestamp: new Date() },
    ]);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleClose = () => {
    if (soundRef.current) {
      soundRef.current.stopAsync();
      soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsSpeaking(false);
    setIsRecording(false);
    setIsProcessing(false);
    setMessages([]);
    setShowTextInput(false);
    chatHistory.current = [];
    onClose();
  };

  // ── Render Message ────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMsgWrap}>
          <Text style={[styles.systemMsgText, { color: c.textTertiary }]}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: Colors.brand.primary + '20' }]}>
            <Ionicons name="sparkles" size={16} color={Colors.brand.primary} />
          </View>
        )}
        <View
          style={[
            styles.msgBubble,
            isUser
              ? { backgroundColor: Colors.brand.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
          ]}
        >
          {item.isLoading ? (
            <View style={styles.loadingDots}>
              <WaveBars color={isUser ? '#fff' : Colors.brand.primary} />
              <Text style={[styles.thinkingText, { color: c.textTertiary }]}>Thinking...</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.msgText, { color: isUser ? '#fff' : c.text }]}>
                {item.text}
              </Text>
              {!isUser && item.audioBase64 && (
                <TouchableOpacity
                  style={[styles.replayBtn, { borderColor: Colors.brand.primary + '30' }]}
                  onPress={() => replayAudio(item.audioBase64!)}
                >
                  <Ionicons
                    name={isSpeaking ? 'pause' : 'volume-high'}
                    size={14}
                    color={Colors.brand.primary}
                  />
                  <Text style={[styles.replayText, { color: Colors.brand.primary }]}>
                    {isSpeaking ? 'Playing...' : 'Replay'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        {isUser && (
          <View style={[styles.avatar, styles.avatarUser, { backgroundColor: Colors.brand.primary + '20' }]}>
            <Ionicons name="person" size={16} color={Colors.brand.primary} />
          </View>
        )}
      </View>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={c.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.headerIconWrap, { backgroundColor: Colors.brand.primary + '15' }]}>
              <Ionicons name="sparkles" size={16} color={Colors.brand.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: c.text }]}>AI Research Assistant</Text>
              <Text style={[styles.headerSub, { color: c.textTertiary }]} numberOfLines={1}>
                {report.company_name} • {report.nse_symbol}
              </Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Powered by badge */}
        <View style={[styles.poweredBy, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <Text style={[styles.poweredByText, { color: c.textTertiary }]}>
            Powered by Sarvam AI • Speech-to-Speech
          </Text>
        </View>

        {/* Chat Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Bottom Controls */}
        <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          {/* Recording State */}
          {isRecording && (
            <View style={styles.recordingOverlay}>
              <View style={styles.pulseContainer}>
                <PulseRing color={Colors.brand.primary + '30'} delay={0} />
                <PulseRing color={Colors.brand.primary + '20'} delay={500} />
                <PulseRing color={Colors.brand.primary + '10'} delay={1000} />
                <View style={[styles.recordingCore, { backgroundColor: Colors.brand.primary }]}>
                  <Ionicons name="mic" size={28} color="#fff" />
                </View>
              </View>
              <Text style={[styles.recordingLabel, { color: c.text }]}>Listening...</Text>
              <Text style={[styles.recordingHint, { color: c.textTertiary }]}>Tap to stop</Text>
            </View>
          )}

          {/* Processing State */}
          {isProcessing && !isRecording && (
            <View style={styles.processingWrap}>
              <ActivityIndicator size="small" color={Colors.brand.primary} />
              <Text style={[styles.processingText, { color: c.textSecondary }]}>
                Processing your question...
              </Text>
            </View>
          )}

          {/* Input Area */}
          {!isRecording && !isProcessing && (
            <View style={styles.inputArea}>
              {showTextInput ? (
                <View style={styles.textInputRow}>
                  <TouchableOpacity
                    onPress={() => setShowTextInput(false)}
                    style={[styles.inputToggle, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
                  >
                    <Ionicons name="mic" size={20} color={Colors.brand.primary} />
                  </TouchableOpacity>
                  <View style={[styles.textInputWrap, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
                    <TextInput
                      style={[styles.textInputField, { color: c.text }]}
                      placeholder="Type your question..."
                      placeholderTextColor={c.textTertiary}
                      value={textInput}
                      onChangeText={setTextInput}
                      onSubmitEditing={sendTextMessage}
                      returnKeyType="send"
                      multiline={false}
                    />
                    {textInput.trim().length > 0 && (
                      <TouchableOpacity
                        onPress={sendTextMessage}
                        style={[styles.sendBtn, { backgroundColor: Colors.brand.primary }]}
                      >
                        <Ionicons name="send" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.voiceInputArea}>
                  <TouchableOpacity
                    onPress={() => setShowTextInput(true)}
                    style={[styles.keyboardBtn, { borderColor: c.border }]}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color={c.textSecondary} />
                    <Text style={[styles.keyboardBtnText, { color: c.textSecondary }]}>Type</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={isRecording ? stopRecording : startRecording}
                    style={[styles.micBtn, { backgroundColor: Colors.brand.primary }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mic" size={28} color="#fff" />
                  </TouchableOpacity>

                  <View style={[styles.keyboardBtn, { borderColor: 'transparent' }]}>
                    <Text style={[styles.keyboardBtnText, { color: c.textTertiary, fontSize: 10 }]}>
                      Tap mic{'\n'}to ask
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Stop recording button when recording */}
          {isRecording && (
            <TouchableOpacity
              onPress={stopRecording}
              style={[styles.stopRecBtn, { backgroundColor: '#EF4444' }]}
            >
              <Ionicons name="stop" size={20} color="#fff" />
              <Text style={styles.stopRecText}>Stop Recording</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.select({ ios: 56, web: 16, default: 48 }),
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  // Powered by
  poweredBy: {
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  poweredByText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Chat
  chatContainer: {
    padding: Spacing.lg,
    paddingBottom: 20,
  },
  // Messages
  msgRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    alignItems: 'flex-end',
    gap: 8,
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUser: {},
  msgBubble: {
    maxWidth: '75%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  msgText: {
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  thinkingText: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  replayText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  // System
  systemMsgWrap: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  systemMsgText: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Bottom bar
  bottomBar: {
    borderTopWidth: 1,
    paddingBottom: Platform.select({ ios: 34, default: 16 }),
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 80,
  },
  // Voice input
  voiceInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  micBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  keyboardBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  keyboardBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Text input
  inputArea: {},
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputToggle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  textInputField: {
    flex: 1,
    fontSize: FontSize.base,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Recording
  recordingOverlay: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  pulseContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  pulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  recordingCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  recordingLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: 4,
  },
  recordingHint: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  stopRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  stopRecText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  // Processing
  processingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: Spacing.lg,
  },
  processingText: {
    fontSize: FontSize.base,
  },
  // Wave bars
  waveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
  },
  waveBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
});
