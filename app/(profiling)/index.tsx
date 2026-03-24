import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, Alert, Dimensions, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { getAuthenticatedSupabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useAlert } from '@/context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import type { ProfilingQuestion, RiskProfileLevel, DisplayLabel, ProfileMethod } from '@/lib/types';
import { RISK_DISPLAY_MAP, DISPLAY_RISK_MAP } from '@/lib/types';

// Hardcoded questions (can later be fetched from Supabase profiling_questions table)
const QUESTIONS: (Omit<ProfilingQuestion, 'sort_order' | 'is_active'> & { text: string })[] = [
    // Easy
    { id: 'q1', difficulty: 'easy', question_text: 'What is your primary investment goal?', text: 'What is your primary investment goal?', options: [{ text: 'Preserve capital', score: 1 }, { text: 'Steady growth', score: 2 }, { text: 'Aggressive growth', score: 3 }] },
    { id: 'q2', difficulty: 'easy', question_text: 'How long do you plan to hold your investments?', text: 'How long do you plan to hold your investments?', options: [{ text: 'Less than 1 year', score: 1 }, { text: '1-5 years', score: 2 }, { text: 'More than 5 years', score: 3 }] },
    { id: 'q3', difficulty: 'easy', question_text: 'How do you feel about stock market fluctuations?', text: 'How do you feel about stock market fluctuations?', options: [{ text: 'Very anxious', score: 1 }, { text: 'Somewhat concerned but okay', score: 2 }, { text: 'Comfortable, it\'s part of investing', score: 3 }] },
    // Medium
    { id: 'q4', difficulty: 'medium', question_text: 'If your portfolio drops 20% in a month, what would you do?', text: 'If your portfolio drops 20% in a month, what would you do?', options: [{ text: 'Sell immediately', score: 1 }, { text: 'Hold and wait', score: 2 }, { text: 'Buy more at lower prices', score: 3 }] },
    { id: 'q5', difficulty: 'medium', question_text: 'What percentage of your savings are you investing?', text: 'What percentage of your savings are you investing?', options: [{ text: 'More than 50%', score: 1 }, { text: '20% to 50%', score: 2 }, { text: 'Less than 20%', score: 3 }] },
    { id: 'q6', difficulty: 'medium', question_text: 'How familiar are you with investment products?', text: 'How familiar are you with investment products?', options: [{ text: 'Beginner', score: 1 }, { text: 'Intermediate', score: 2 }, { text: 'Advanced', score: 3 }] },
    // Hard
    { id: 'q7', difficulty: 'hard', question_text: 'Do you rely on investments for current income?', text: 'Do you rely on investments for current income?', options: [{ text: 'Yes, heavily', score: 1 }, { text: 'Partially', score: 2 }, { text: 'No, growth is my focus', score: 3 }] },
    { id: 'q8', difficulty: 'hard', question_text: 'How stable is your regular income source?', text: 'How stable is your regular income source?', options: [{ text: 'Unstable / variable', score: 1 }, { text: 'Moderately stable', score: 2 }, { text: 'Very stable', score: 3 }] },
    { id: 'q9', difficulty: 'hard', question_text: 'Your understanding of complex instruments (Derivatives, Options)?', text: 'Your understanding of complex instruments (Derivatives, Options)?', options: [{ text: 'None', score: 1 }, { text: 'Basic theory', score: 2 }, { text: 'Active trader', score: 3 }] },
];

const DIFFICULTY_COLORS = { easy: '#10B981', medium: '#F59E0B', hard: '#EF4444' };
const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const LEVEL_OPTIONS: { label: DisplayLabel; risk: RiskProfileLevel; emoji: string; description: string; color: string }[] = [
    { label: 'Beginner', risk: 'Conservative', emoji: '🛡️', description: 'Low risk, capital preservation focused', color: '#10B981' },
    { label: 'Intermediate', risk: 'Moderate', emoji: '⚖️', description: 'Balanced risk, steady growth focused', color: '#F59E0B' },
    { label: 'Pro', risk: 'Aggressive', emoji: '🚀', description: 'High risk, aggressive growth focused', color: '#EF4444' },
];

type Screen = 'choice' | 'quiz' | 'result' | 'manual' | 'success';

