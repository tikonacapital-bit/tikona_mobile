import { AlertProvider } from '@/context/AlertContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MediaPlayerProvider } from '@/context/MediaPlayerContext';
import { ThemeProvider, useColorScheme } from '@/hooks/useColorScheme';
import AudioPlayerBar from '@/components/AudioPlayerBar';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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

function RootLayoutInner() {
    const colorScheme = useColorScheme();
    const { isLoaded, isSignedIn } = useAuth();
    const segments = useSegments();

    // Global protection routing
    useEffect(() => {
        if (!isLoaded) return;

        // Hide splash screen once auth state is settled
        SplashScreen.hideAsync();

        const inAuthGroup = !segments[0] || segments[0] === '(auth)' || segments[0] === '(onboarding)' || segments[0] === 'auth' || segments[0] === 'oauth-native-callback';

        if (isSignedIn && inAuthGroup) {
            // Redirect to dashboard if logged in but trying to access an intro or auth screen
            router.replace('/(tabs)');
        } else if (!isSignedIn && !inAuthGroup && segments[0] !== undefined) {
            // Redirect to login if not logged in and trying to access protected screens
            router.replace('/(auth)/login');
        }
    }, [isSignedIn, isLoaded, segments]);

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
                        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                        <Stack.Screen name="oauth-native-callback" options={{ headerShown: false, animation: 'none' }} />
                    </Stack>
                    {/* Global persistent audio mini-player */}
                    <AudioPlayerBar />
                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                </View>
            </AlertProvider>
        </NavThemeProvider>
    );
}

export default function RootLayout() {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: 2,
                staleTime: 30000,
            },
        },
    }));

    const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

    return (
        <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <MediaPlayerProvider>
                            <RootLayoutInner />
                        </MediaPlayerProvider>
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </ClerkProvider>
    );
}
