import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Pdf from 'react-native-pdf';

type Props = {
    source: any;
    style?: any;
    activityIndicatorColor?: string;
};

export default function PdfViewer({ source, style, activityIndicatorColor }: Props) {
    return (
        <Pdf
            trustAllCerts={false}
            source={source}
            style={style}
            renderActivityIndicator={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                    <ActivityIndicator size="large" color={activityIndicatorColor || '#000'} />
                </View>
            )}
        />
    );
}
