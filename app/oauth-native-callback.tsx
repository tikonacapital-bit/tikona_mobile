import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function OAuthNativeCallback() {
    const theme = useColorScheme();

    useEffect(() => {
        const timeout = setTimeout(() => {
            router.replace('/');
        }, 100);
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
