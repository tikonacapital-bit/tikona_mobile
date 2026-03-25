import React from 'react';
import { ActivityIndicator, View, Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
    source: { uri: string };
    style?: any;
    activityIndicatorColor?: string;
};

/**
 * Universal PDF Viewer component that works on iOS and Android without native binary crashes.
 * - iOS: Renders natively inside the WebView.
 * - Android: Uses the Google Docs Viewer wrapper.
 */
export default function PdfViewer({ source, style, activityIndicatorColor }: Props) {
    if (!source?.uri) return null;

    // Construct the viewer URL for Android
    const finalUri = Platform.OS === 'android'
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(source.uri)}&embedded=true`
        : source.uri;

    return (
        <View style={[styles.container, style]}>
            <WebView
                source={{ uri: finalUri }}
                style={styles.webview}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={activityIndicatorColor || '#000'} />
                    </View>
                )}
                // Standard setup for PDF interaction
                scalesPageToFit={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                useWebKit={true}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
});
