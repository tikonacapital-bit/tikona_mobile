import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AppEntry() {
    const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
    const theme = useColorScheme();

    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const value = await AsyncStorage.getItem('has_seen_onboarding');
                setHasSeenOnboarding(value === 'true');
            } catch (e) {
                setHasSeenOnboarding(false);
            }
        };
        checkOnboarding();
    }, []);

    if (!isAuthLoaded || hasSeenOnboarding === null) {
        return (
            <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
                <ActivityIndicator size="large" color={Colors.brand.secondary} />
            </View>
        );
    }

    if (isSignedIn) {
        return <Redirect href="/(tabs)" />;
    }

    if (!hasSeenOnboarding) {
        return <Redirect href="/(onboarding)" />;
    }

    return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
