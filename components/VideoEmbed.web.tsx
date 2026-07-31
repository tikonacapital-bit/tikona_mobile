import React from 'react';

type Props = {
    uri: string;
    style?: any;
};

/**
 * Web build of VideoEmbed — react-native-webview has no web target, so this
 * renders a plain iframe instead (same trick used for PDF embeds).
 */
export default function VideoEmbed({ uri, style }: Props) {
    return (
        <iframe
            src={uri}
            style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#000', ...style }}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            title="Video"
        />
    );
}
