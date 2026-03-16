import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export async function registerForPushNotificationsAsync(userId: string) {
    if (!Device.isDevice) {
        console.warn('Must use physical device for Push Notifications');
        return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    
    const token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId
    })).data;

    if (token) {
        // Save to Supabase
        const { error } = await supabase
            .from('profiles')
            .update({ expo_push_token: token })
            .eq('user_id', userId);
        
        if (error) {
            console.error('Error saving push token:', error);
        }
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return token;
}