export default function ProfilingScreen() {
    const { user, refreshUserData, subscription } = useAuth();
    const { getToken } = useClerkAuth();
    const theme = useColorScheme();
    const c = Colors[theme];
    const { showAlert } = useAlert();

    const [screen, setScreen] = useState<Screen>('choice');
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [quizScore, setQuizScore] = useState<number | null>(null);
    const [assignedLevel, setAssignedLevel] = useState<RiskProfileLevel | null>(null);
    const [selectedManualLevel, setSelectedManualLevel] = useState<DisplayLabel | null>(null);
    const [savedProfile, setSavedProfile] = useState<{ risk: RiskProfileLevel; label: DisplayLabel; score: number | null } | null>(null);

    const question = QUESTIONS[currentQ];
    const progress = (currentQ + 1) / QUESTIONS.length;
    const allAnswered = Object.keys(answers).length === QUESTIONS.length;

    const handleSelect = (score: number) => {
        setAnswers(prev => ({ ...prev, [question.id]: score }));
        if (currentQ < QUESTIONS.length - 1) {
            setTimeout(() => setCurrentQ(currentQ + 1), 300);
        }
    };

    const getProfile = (total: number): RiskProfileLevel => {
        if (total <= 13) return 'Conservative';
        if (total <= 20) return 'Moderate';
        return 'Aggressive';
    };

    const finishQuiz = () => {
        const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);
        const profile = getProfile(totalScore);
        setQuizScore(totalScore);
        setAssignedLevel(profile);
        setScreen('result');
    };

    const saveProfile = async (
        riskProfile: RiskProfileLevel,
        method: ProfileMethod,
        score: number | null,
        rawAnswers: Record<string, number> | null,
    ) => {
        if (!user?.id) {
            showAlert('Session Error', 'Your session has expired. Please sign in again.');
            return;
        }
        setLoading(true);
        const displayLabel = RISK_DISPLAY_MAP[riskProfile];

        // Get authenticated Supabase client for RLS
        let client;
        try {
            const token = await getToken({ template: 'supabase' });
            client = getAuthenticatedSupabase(token);
        } catch {
            showAlert('Auth Error', 'Could not authenticate. Please try again.');
            setLoading(false);
            return;
        }

        const { error } = await client.from('profiles').upsert({
            user_id: user.id,
            risk_score: score,
            risk_profile: riskProfile,
            profile_method: method,
            display_label: displayLabel,
            answers: rawAnswers,
        }, { onConflict: 'user_id' });

        if (error) {
            showAlert('Save Failed', `${error.message}\n\nPlease tap the button again to retry.`);
            setLoading(false);
            return;
        }

        // Also create a free subscription if none exists
        if (!subscription) {
            await client.from('subscriptions').upsert({
                user_id: user.id,
                plan: 'free',
                is_active: true,
            }, { onConflict: 'user_id' });
        }

        await refreshUserData();
        setLoading(false);

        setSavedProfile({ risk: riskProfile, label: displayLabel, score });
        setScreen('success');
    };

    const handleAcceptQuizResult = () => {
        if (assignedLevel) {
            saveProfile(assignedLevel, 'quiz', quizScore, answers);
        }
    };

    const handleOverrideWithManual = () => {
        setScreen('manual');
    };

    const handleManualSelect = (label: DisplayLabel) => {
        setSelectedManualLevel(label);
    };

    const handleConfirmManual = () => {
        if (!selectedManualLevel) return;
        const risk = DISPLAY_RISK_MAP[selectedManualLevel];
        const method: ProfileMethod = quizScore ? 'quiz_override' : 'manual';
        saveProfile(risk, method, quizScore, Object.keys(answers).length > 0 ? answers : null);
    };

    const handleSkipQuiz = () => {
        setScreen('manual');
    };

    // ─── SCREEN: SUCCESS ───
    if (screen === 'success' && savedProfile) {
        const successLevel = LEVEL_OPTIONS.find(l => l.risk === savedProfile.risk)!;
        return (
            <View style={[styles.container, { backgroundColor: c.background }]}>
                <View style={styles.successContent}>
                    <View style={[styles.successIconCircle, { backgroundColor: successLevel.color + '15' }]}>
                        <Text style={styles.successEmoji}>{successLevel.emoji}</Text>
                    </View>

                    <Text style={[styles.successTitle, { color: c.text }]}>You're all set!</Text>
                    <Text style={[styles.successProfileLabel, { color: successLevel.color }]}>
                        {savedProfile.label} Investor
                    </Text>

                    {savedProfile.score && (
                        <View style={[styles.successScorePill, { backgroundColor: c.borderLight }]}>
                            <Text style={[styles.successScoreText, { color: c.textSecondary }]}>Score: {savedProfile.score}/27</Text>
                        </View>
                    )}

                    <Text style={[styles.successDesc, { color: c.textSecondary }]}>
                        Reports and recommendations will be tailored to your {savedProfile.label.toLowerCase()} profile.
                    </Text>

                    <TouchableOpacity
                        style={[styles.successBtn, { backgroundColor: Colors.brand.primary }]}
                        onPress={() => router.replace('/')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.successBtnText}>Go to Dashboard</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─── SCREEN: CHOICE ───
    if (screen === 'choice') {
        return (
            <View style={[styles.container, { backgroundColor: c.background }]}>
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View style={[styles.stepBadge, { backgroundColor: Colors.brand.primary + '15' }]}>
                            <Ionicons name="pie-chart" size={22} color={Colors.brand.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.headerTitle, { color: c.text }]}>Risk Profiling</Text>
                            <Text style={[styles.headerSub, { color: c.textTertiary }]}>Choose how to set your investor level</Text>
                        </View>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.choiceContent}>
                    {/* Take Quiz Option */}
                    <TouchableOpacity
                        style={[styles.choiceCard, { backgroundColor: c.cardBg, borderColor: Colors.brand.primary + '40' }]}
                        onPress={() => setScreen('quiz')}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.choiceIconBg, { backgroundColor: Colors.brand.primary + '15' }]}>
                            <Ionicons name="school" size={28} color={Colors.brand.primary} />
                        </View>
                        <Text style={[styles.choiceTitle, { color: c.text }]}>Take the Quiz</Text>
                        <Text style={[styles.choiceDesc, { color: c.textSecondary }]}>
                            Answer 9 questions and we'll determine your risk level automatically.
                            You can override the result if you disagree.
                        </Text>
                        <View style={[styles.choiceBadge, { backgroundColor: Colors.brand.primary + '15' }]}>
                            <Text style={[styles.choiceBadgeText, { color: Colors.brand.primary }]}>Recommended</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Skip & Choose Manually */}
                    <TouchableOpacity
                        style={[styles.choiceCard, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}
                        onPress={handleSkipQuiz}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.choiceIconBg, { backgroundColor: Colors.brand.gold + '15' }]}>
                            <Ionicons name="hand-left" size={28} color={Colors.brand.gold} />
                        </View>
                        <Text style={[styles.choiceTitle, { color: c.text }]}>Choose Manually</Text>
                        <Text style={[styles.choiceDesc, { color: c.textSecondary }]}>
                            Skip the quiz and select your investor level yourself:
                            Beginner, Intermediate, or Pro.
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ─── SCREEN: RESULT (after quiz) ───
    if (screen === 'result' && assignedLevel) {
        const assigned = LEVEL_OPTIONS.find(l => l.risk === assignedLevel)!;
        return (
            <View style={[styles.container, { backgroundColor: c.background }]}>
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View style={[styles.stepBadge, { backgroundColor: Colors.brand.primary + '15' }]}>
                            <Ionicons name="trophy" size={22} color={Colors.brand.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.headerTitle, { color: c.text }]}>Your Result</Text>
                            <Text style={[styles.headerSub, { color: c.textTertiary }]}>Score: {quizScore}/27</Text>
                        </View>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.choiceContent}>
                    {/* Assigned Level Card */}
                    <View style={[styles.resultCard, { backgroundColor: c.cardBg, borderColor: assigned.color + '60' }]}>
                        <Text style={styles.resultEmoji}>{assigned.emoji}</Text>
                        <Text style={[styles.resultTitle, { color: c.text }]}>{assigned.label}</Text>
                        <Text style={[styles.resultRisk, { color: assigned.color }]}>{assigned.risk} Risk Profile</Text>
                        <Text style={[styles.resultDesc, { color: c.textSecondary }]}>{assigned.description}</Text>
                    </View>

                    <Text style={[styles.resultQuestion, { color: c.textSecondary }]}>
                        Are you satisfied with this level?
                    </Text>

                    {/* Accept Button */}
                    <TouchableOpacity
                        style={[styles.acceptBtn, { backgroundColor: Colors.brand.primary }]}
                        onPress={handleAcceptQuizResult}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                <Text style={styles.acceptBtnText}>Yes, I'm {assigned.label}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Override Button */}
                    <TouchableOpacity
                        style={[styles.overrideBtn, { borderColor: c.border }]}
                        onPress={handleOverrideWithManual}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="swap-horizontal" size={18} color={c.icon} />
                        <Text style={[styles.overrideBtnText, { color: c.textSecondary }]}>
                            No, let me choose a different level
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ─── SCREEN: MANUAL SELECTION ───
    if (screen === 'manual') {
        return (
            <View style={[styles.container, { backgroundColor: c.background }]}>
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={() => setScreen(quizScore ? 'result' : 'choice')} style={{ marginRight: 8 }}>
                            <Ionicons name="arrow-back" size={24} color={c.icon} />
                        </TouchableOpacity>
                        <View style={[styles.stepBadge, { backgroundColor: Colors.brand.gold + '15' }]}>
                            <Ionicons name="hand-left" size={22} color={Colors.brand.gold} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.headerTitle, { color: c.text }]}>Choose Your Level</Text>
                            <Text style={[styles.headerSub, { color: c.textTertiary }]}>
                                {quizScore ? 'Override your quiz result' : 'Select your investor level'}
                            </Text>
                        </View>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.choiceContent}>
                    {LEVEL_OPTIONS.map((level) => {
                        const isSelected = selectedManualLevel === level.label;
                        return (
                            <TouchableOpacity
                                key={level.label}
                                style={[
                                    styles.levelCard,
                                    {
                                        backgroundColor: c.cardBg,
                                        borderColor: isSelected ? level.color : c.cardBorder,
                                        borderWidth: isSelected ? 2 : 1,
                                    },
                                ]}
                                onPress={() => handleManualSelect(level.label)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.levelRow}>
                                    <Text style={styles.levelEmoji}>{level.emoji}</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.levelLabel, { color: c.text }]}>{level.label}</Text>
                                        <Text style={[styles.levelRisk, { color: level.color }]}>{level.risk}</Text>
                                    </View>
                                    <View style={[styles.radioOuter, { borderColor: isSelected ? level.color : c.border }]}>
                                        {isSelected && <View style={[styles.radioInner, { backgroundColor: level.color }]} />}
                                    </View>
                                </View>
                                <Text style={[styles.levelDesc, { color: c.textSecondary }]}>{level.description}</Text>
                            </TouchableOpacity>
                        );
                    })}

                    <TouchableOpacity
                        style={[styles.acceptBtn, { backgroundColor: Colors.brand.primary, opacity: selectedManualLevel ? 1 : 0.4, marginTop: Spacing.xl }]}
                        onPress={handleConfirmManual}
                        disabled={loading || !selectedManualLevel}
                        activeOpacity={0.85}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                <Text style={styles.acceptBtnText}>
                                    {selectedManualLevel ? `Confirm ${selectedManualLevel}` : 'Select a level'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ─── SCREEN: QUIZ ───
    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => setScreen('choice')} style={{ marginRight: 8 }}>
                        <Ionicons name="arrow-back" size={24} color={c.icon} />
                    </TouchableOpacity>
                    <View style={[styles.stepBadge, { backgroundColor: Colors.brand.primary + '15' }]}>
                        <Ionicons name="school" size={22} color={Colors.brand.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.headerTitle, { color: c.text }]}>Risk Profiling</Text>
                        <Text style={[styles.headerSub, { color: c.textTertiary }]}>Question {currentQ + 1}/{QUESTIONS.length}</Text>
                    </View>
                </View>

                {/* Progress bar */}
                <View style={[styles.progressBg, { backgroundColor: c.borderLight }]}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: Colors.brand.secondary }]} />
                </View>
            </View>

            {/* Question Card */}
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.questionCard, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
                    <View style={styles.diffRow}>
                        <View style={[styles.diffChip, { backgroundColor: DIFFICULTY_COLORS[question.difficulty] + '20' }]}>
                            <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[question.difficulty] }]}>
                                {DIFFICULTY_LABELS[question.difficulty]}
                            </Text>
                        </View>
                    </View>

                    <Text style={[styles.questionText, { color: c.text }]}>{question.text}</Text>

                    {question.options.map((opt, i) => {
                        const isSelected = answers[question.id] === opt.score;
                        return (
                            <TouchableOpacity
                                key={i}
                                style={[
                                    styles.optionButton,
                                    {
                                        borderColor: isSelected ? Colors.brand.secondary : c.border,
                                        backgroundColor: isSelected ? Colors.brand.secondary + '12' : 'transparent',
                                    },
                                ]}
                                onPress={() => handleSelect(opt.score)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.radioOuter, { borderColor: isSelected ? Colors.brand.secondary : c.border }]}>
                                    {isSelected && <View style={[styles.radioInner, { backgroundColor: Colors.brand.secondary }]} />}
                                </View>
                                <Text style={[styles.optionText, { color: isSelected ? Colors.brand.secondary : c.text, fontWeight: isSelected ? '600' : '400' }]}>
                                    {opt.text}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Navigation */}
                <View style={styles.navRow}>
                    <TouchableOpacity
                        style={[styles.navBtn, { borderColor: c.border, opacity: currentQ === 0 ? 0.4 : 1 }]}
                        onPress={() => currentQ > 0 && setCurrentQ(currentQ - 1)}
                        disabled={currentQ === 0}
                    >
                        <Ionicons name="chevron-back" size={20} color={c.icon} />
                        <Text style={[styles.navBtnText, { color: c.icon }]}>Back</Text>
                    </TouchableOpacity>

                    {currentQ < QUESTIONS.length - 1 ? (
                        <TouchableOpacity
                            style={[styles.navBtn, { borderColor: c.border, opacity: !answers[question.id] ? 0.4 : 1 }]}
                            onPress={() => answers[question.id] && setCurrentQ(currentQ + 1)}
                            disabled={!answers[question.id]}
                        >
                            <Text style={[styles.navBtnText, { color: c.icon }]}>Next</Text>
                            <Ionicons name="chevron-forward" size={20} color={c.icon} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.submitBtn, { backgroundColor: Colors.brand.primary, opacity: allAnswered ? 1 : 0.5 }]}
                            onPress={finishQuiz}
                            disabled={!allAnswered}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.submitText}>See Result</Text>
                            <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: Platform.select({ ios: 60, web: 20, default: 48 }), paddingHorizontal: Spacing['2xl'], paddingBottom: Spacing.lg },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    stepBadge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: '800' },
    headerSub: { fontSize: FontSize.xs, marginTop: 2 },
    progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    content: { paddingHorizontal: Spacing['2xl'], paddingBottom: 40, flex: 1 },
    choiceContent: { paddingHorizontal: Spacing['2xl'], paddingBottom: 40 },

    // Choice screen
    choiceCard: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, alignItems: 'center' },
    choiceIconBg: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
    choiceTitle: { fontSize: FontSize.lg, fontWeight: '800', marginBottom: 6 },
    choiceDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.sm },
    choiceBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
    choiceBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },

    // Result screen
    resultCard: { borderWidth: 2, borderRadius: BorderRadius.xl, padding: Spacing['2xl'], alignItems: 'center', marginBottom: Spacing.xl },
    resultEmoji: { fontSize: 48, marginBottom: Spacing.sm },
    resultTitle: { fontSize: FontSize['2xl'], fontWeight: '800', marginBottom: 4 },
    resultRisk: { fontSize: FontSize.base, fontWeight: '600', marginBottom: Spacing.sm },
    resultDesc: { fontSize: FontSize.sm, textAlign: 'center' },
    resultQuestion: { fontSize: FontSize.base, fontWeight: '600', textAlign: 'center', marginBottom: Spacing.lg },
    acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg, paddingVertical: 16, gap: 8 },
    acceptBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
    overrideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: BorderRadius.lg, paddingVertical: 14, gap: 8, marginTop: Spacing.md },
    overrideBtnText: { fontSize: FontSize.sm, fontWeight: '600' },

    // Manual selection
    levelCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    levelEmoji: { fontSize: 32 },
    levelLabel: { fontSize: FontSize.lg, fontWeight: '800' },
    levelRisk: { fontSize: FontSize.xs, fontWeight: '600' },
    levelDesc: { fontSize: FontSize.sm, lineHeight: 20 },

    // Quiz screen
    questionCard: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.xl },
    diffRow: { marginBottom: Spacing.md },
    diffChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
    diffText: { fontSize: FontSize.xs, fontWeight: '700' },
    questionText: { fontSize: FontSize.lg, fontWeight: '700', lineHeight: 26, marginBottom: Spacing.xl },
    optionButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.sm, gap: 12 },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5 },
    optionText: { fontSize: FontSize.base, flex: 1 },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
    navBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 18, paddingVertical: 12, gap: 4 },
    navBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, paddingHorizontal: 24, paddingVertical: 12, gap: 8 },
    submitText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

    // Success screen
    successContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing['3xl'] },
    successIconCircle: { width: 100, height: 100, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
    successEmoji: { fontSize: 48 },
    successTitle: { fontSize: FontSize['2xl'], fontWeight: '800', marginBottom: 6 },
    successProfileLabel: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
    successScorePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: BorderRadius.full, marginBottom: Spacing.lg },
    successScoreText: { fontSize: FontSize.sm, fontWeight: '600' },
    successDesc: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 22, marginBottom: Spacing['3xl'] },
    successBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 16, borderRadius: BorderRadius.lg, gap: 8 },
    successBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
