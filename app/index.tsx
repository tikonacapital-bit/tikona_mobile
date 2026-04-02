import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Timeout (ms) after which we stop waiting for auth and show onboarding.
 * This prevents Google Play reviewers from seeing an infinite spinner
 * if Clerk fails to initialize.
 */
const AUTH_TIMEOUT_MS = 10000;

export default function AppEntry() {
    const { isSignedIn, isLoaded: isAuthLoaded, isLoadingData } = useAuth();
    const theme = useColorScheme();
    const [timedOut, setTimedOut] = useState(false);

    // Safety net: if auth loading takes too long, give up waiting
    useEffect(() => {
        const timer = setTimeout(() => {
            setTimedOut(true);
        }, AUTH_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, []);

    // Still waiting for auth, but haven't timed out yet
    if ((!isAuthLoaded || (isSignedIn && isLoadingData)) && !timedOut) {
        return (
            <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
                <ActivityIndicator size="large" color={Colors.brand.secondary} />
            </View>
        );
    }

    if (isSignedIn && isAuthLoaded) {
        return <Redirect href="/(tabs)" />;
    }

    // Not signed in OR timed out — show onboarding
    return <Redirect href="/(onboarding)" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
