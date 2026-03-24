import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

export default function AppLoader() {
    const theme = useColorScheme();
    const c = Colors[theme];
    const spin = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, [spin]);

    const rotate = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            <Animated.Image
                source={require('@/assets/images/react-logo.png')}
                style={[styles.logo, { transform: [{ rotate }] }]}
                resizeMode="contain"
            />
            <Text style={[styles.text, { color: c.textSecondary }]}>Loading...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 20,
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
