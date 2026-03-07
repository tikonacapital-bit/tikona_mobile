/**
 * OAuth Callback Handler
 *
 * With Clerk, OAuth callbacks are handled automatically by
 * WebBrowser.maybeCompleteAuthSession() in the login/register screens.
 * This screen acts as a simple fallback redirect.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function AuthCallbackScreen() {
    const theme = useColorScheme();

    useEffect(() => {
        // Clerk handles the OAuth session automatically.
        // Just redirect to the root which will check auth state.
        const timeout = setTimeout(() => {
            router.replace('/');
        }, 500);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
            <ActivityIndicator size="large" color={Colors.brand.secondary} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
