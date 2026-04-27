import AudioPlayerBar from '@/components/AudioPlayerBar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AlertProvider } from '@/context/AlertContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MediaPlayerProvider } from '@/context/MediaPlayerContext';
import { ThemeProvider, useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import 'react-native-reanimated';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Only configure notifications in a real build (not Expo Go — SDK 53 removed push support there)
if (Constants.appOwnership !== 'expo') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,   // replaces deprecated shouldShowAlert
            shouldShowList: true,     // replaces deprecated shouldShowAlert
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

/**
 * CRITICAL FIX for Google Play "Broken Functionality" rejection:
 *
 * The splash screen must ALWAYS hide within a reasonable time.
 * If Auth fails to initialize (network issues, review environment, etc.),
 * the app was previously stuck on the splash screen forever — showing a blank
 * white screen with just the logo icon, which Google reviewers flagged.
 *
 * Solution: A hard 8-second timeout guarantees the splash hides no matter what.
 * The normal auth flow will hide it much sooner when Auth loads successfully.
 */
const SPLASH_TIMEOUT_MS = 8000;

const DISCLAIMER_KEY = 'tikona_disclaimer_accepted';

function RootLayoutInner() {
    const colorScheme = useColorScheme();
    const { isLoaded, isSignedIn, isLoadingData, subscription, user } = useAuth();
    const segments = useSegments();
    const splashHidden = useRef(false);
    const disclaimerChecked = useRef(false);

    // Safety net: force-hide splash after timeout even if Auth never loads
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!splashHidden.current) {
                splashHidden.current = true;
                SplashScreen.hideAsync().catch(() => {});
            }
        }, SPLASH_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, []);

    // Global protection routing
    useEffect(() => {
        if (!isLoaded) return;
        if (isSignedIn && isLoadingData) return;

        // Hide splash screen once auth state is settled
        if (!splashHidden.current) {
            splashHidden.current = true;
            SplashScreen.hideAsync().catch(() => {});
        }

        const inAuthGroup = !segments[0] || segments[0] === '(auth)' || segments[0] === '(onboarding)' || segments[0] === 'auth' || segments[0] === 'oauth-native-callback' || segments[0] === 'terms' || segments[0] === 'delete-account' || segments[0] === 'privacy-policy';

        if (isSignedIn && inAuthGroup && segments[0] !== 'terms' && segments[0] !== 'delete-account' && segments[0] !== 'privacy-policy') {
            // Check if user has accepted the investment disclaimer
            if (!disclaimerChecked.current) {
                disclaimerChecked.current = true;
                AsyncStorage.getItem(DISCLAIMER_KEY).then((val) => {
                    if (!val) {
                        router.replace('/investment-disclaimer');
                    } else {
                        router.replace('/(tabs)');
                        // Only nudge brand new users (created within the last 5 minutes)
                        const isNewUser = user?.createdAt ? (Date.now() - new Date(user.createdAt).getTime() < 5 * 60 * 1000) : false;
                        if (isNewUser && !isLoadingData && !subscription?.is_active) {
                            setTimeout(() => router.push('/subscription'), 100);
                        }
                    }
                }).catch(() => {
                    router.replace('/(tabs)');
                });
            } else {
                router.replace('/(tabs)');
                const isNewUser = user?.createdAt ? (Date.now() - new Date(user.createdAt).getTime() < 5 * 60 * 1000) : false;
                if (isNewUser && !isLoadingData && !subscription?.is_active) {
                    setTimeout(() => router.push('/subscription'), 100);
                }
            }
        } else if (!isSignedIn && !inAuthGroup && segments[0] !== undefined) {
            // Redirect to login if not logged in and trying to access protected screens
            disclaimerChecked.current = false; // Reset on sign out
            router.replace('/(auth)/login');
        }
    }, [isSignedIn, isLoaded, segments, isLoadingData, subscription, user]);

    return (
        <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AlertProvider>
                <View style={{ flex: 1 }}>
                    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(kyc)" options={{ headerShown: false }} />
                        <Stack.Screen name="(profiling)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="report/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
                        <Stack.Screen name="stock/[symbol]" options={{ headerShown: false }} />
                        <Stack.Screen name="subscription/index" options={{ headerShown: false, presentation: 'modal' }} />
                        <Stack.Screen name="support" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
                        <Stack.Screen name="terms" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
                        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                        <Stack.Screen name="oauth-native-callback" options={{ headerShown: false, animation: 'none' }} />
                        <Stack.Screen name="delete-account" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
                        <Stack.Screen name="privacy-policy" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
                        <Stack.Screen name="investment-disclaimer" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
                    </Stack>
                    {/* Global persistent audio mini-player */}
                    <AudioPlayerBar />
                    {/* PWA install banner — web only, auto-hides after user acts */}
                    <PWAInstallPrompt />
                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                </View>
            </AlertProvider>
        </NavThemeProvider>
    );
}

export default function RootLayout() {
    const [fontsLoaded, error] = useFonts({
        ...Ionicons.font,
    });

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: 2,
                staleTime: 30000,
            },
        },
    }));

    // Optionally show a loading screen while fonts are loading
    // but Expo Router static rendering works best if we don't return null
    useEffect(() => {
        if (error) throw error;
    }, [error]);

    return (
        <ErrorBoundary>
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    <ThemeProvider>
                        <AuthProvider>
                            <MediaPlayerProvider>
                                <RootLayoutInner />
                            </MediaPlayerProvider>
                        </AuthProvider>
                    </ThemeProvider>
                </QueryClientProvider>
            </SafeAreaProvider>
        </ErrorBoundary>
    );
}
