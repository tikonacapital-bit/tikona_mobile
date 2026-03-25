import React from 'react';
import { View } from 'react-native';

type Props = {
    source: any;
    style?: any;
    activityIndicatorColor?: string;
};

export default function PdfViewer({ source, style, activityIndicatorColor }: Props) {
    // No-op component for web builds to satisfy Metro bundler
    // ReportDetailScreen.tsx already renders an iframe directly when Platform.OS === 'web'
    return <View style={style} />;
}
