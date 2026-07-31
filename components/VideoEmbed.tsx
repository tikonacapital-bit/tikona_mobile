import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
    uri: string;
    style?: any;
};

/**
 * Renders external video embeds (Google Drive preview, YouTube embed) that are
 * HTML pages, not raw video streams — expo-av's <Video> can't play these.
 */
export default function VideoEmbed({ uri, style }: Props) {
    return (
        <WebView
            source={{ uri }}
            style={[styles.webview, style]}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
        />
    );
}

const styles = StyleSheet.create({
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
});
