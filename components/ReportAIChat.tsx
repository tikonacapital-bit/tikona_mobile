/**
 * ReportAIChat — Premium Speech-to-Speech AI Assistant
 *
 * A stunning full-screen modal chat interface powered by Sarvam AI + Claude Sonnet.
 * Users can speak questions about a report and hear AI answers spoken back.
 * Also supports text-based chat as a fallback.
 */

import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  appendMessages,
  closeChatSession,
  createChatSession,
  deleteChatSession,
  fetchChatSessions,
  type ChatLogMessage,
  type ChatSession,
} from '@/lib/chatLogger';
import { logger } from '@/lib/logger';
import {
  buildReportContext,
  chatWithReport,
  speechToText,
  textToSpeech,
  type ChatHistoryEntry,
} from '@/lib/sarvamAI';
import type { ResearchReport } from '@/lib/types';
import { useAuth as useClerkAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  hasAudio?: boolean;
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
  const { userId, wallet, refreshWallet } = useAuth();
  const { getToken } = useClerkAuth();
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingPastSession, setViewingPastSession] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const reportContext = useRef<string>('');
  const chatHistory = useRef<ChatHistoryEntry[]>([]);
  const silenceStartRef = useRef<number | null>(null);
  const isStoppingRef = useRef(false);
  const mountedRef = useRef(true);
  const audioCache = useRef<Map<string, string>>(new Map());
  const sessionIdRef = useRef<string | null>(null);
  const savedLiveMessages = useRef<ChatMessage[]>([]);

  const MAX_HISTORY = 10;

  // ── Chat Session Logging Helpers ─────────────────────────────────
  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current || !userId) return;
    const id = await createChatSession({
      userId,
      reportId: report.report_id,
      companyName: report.company_name,
      nseSymbol: report.nse_symbol,
    });
    sessionIdRef.current = id;
  }, [userId, report]);

  const logMessages = useCallback(async (msgs: ChatLogMessage[]) => {
    if (!sessionIdRef.current) return;
    // Fire-and-forget — don't block the chat UX
    appendMessages(sessionIdRef.current, msgs).catch(() => { });
  }, []);

  const endSession = useCallback(async () => {
    if (sessionIdRef.current) {
      closeChatSession(sessionIdRef.current).catch(() => { });
      sessionIdRef.current = null;
    }
  }, []);

  // ── Chat History Helpers ──────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setLoadingHistory(true);
    const sessions = await fetchChatSessions(userId, report.report_id);
    setPastSessions(sessions);
    setLoadingHistory(false);
    setShowHistory(true);
  }, [userId, report.report_id]);

  const loadPastSession = useCallback((session: ChatSession) => {
    // Save current live messages so we can restore them
    if (!viewingPastSession) {
      savedLiveMessages.current = messages;
    }

    // Convert stored messages to ChatMessage format
    const pastMessages: ChatMessage[] = session.messages.map((msg, i) => ({
      id: `past-${session.id}-${i}`,
      role: msg.role,
      text: msg.text,
      timestamp: new Date(msg.timestamp),
    }));

    setMessages(pastMessages);
    setViewingPastSession(true);
    setShowHistory(false);
  }, [messages, viewingPastSession]);

  const backToLiveChat = useCallback(() => {
    setMessages(savedLiveMessages.current.length > 0 ? savedLiveMessages.current : [
      {
        id: 'welcome',
        role: 'assistant',
        text: `Hi! I'm your AI research assistant. I've fully analyzed the report on ${report.company_name} (${report.nse_symbol}). Ask me anything — financials, risks, valuation, or growth outlook.`,
        timestamp: new Date(),
      },
    ]);
    setViewingPastSession(false);
    savedLiveMessages.current = [];
  }, [report]);

  const handleDeleteSession = useCallback((session: ChatSession) => {
    setSessionToDelete(session);
  }, []);

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const id = sessionToDelete.id;
    // Hide modal immediately
    setSessionToDelete(null);

    // Optimistic update
    setPastSessions((prev) => prev.filter((s) => s.id !== id));
    if (viewingPastSession && messages.every(m => m.id.startsWith(`past-${id}`))) {
      backToLiveChat();
    }
    await deleteChatSession(id);
  };

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
          text: `Hi! I'm your AI research assistant. I've fully analyzed the report on ${report.company_name} (${report.nse_symbol}). Ask me anything — financials, risks, valuation, or growth outlook.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      // Clean up cached audio temp files
      audioCache.current.forEach((filePath) => {
        FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => { });
      });
      audioCache.current.clear();
    };
  }, []);

  // ── Handle app going to background — stop audio playback ─────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => { });
          soundRef.current.unloadAsync().catch(() => { });
          soundRef.current = null;
          setIsSpeaking(false);
        }
        if (recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(() => { });
          recordingRef.current = null;
          setIsRecording(false);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    // Fix #4: Guard against double recording start
    if (recordingRef.current || isRecording || isProcessing || isStoppingRef.current) return;

    const balance = wallet ? wallet.credits_balance : 50;
    if (balance < 2) {
      Alert.alert(
        'Insufficient Credits',
        'Voice chat requires 2 AI credits. Please upgrade your plan or top up to continue.'
      );
      return;
    }

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
        if (!recordingRef.current || isStoppingRef.current) return;

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
      logger.error('[Recording] Start error:', err);
      addSystemMessage('Could not start recording. Please check microphone permissions.');
    }
  }, [isRecording, isProcessing]);

  const stopRecording = useCallback(async () => {
    // Fix #5: Lock to prevent race condition between silence-auto-stop and manual stop
    if (!recordingRef.current || isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      setIsRecording(false);
      setIsProcessing(true);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        addSystemMessage('Recording failed — no audio captured.');
        setIsProcessing(false);
        isStoppingRef.current = false;
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      const sttResult = await speechToText(base64, 'en-IN', (await getToken()) || '');
      const userText = sttResult.transcript;

      if (!userText.trim()) {
        addSystemMessage("I couldn't hear you clearly. Please try again.");
        setIsProcessing(false);
        isStoppingRef.current = false;
        return;
      }

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: userText,
        timestamp: new Date(),
      };
      if (mountedRef.current) setMessages((prev) => [...prev, userMsg]);

      const loadingId = (Date.now() + 1).toString();
      if (mountedRef.current) {
        setMessages((prev) => [
          ...prev,
          { id: loadingId, role: 'assistant', text: '', timestamp: new Date(), isLoading: true },
        ]);
      }

      const chatResult = await chatWithReport(userText, reportContext.current, chatHistory.current, (await getToken()) || '');

      // Refresh wallet to get exact updated balance post-deduction
      refreshWallet();

      // Fix #2: Cap chat history to prevent unbounded growth
      chatHistory.current = [
        ...chatHistory.current,
        { role: 'user' as const, content: userText },
        { role: 'assistant' as const, content: chatResult.reply },
      ].slice(-MAX_HISTORY);

      // Log this exchange to Supabase (fire-and-forget)
      await ensureSession();
      logMessages([
        { role: 'user', text: userText, timestamp: new Date().toISOString(), input_mode: 'voice' },
        { role: 'assistant', text: chatResult.reply, timestamp: new Date().toISOString() },
      ]);

      let hasAudio = false;
      try {
        const ttsResult = await textToSpeech(chatResult.reply, sttResult.language_code || 'en-IN', (await getToken()) || '');
        if (ttsResult.audio) {
          // Fix #3: Store audio in ref cache instead of React state
          audioCache.current.set(loadingId, ttsResult.audio);
          hasAudio = true;
        }
      } catch (ttsErr) {
        logger.warn('[TTS] Error, continuing without audio:', ttsErr);
      }

      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { ...m, text: chatResult.reply, hasAudio, isLoading: false }
              : m
          )
        );
      }

      if (hasAudio) {
        const cachedAudio = audioCache.current.get(loadingId);
        if (cachedAudio) await playAudioBase64(cachedAudio);
      }
    } catch (err) {
      logger.error('[Recording] Processing error:', err);
      addSystemMessage('Something went wrong processing your voice. Please try again.');
    } finally {
      if (mountedRef.current) setIsProcessing(false);
      isStoppingRef.current = false;
    }
  }, []);

  // ── Text Chat ─────────────────────────────────────────────────────────
  const sendTextMessage = useCallback(async () => {
    const text = textInput.trim();
    if (!text || isProcessing) return;

    const balance = wallet ? wallet.credits_balance : 50;
    if (balance < 1) {
      Alert.alert(
        'Insufficient Credits',
        'Text chat requires 1 AI credit. Please upgrade your plan or top up to continue.'
      );
      return;
    }

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
      const chatResult = await chatWithReport(text, reportContext.current, chatHistory.current, (await getToken()) || '');

      // Refresh wallet visually
      refreshWallet();

      // Fix #2: Cap chat history
      chatHistory.current = [
        ...chatHistory.current,
        { role: 'user' as const, content: text },
        { role: 'assistant' as const, content: chatResult.reply },
      ].slice(-MAX_HISTORY);

      // Log this exchange to Supabase (fire-and-forget)
      await ensureSession();
      logMessages([
        { role: 'user', text, timestamp: new Date().toISOString(), input_mode: 'text' },
        { role: 'assistant', text: chatResult.reply, timestamp: new Date().toISOString() },
      ]);

      let hasAudio = false;
      try {
        const ttsResult = await textToSpeech(chatResult.reply, 'en-IN', (await getToken()) || '');
        if (ttsResult.audio) {
          // Fix #3: Store audio in ref cache instead of React state
          audioCache.current.set(loadingId, ttsResult.audio);
          hasAudio = true;
        }
      } catch (ttsErr) {
        logger.warn('[TTS] Error:', ttsErr);
      }

      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { ...m, text: chatResult.reply, hasAudio, isLoading: false }
              : m
          )
        );
      }

      if (hasAudio) {
        const cachedAudio = audioCache.current.get(loadingId);
        if (cachedAudio) await playAudioBase64(cachedAudio);
      }
    } catch (err) {
      logger.error('[Chat] Error:', err);
      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { ...m, text: 'Sorry, I encountered an error. Please try again.', isLoading: false }
              : m
          )
        );
      }
    } finally {
      if (mountedRef.current) setIsProcessing(false);
    }
  }, [textInput, isProcessing]);

  // ── Audio Playback ────────────────────────────────────────────────────
  const playAudioBase64 = async (base64: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (mountedRef.current) setIsSpeaking(true);

      // Ensure audio mode is set for playback (not recording)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      let audioUri: string;
      let tempPath: string | null = null;

      // Try writing to temp file to avoid OOM from huge data: URI strings
      try {
        tempPath = `${FileSystem.cacheDirectory}ai_audio_${Date.now()}.wav`;
        await FileSystem.writeAsStringAsync(tempPath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        audioUri = tempPath;
      } catch (fileErr) {
        logger.warn('[Audio] Temp file write failed, using data URI fallback:', fileErr);
        tempPath = null;
        audioUri = `data:audio/wav;base64,${base64}`;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      const fileToClean = tempPath;

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          if (mountedRef.current) setIsSpeaking(false);
          sound.unloadAsync().catch(() => { });
          soundRef.current = null;
          if (fileToClean) {
            FileSystem.deleteAsync(fileToClean, { idempotent: true }).catch(() => { });
          }
        }
      });
    } catch (err) {
      logger.error('[Audio] Playback error:', err);
      if (mountedRef.current) setIsSpeaking(false);
    }
  };

  const replayAudio = async (msgId: string) => {
    const audio = audioCache.current.get(msgId);
    if (audio) await playAudioBase64(audio);
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
      logger.warn('[Audio] Stop error:', err);
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
    endSession();
    onClose();
  };

  // Full reset — starts a new chat session
  const handleNewChat = useCallback(() => {
    // Close the current logging session before resetting
    endSession();

    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => { });
      soundRef.current.unloadAsync().catch(() => { });
      soundRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => { });
      recordingRef.current = null;
    }
    setIsSpeaking(false);
    setIsRecording(false);
    setIsProcessing(false);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: `Hi! I'm your AI research assistant. I've fully analyzed the report on ${report.company_name} (${report.nse_symbol}). Ask me anything — financials, risks, valuation, or growth outlook.`,
        timestamp: new Date(),
      },
    ]);
    setShowTextInput(false);
    chatHistory.current = [];
    isStoppingRef.current = false;
    // Clean up cached audio temp files
    audioCache.current.forEach((filePath) => {
      FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => { });
    });
    audioCache.current.clear();
  }, [report, endSession]);

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
          {isUser ? (
            <LinearGradient
              colors={[Colors.brand.primary, '#1e3a8a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.msgBubble, s.userBubble]}
            >
              <Text style={[s.msgText, { color: '#fff' }]}>{item.text}</Text>
            </LinearGradient>
          ) : (
            <View
              style={[
                s.msgBubble,
                {
                  backgroundColor: isDark ? c.surfaceElevated : '#EEF2FF',
                  borderBottomLeftRadius: 4,
                  borderWidth: 1,
                  borderColor: isDark ? c.border : '#C7D7FF',
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
                  <Text style={[s.msgText, { color: c.text }]}>{item.text}</Text>
                  {item.hasAudio && (
                    <TouchableOpacity
                      style={[
                        s.replayBtn,
                        {
                          backgroundColor: Colors.brand.primary + '10',
                          borderColor: Colors.brand.primary + '20',
                        },
                      ]}
                      onPress={() => replayAudio(item.id)}
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
          )}
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

  const SUGGESTIONS = [
    'Key financial metrics?',
    'What is the growth outlook?',
    'Main risks to watch?',
    'Investment thesis?',
    'Competitive advantages?',
    'Current valuation summary?',
  ];

  // ── Main Render ───────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: c.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Premium Header ─────────────────────────────────────────── */}
        <LinearGradient
          colors={isDark ? ['#0f172a', '#1e293b'] : [Colors.brand.primary, '#1e3a8a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}
        >
          <TouchableOpacity onPress={handleMinimize} style={s.headerBtn} activeOpacity={0.7}>
            <View style={[s.headerBtnInner, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <View style={[s.headerIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
            <View>
              <Text style={[s.headerTitle, { color: '#fff' }]}>AI Assistant</Text>
              <View style={s.headerStatusRow}>
                <View style={[s.statusDot, { backgroundColor: '#34D399' }]} />
                <Text style={[s.headerSub, { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={1}>
                  {report.company_name} · {report.nse_symbol}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={loadHistory} style={s.headerBtn} activeOpacity={0.7}>
            <View style={[s.headerBtnInner, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Ionicons name="time-outline" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNewChat} style={s.headerBtn} activeOpacity={0.7}>
            <View style={[s.headerBtnInner, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Ionicons name="refresh" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Viewing Past Session Banner ──────────────────────────────── */}
        {viewingPastSession && (
          <TouchableOpacity
            onPress={backToLiveChat}
            style={[s.pastSessionBanner, { backgroundColor: isDark ? '#1e293b' : '#EFF4FF' }]}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back-circle" size={18} color={Colors.brand.primary} />
            <Text style={[s.pastSessionBannerText, { color: Colors.brand.primary }]}>
              Viewing past chat · Tap to return to live chat
            </Text>
          </TouchableOpacity>
        )}

        {/* ── History Panel Overlay ────────────────────────────────────── */}
        {showHistory && (
          <View style={[s.historyOverlay, { backgroundColor: c.background, paddingTop: Math.max(insets.top, 0) }]}>
            <View style={[s.historyHeader, { borderBottomColor: c.border }]}>
              <Text style={[s.historyTitle, { color: c.text }]}>Chat History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)} style={s.historyCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={c.text} />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={s.historyLoading}>
                <ActivityIndicator size="large" color={Colors.brand.primary} />
                <Text style={[s.historyLoadingText, { color: c.textTertiary }]}>Loading past chats...</Text>
              </View>
            ) : pastSessions.length === 0 ? (
              <View style={s.historyEmpty}>
                <Ionicons name="chatbubbles-outline" size={48} color={c.textTertiary} />
                <Text style={[s.historyEmptyTitle, { color: c.text }]}>No Past Chats</Text>
                <Text style={[s.historyEmptyText, { color: c.textTertiary }]}>
                  Your conversations with the AI assistant will appear here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={pastSessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.historyList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const firstUserMsg = item.messages.find((m) => m.role === 'user');
                  const sessionDate = new Date(item.started_at);
                  const isToday = new Date().toDateString() === sessionDate.toDateString();
                  const dateStr = isToday
                    ? `Today · ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : sessionDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                  return (
                    <View
                      style={[
                        s.historyCard,
                        {
                          backgroundColor: isDark ? c.surfaceElevated : '#F9FAFB',
                          borderColor: isDark ? c.border : '#E5E7EB',
                        },
                      ]}
                    >
                      <View style={s.historyCardTop}>
                        <TouchableOpacity
                          style={s.historyCardMainClick}
                          onPress={() => loadPastSession(item)}
                          activeOpacity={0.7}
                        >
                          <View style={[s.historyCardIcon, { backgroundColor: Colors.brand.primary + '12' }]}>
                            <Ionicons name="chatbubble-ellipses" size={16} color={Colors.brand.primary} />
                          </View>
                          <View style={s.historyCardMeta}>
                            <Text style={[s.historyCardDate, { color: c.textSecondary }]}>{dateStr}</Text>
                            <Text style={[s.historyCardCount, { color: c.textTertiary }]}>
                              {item.message_count} message{item.message_count !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.historyCardDeleteBtn}
                          onPress={() => handleDeleteSession(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {firstUserMsg && (
                        <TouchableOpacity
                          style={s.historyCardPreviewWrap}
                          onPress={() => loadPastSession(item)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[s.historyCardPreview, { color: c.text }]}
                            numberOfLines={2}
                          >
                            "{firstUserMsg.text}"
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}

            {/* ── Custom Premium Delete Confirmation Modal ──────────────── */}
            {sessionToDelete && (
              <View style={s.deleteModalOverlay}>
                <View style={[s.deleteModalCard, { backgroundColor: isDark ? c.surfaceElevated : '#fff' }]}>
                  <View style={s.deleteModalIconWrap}>
                    <Ionicons name="warning" size={32} color="#EF4444" />
                  </View>
                  <Text style={[s.deleteModalTitle, { color: c.text }]}>Delete Chat</Text>
                  <Text style={[s.deleteModalText, { color: c.textSecondary }]}>
                    Are you sure you want to permanently delete this chat history? This action cannot be undone.
                  </Text>

                  <View style={s.deleteModalActions}>
                    <TouchableOpacity
                      style={[s.deleteModalBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
                      onPress={() => setSessionToDelete(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.deleteModalBtnText, { color: c.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.deleteModalBtn, { backgroundColor: '#EF4444' }]}
                      onPress={confirmDeleteSession}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.deleteModalBtnText, { color: '#fff' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
          {/* Suggestion Chips — pinned inside bottom bar */}
          {messages.length <= 1 && !isRecording && !isProcessing && !isSpeaking && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chipsScroll}
                style={s.chipsBreakout}
              >
                {SUGGESTIONS.map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={[
                      s.chip,
                      {
                        backgroundColor: isDark ? '#1e293b' : '#EFF4FF',
                        borderColor: Colors.brand.primary + '35',
                      },
                    ]}
                    onPress={() => {
                      setTextInput(chip);
                      setShowTextInput(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, { color: isDark ? Colors.brand.accent : Colors.brand.primary }]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={[s.chipsDivider, { backgroundColor: c.border }]} />
            </>
          )}
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
            <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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
                                outputRange: [1, 1.2],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                    <TouchableOpacity onPress={startRecording} activeOpacity={0.85}>
                      <LinearGradient
                        colors={[Colors.brand.primary, Colors.brand.secondary]}
                        style={s.micBtn}
                      >
                        <Ionicons name="mic" size={28} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Hint + Type toggle */}
                  <View style={s.voiceHintRow}>
                    <Text style={[s.voiceHintText, { color: c.textSecondary }]}>
                      Tap mic to speak
                    </Text>
                    <View style={[s.voiceDivider, { backgroundColor: c.border }]} />
                    <TouchableOpacity
                      onPress={() => setShowTextInput(true)}
                      style={[s.typeToggleBtn, { backgroundColor: Colors.brand.primary + '10' }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color={Colors.brand.primary} />
                      <Text style={[s.typeToggleText, { color: Colors.brand.primary }]}>Type instead</Text>
                    </TouchableOpacity>
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
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
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
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  userBubble: {
    borderBottomRightRadius: 4,
    shadowColor: Colors.brand.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
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

  // ── Suggestion chips ──────────────────────────────────────────────────
  chipsBreakout: {
    marginHorizontal: -Spacing.lg, // break out of bottomBar horizontal padding
  },
  chipsScroll: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  chipsDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.md,
  },

  // ── Bottom bar ────────────────────────────────────────────────────────
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 0,
    paddingHorizontal: Spacing.lg,
  },

  // ── Voice input ───────────────────────────────────────────────────────
  voiceInputArea: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: 4,
    gap: 12,
  },
  voiceHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceHintText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  voiceDivider: {
    width: 1,
    height: 12,
  },
  typeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  typeToggleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
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
  inputArea: { paddingTop: Spacing.md },
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

  // ── History panel ──────────────────────────────────────────────────
  historyOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    paddingTop: 0,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  historyCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  historyLoadingText: {
    fontSize: FontSize.sm,
  },
  historyEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: Spacing['2xl'],
  },
  historyEmptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: 8,
  },
  historyEmptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  historyList: {
    padding: Spacing.lg,
    gap: 10,
  },
  historyCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 8,
    marginBottom: 10,
  },
  historyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyCardMainClick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyCardDeleteBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyCardMeta: {
    flex: 1,
    gap: 1,
  },
  historyCardDate: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  historyCardCount: {
    fontSize: FontSize.xs,
  },
  historyCardPreviewWrap: {
    paddingLeft: 46,
    marginTop: -4,
  },
  historyCardPreview: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // ── Past session banner ───────────────────────────────────────────
  pastSessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
  },
  pastSessionBannerText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // ── Custom Delete Modal ───────────────────────────────────────────
  deleteModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    padding: Spacing.xl,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: Spacing['xl'],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  deleteModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  deleteModalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
    paddingHorizontal: 8,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalBtnText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
