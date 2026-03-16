import { useColorScheme } from '@/hooks/useColorScheme';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

interface LogoProps {
    size?: number;
    showText?: boolean;
    textColor?: string;
    fontSize?: number;
    tagline?: string;
    taglineColor?: string;
    align?: 'center' | 'left';
}

export const Logo: React.FC<LogoProps> = ({
    size = 40,
    showText = true,
    textColor,
    fontSize = 15, // Updated to 15px per latest request
    tagline,
    taglineColor,
    align = 'center'
}) => {
    const theme = useColorScheme();
    const isDark = theme === 'dark';
    
    // Brand blue color from website
    const brandBlue = '#203D6F';
    const defaultColor = isDark ? '#FFFFFF' : brandBlue;
    const color = textColor || defaultColor;

    return (
        <View style={[styles.container, align === 'left' && { justifyContent: 'flex-start' }]}>
            <Image
                source={require('@/assets/images/icon.png')}
                style={{
                    width: size,
                    height: size,
                }}
                resizeMode="contain"
            />
            {showText && (
                <View style={{ marginLeft: size * 0.35 }}>
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
    text: {
        fontWeight: '700',
        letterSpacing: 2.1,
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
