/**
 * OAuth Callback Handler
 *
 * This screen acts as a fallback for OAuth redirects.
 * While WebBrowser.openAuthSessionAsync usually handles the redirect in-app,
 * this screen ensures that if the app is opened via a deep link directly,
 * the session is still correctly captured.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function AuthCallbackScreen() {
    const theme = useColorScheme();
    const url = Linking.useURL();

    useEffect(() => {
        const handleSession = async () => {
            if (url) {
                const cleanUrl = url.replace('#', '?');
                const { queryParams } = Linking.parse(cleanUrl);
                
                const access_token = queryParams?.access_token as string | undefined;
                const refresh_token = queryParams?.refresh_token as string | undefined;

                if (access_token && refresh_token) {
                    try {
                        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (error) console.error('Error setting session from URL:', error);
                    } catch (e) {
                        console.error('Exception setting session from URL:', e);
                    }
                }
            }
            
            // Short delay to ensure session is recognized
            const timeout = setTimeout(() => {
                router.replace('/');
            }, 1000);
            
            return () => clearTimeout(timeout);
        };

        handleSession();
    }, [url]);

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
