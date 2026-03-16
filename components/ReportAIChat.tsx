/**
 * ReportAIChat — Premium Speech-to-Speech AI Assistant
 *
 * A stunning full-screen modal chat interface powered by Sarvam AI + Claude Sonnet.
 * Users can speak questions about a report and hear AI answers spoken back.
 * Also supports text-based chat as a fallback.
 */

import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  buildReportContext,
  chatWithReport,
  speechToText,
  textToSpeech,
  type ChatHistoryEntry,
} from '@/lib/sarvamAI';
import type { ResearchReport } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

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

// ─── Bouncing Dots (premium typing/thinking indicator) ──────────────────────
function BouncingDots({ color }: { color: string }) {
  const dots = [0, 1, 2];
  const anims = useRef(dots.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(anim, {
            toValue: -8,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={s.bouncingDots}>
      {dots.map((_, i) => (
        <Animated.View
          key={i}
          style={[
            s.bouncingDot,
            {
              backgroundColor: color,
              transform: [{ translateY: anims[i] }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Pulse Animation Component ─────────────────────────────────────────────
function PulseRing({ color, delay = 0 }: { color: string; delay?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.5,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        s.pulseRing,
        {
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

// ─── Wave Bars (for speaking indicator) ─────────────────────────────────────
function WaveBars({ color, barCount = 5 }: { color: string; barCount?: number }) {
  const bars = Array.from({ length: barCount });
  const anims = useRef(bars.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 280, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={s.waveBars}>
      {bars.map((_, i) => (
        <Animated.View
          key={i}
          style={[
            s.waveBar,
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

// ─── Time formatting helper ─────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ReportAIChat({ visible, onClose, report }: ReportAIChatProps) {
  const theme = useColorScheme();
  const c = Colors[theme];
  const isDark = theme === 'dark';
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
  const silenceStartRef = useRef<number | null>(null);

  // Mic button glow animation
  const micGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(micGlow, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(micGlow, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

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
          text: `Hi! I'm your AI research assistant. I've analyzed the report on **${report.company_name}** (${report.nse_symbol}). Ask me anything about this company — tap the mic to speak or use the keyboard!`,
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

  // ── Handle app going to background — stop audio playback ─────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => {});
          soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
          setIsSpeaking(false);
        }
        if (recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(() => {});
          recordingRef.current = null;
          setIsRecording(false);
        }
      }
    });

    return () => subscription.remove();
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
      silenceStartRef.current = null;

      // Enable metering to detect silence
      recording.setOnRecordingStatusUpdate((status) => {
        if (!recordingRef.current) return;

        if (status.isRecording && status.metering !== undefined) {
          if (status.metering < -35) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = status.durationMillis;
            } else {
              const silenceDuration = status.durationMillis - silenceStartRef.current;
              if (silenceDuration >= 2000) {
                silenceStartRef.current = null;
                stopRecording();
              }
            }
          } else {
            silenceStartRef.current = null;
          }
        }
      });
      recording.setProgressUpdateInterval(100);

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

      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      const sttResult = await speechToText(base64, 'en-IN');
      const userText = sttResult.transcript;

      if (!userText.trim()) {
        addSystemMessage("I couldn't hear you clearly. Please try again.");
        setIsProcessing(false);
        return;
      }

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: userText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const loadingId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: 'assistant', text: '', timestamp: new Date(), isLoading: true },
      ]);

      const chatResult = await chatWithReport(userText, reportContext.current, chatHistory.current);

      chatHistory.current = [
        ...chatHistory.current,
        { role: 'user', content: userText },
        { role: 'assistant', content: chatResult.reply },
      ];

      let audioBase64 = '';
      try {
        const ttsResult = await textToSpeech(chatResult.reply, sttResult.language_code || 'en-IN');
        audioBase64 = ttsResult.audio;
      } catch (ttsErr) {
        console.warn('[TTS] Error, continuing without audio:', ttsErr);
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

  // ── Stop Speaking ──────────────────────────────────────────────────────
  const stopSpeaking = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (err) {
      console.warn('[Audio] Stop error:', err);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

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

  // Just hide the modal — keep audio playing & messages intact
  const handleMinimize = () => {
    onClose();
  };

  // Full reset — starts a new chat session
  const handleNewChat = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    setIsSpeaking(false);
    setIsRecording(false);
    setIsProcessing(false);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: `Hi! I'm your AI research assistant. I've analyzed the report on **${report.company_name}** (${report.nse_symbol}). Ask me anything about this company — tap the mic to speak or use the keyboard!`,
        timestamp: new Date(),
      },
    ]);
    setShowTextInput(false);
    chatHistory.current = [];
  }, [report]);

  // ── Render Message ────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';

    if (isSystem) {
      return (
        <View style={s.systemMsgWrap}>
          <View style={[s.systemMsgPill, { backgroundColor: isDark ? '#1F293720' : '#F3F4F6' }]}>
            <Ionicons name="information-circle" size={12} color={c.textTertiary} />
            <Text style={[s.systemMsgText, { color: c.textTertiary }]}>{item.text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[s.msgRow, isUser && s.msgRowUser]}>
        {/* AI avatar */}
        {!isUser && (
          <View style={[s.avatar, { backgroundColor: Colors.brand.primary + '15' }]}>
            <LinearGradient
              colors={[Colors.brand.primary, Colors.brand.secondary]}
              style={s.avatarGradient}
            >
              <Ionicons name="sparkles" size={14} color="#fff" />
            </LinearGradient>
          </View>
        )}

        <View style={s.msgContent}>
          {/* Sender label */}
          <Text
            style={[
              s.senderLabel,
              {
                color: c.textTertiary,
                textAlign: isUser ? 'right' : 'left',
              },
            ]}
          >
            {isUser ? 'You' : 'AI Assistant'} · {formatTime(item.timestamp)}
          </Text>

          {/* Message bubble */}
          <View
            style={[
              s.msgBubble,
              isUser
                ? {
                    backgroundColor: Colors.brand.primary,
                    borderBottomRightRadius: 4,
                    shadowColor: Colors.brand.primary,
                    shadowOpacity: 0.2,
                    shadowOffset: { width: 0, height: 4 },
                    shadowRadius: 12,
                    elevation: 4,
                  }
                : {
                    backgroundColor: isDark ? c.surfaceElevated : c.surface,
                    borderBottomLeftRadius: 4,
                    borderWidth: 1,
                    borderColor: c.border,
                    shadowColor: '#000',
                    shadowOpacity: isDark ? 0.15 : 0.04,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 8,
                    elevation: 2,
                  },
            ]}
          >
            {item.isLoading ? (
              <View style={s.loadingWrap}>
                <BouncingDots color={Colors.brand.primary} />
                <Text style={[s.thinkingText, { color: c.textTertiary }]}>Thinking...</Text>
              </View>
            ) : (
              <>
                <Text style={[s.msgText, { color: isUser ? '#fff' : c.text }]}>
                  {item.text}
                </Text>
                {!isUser && item.audioBase64 && (
                  <TouchableOpacity
                    style={[
                      s.replayBtn,
                      {
                        backgroundColor: Colors.brand.primary + '10',
                        borderColor: Colors.brand.primary + '20',
                      },
                    ]}
                    onPress={() => replayAudio(item.audioBase64!)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSpeaking ? 'pause-circle' : 'play-circle'}
                      size={16}
                      color={Colors.brand.primary}
                    />
                    <Text style={[s.replayText, { color: Colors.brand.primary }]}>
                      {isSpeaking ? 'Playing...' : 'Play audio'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* User avatar */}
        {isUser && (
          <View style={[s.avatar, { backgroundColor: Colors.brand.primary + '15' }]}>
            <View style={[s.avatarGradient, { backgroundColor: Colors.brand.primary + '25' }]}>
              <Ionicons name="person" size={14} color={Colors.brand.primary} />
            </View>
          </View>
        )}
      </View>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: c.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Premium Header ─────────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={handleMinimize} style={s.headerBtn} activeOpacity={0.7}>
            <View style={[s.headerBtnInner, { backgroundColor: isDark ? '#ffffff08' : '#00000006' }]}>
              <Ionicons name="chevron-back" size={20} color={c.text} />
            </View>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <LinearGradient
              colors={[Colors.brand.primary, Colors.brand.secondary]}
              style={s.headerIcon}
            >
              <Ionicons name="sparkles" size={14} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[s.headerTitle, { color: c.text }]}>AI Assistant</Text>
              <View style={s.headerStatusRow}>
                <View style={[s.statusDot, { backgroundColor: '#34D399' }]} />
                <Text style={[s.headerSub, { color: c.textTertiary }]} numberOfLines={1}>
                  {report.company_name} · {report.nse_symbol}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={handleNewChat} style={s.headerBtn} activeOpacity={0.7}>
            <View style={[s.headerBtnInner, { backgroundColor: Colors.brand.primary + '10' }]}>
              <Ionicons name="refresh" size={18} color={Colors.brand.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Disclaimer ─────────────────────────────────────────────── */}
        <View style={[s.disclaimerBar, { backgroundColor: isDark ? Colors.brand.primary + '08' : '#FEF9EF' }]}>
          <Ionicons name="shield-checkmark-outline" size={12} color={isDark ? Colors.brand.accent : '#B45309'} />
          <Text style={[s.disclaimerText, { color: isDark ? c.textTertiary : '#92400E' }]}>
            AI-generated content. Not SEBI-registered investment advice. For informational purposes only.
          </Text>
        </View>

        {/* ── Chat Messages ──────────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.chatContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* ── Bottom Controls ────────────────────────────────────────── */}
        <View
          style={[
            s.bottomBar,
            {
              backgroundColor: c.surface,
              borderTopColor: c.border,
            },
          ]}
        >
          {/* Recording State */}
          {isRecording && (
            <View style={s.recordingOverlay}>
              <View style={s.pulseContainer}>
                <PulseRing color={Colors.brand.primary + '25'} delay={0} />
                <PulseRing color={Colors.brand.primary + '15'} delay={600} />
                <PulseRing color={Colors.brand.primary + '08'} delay={1200} />
                <LinearGradient
                  colors={[Colors.brand.primary, Colors.brand.secondary]}
                  style={s.recordingCore}
                >
                  <Ionicons name="mic" size={28} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={[s.recordingLabel, { color: c.text }]}>Listening...</Text>
              <Text style={[s.recordingHint, { color: c.textTertiary }]}>
                Auto-stops when you pause · or tap below
              </Text>
              <TouchableOpacity
                onPress={stopRecording}
                style={s.stopRecBtn}
                activeOpacity={0.8}
              >
                <View style={s.stopRecDot} />
                <Text style={s.stopRecText}>Stop Recording</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Speaking State — AI is talking */}
          {isSpeaking && !isRecording && !isProcessing && (
            <View style={s.speakingOverlay}>
              <View style={s.speakingRow}>
                <LinearGradient
                  colors={[Colors.brand.primary + '20', Colors.brand.secondary + '15']}
                  style={s.speakingIndicator}
                >
                  <WaveBars color={Colors.brand.primary} barCount={5} />
                </LinearGradient>
                <View style={s.speakingInfo}>
                  <Text style={[s.speakingLabel, { color: c.text }]}>AI is speaking</Text>
                  <Text style={[s.speakingHint, { color: c.textTertiary }]}>Tap stop to interrupt</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={stopSpeaking}
                style={s.stopSpeakBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="stop-circle" size={16} color="#fff" />
                <Text style={s.stopSpeakText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Processing State */}
          {isProcessing && !isRecording && (
            <View style={s.processingWrap}>
              <View style={[s.processingIcon, { backgroundColor: Colors.brand.primary + '10' }]}>
                <ActivityIndicator size="small" color={Colors.brand.primary} />
              </View>
              <View>
                <Text style={[s.processingTitle, { color: c.text }]}>Processing</Text>
                <Text style={[s.processingText, { color: c.textTertiary }]}>
                  Analyzing your question...
                </Text>
              </View>
            </View>
          )}

          {/* Input Area */}
          {!isRecording && !isProcessing && !isSpeaking && (
            <View style={s.inputArea}>
              {showTextInput ? (
                <View style={s.textInputRow}>
                  <TouchableOpacity
                    onPress={() => setShowTextInput(false)}
                    style={[s.inputToggle, { backgroundColor: Colors.brand.primary + '10' }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="mic" size={20} color={Colors.brand.primary} />
                  </TouchableOpacity>
                  <View
                    style={[
                      s.textInputWrap,
                      {
                        backgroundColor: isDark ? c.inputBg : '#F9FAFB',
                        borderColor: c.inputBorder,
                      },
                    ]}
                  >
                    <TextInput
                      style={[s.textInputField, { color: c.text }]}
                      placeholder="Ask about this report..."
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
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[Colors.brand.primary, Colors.brand.secondary]}
                          style={s.sendBtn}
                        >
                          <Ionicons name="send" size={14} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <View style={s.voiceInputArea}>
                  <TouchableOpacity
                    onPress={() => setShowTextInput(true)}
                    style={[s.sideBtn, { backgroundColor: isDark ? '#ffffff08' : '#F3F4F6' }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={c.textSecondary} />
                    <Text style={[s.sideBtnText, { color: c.textSecondary }]}>Type</Text>
                  </TouchableOpacity>

                  {/* Premium Mic Button */}
                  <View style={s.micBtnWrap}>
                    <Animated.View
                      style={[
                        s.micGlowRing,
                        {
                          backgroundColor: Colors.brand.primary + '15',
                          opacity: micGlow.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 0.8],
                          }),
                          transform: [
                            {
                              scale: micGlow.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.15],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={startRecording}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[Colors.brand.primary, Colors.brand.secondary]}
                        style={s.micBtn}
                      >
                        <Ionicons name="mic" size={28} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={[s.sideBtn, { backgroundColor: 'transparent' }]}>
                    <Ionicons name="volume-high-outline" size={18} color={c.textTertiary} />
                    <Text style={[s.sideBtnText, { color: c.textTertiary, fontSize: 9 }]}>
                      Voice AI
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.select({ ios: 56, web: 16, default: 48 }),
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnInner: {
    width: 36,
    height: 36,
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
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerSub: {
    fontSize: FontSize.xs,
  },

  // ── Disclaimer ────────────────────────────────────────────────────────
  disclaimerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: Spacing.lg,
  },
  disclaimerText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  // ── Chat ──────────────────────────────────────────────────────────────
  chatContainer: {
    padding: Spacing.lg,
    paddingBottom: 24,
  },

  // ── Messages ──────────────────────────────────────────────────────────
  msgRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
    gap: 10,
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18, // align with bubble below sender label
  },
  avatarGradient: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgContent: {
    maxWidth: '75%',
    gap: 3,
  },
  senderLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginHorizontal: 4,
  },
  msgBubble: {
    padding: Spacing.md,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
  },
  msgText: {
    fontSize: FontSize.base,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  thinkingText: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  replayText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // ── System message ────────────────────────────────────────────────────
  systemMsgWrap: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  systemMsgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
  },
  systemMsgText: {
    fontSize: FontSize.xs,
    textAlign: 'center',
  },

  // ── Bottom bar ────────────────────────────────────────────────────────
  bottomBar: {
    borderTopWidth: 1,
    paddingBottom: Platform.select({ ios: 34, default: 16 }),
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 80,
  },

  // ── Voice input ───────────────────────────────────────────────────────
  voiceInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  micBtnWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  micGlowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  micBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  sideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  sideBtnText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Text input ────────────────────────────────────────────────────────
  inputArea: {},
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputToggle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
  },
  textInputField: {
    flex: 1,
    fontSize: FontSize.base,
    letterSpacing: -0.1,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Recording ─────────────────────────────────────────────────────────
  recordingOverlay: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  pulseContainer: {
    width: 88,
    height: 88,
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
    elevation: 4,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  recordingLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  recordingHint: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  stopRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: '#EF4444',
    marginTop: Spacing.md,
  },
  stopRecDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  stopRecText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // ── Speaking state ────────────────────────────────────────────────────
  speakingOverlay: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  speakingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  speakingIndicator: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakingInfo: {
    gap: 2,
  },
  speakingLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  speakingHint: {
    fontSize: FontSize.xs,
  },
  stopSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: '#EF4444',
  },
  stopSpeakText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // ── Processing ────────────────────────────────────────────────────────
  processingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: Spacing.lg,
  },
  processingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  processingText: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },

  // ── Bouncing dots ─────────────────────────────────────────────────────
  bouncingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
    paddingHorizontal: 4,
  },
  bouncingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // ── Wave bars ─────────────────────────────────────────────────────────
  waveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
});
