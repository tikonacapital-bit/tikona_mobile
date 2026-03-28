import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function AppEntry() {
    const { isSignedIn, isLoaded: isAuthLoaded, isLoadingData, subscription } = useAuth();
    const theme = useColorScheme();

    if (!isAuthLoaded || (isSignedIn && isLoadingData)) {
        return (
            <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
                <ActivityIndicator size="large" color={Colors.brand.secondary} />
            </View>
        );
    }

    if (isSignedIn) {
        if (!subscription?.is_active) {
            return <Redirect href="/subscription" />;
        }
        return <Redirect href="/(tabs)" />;
    }

    // Always show onboarding when not signed in
    return <Redirect href="/(onboarding)" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
