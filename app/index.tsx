import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function AppEntry() {
    const { isSignedIn, isLoaded, kyc, profile } = useAuth();
    const theme = useColorScheme();

    if (!isLoaded) {
        return (
            <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
                <ActivityIndicator size="large" color={Colors.brand.secondary} />
            </View>
        );
    }

    // Not logged in → auth
    if (!isSignedIn) {
        return <Redirect href="/(onboarding)" />;
    }

    // Logged in → go directly to main dashboard
    return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
