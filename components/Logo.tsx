import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

interface LogoProps {
    size?: number;
    showText?: boolean;
    textColor?: string;
    fontSize?: number;
    tagline?: string;
    taglineColor?: string;
    align?: 'center' | 'left';
    stacked?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
    size = 64,
    showText = true,
    textColor,
    fontSize = 15,
    tagline,
    taglineColor,
    align = 'center',
    stacked = false
}) => {
    const theme = useColorScheme();
    const isDark = theme === 'dark';

    // Brand blue color updated per request
    const brandBlue = 'rgb(31, 70, 144)';
    const defaultColor = isDark ? '#FFFFFF' : brandBlue;
    const color = textColor || defaultColor;

    return (
        <View style={[
            styles.container,
            stacked && styles.containerStacked,
            align === 'left' && !stacked && { justifyContent: 'flex-start' }
        ]}>
            <Image
                source={require('@/assets/images/icon.png')}
                style={{
                    width: size,
                    height: size,
                }}
                resizeMode="contain"
            />
            {showText && (
                <View style={[!stacked && { marginLeft: size * 0.3 }, stacked && { marginTop: 16, alignItems: 'center' }]}>
                    <Text
                        style={[
                            styles.text,
                            {
                                color: color,
                                fontSize: fontSize,
                                textAlign: align,
                                lineHeight: fontSize * 1.5,
                            }
                        ]}
                    >
                        TIKONA CAPITAL
                    </Text>
                    {tagline && (
                        <Text style={[styles.tagline, { color: taglineColor || (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(32, 61, 111, 0.6)'), textAlign: align }]}>
                            {tagline}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    containerStacked: {
        flexDirection: 'column',
    },
    text: {
        fontWeight: '500', // Changed from 700 to 500 for a "no bold" look
        letterSpacing: 0.5, // Reduced from 2.1 for a more compact look
        fontFamily: Platform.select({
            web: 'Inter, system-ui, -apple-system, sans-serif',
            ios: 'System',
            android: 'sans-serif',
        }),
    },
    tagline: {
        fontSize: 10,
        marginTop: 1,
        letterSpacing: 0.6,
        fontWeight: '500',
    }
});
