import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global Error Boundary — catches uncaught JS errors and renders
 * a user-friendly retry screen instead of a white crash screen.
 * This prevents Google Play from seeing a "broken/blank" app.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // In production, errors are silently caught.
        // In development, log them for debugging.
        if (__DEV__) {
            console.error('ErrorBoundary caught:', error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Image
                        source={require('@/assets/images/icon.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.subtitle}>
                        The app encountered an unexpected error.{'\n'}
                        Please try again.
                    </Text>
                    <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry} activeOpacity={0.8}>
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F7F8FA',
        paddingHorizontal: 32,
    },
    logo: {
        width: 72,
        height: 72,
        marginBottom: 24,
        borderRadius: 36,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    retryButton: {
        backgroundColor: '#1F4690',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 14,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
