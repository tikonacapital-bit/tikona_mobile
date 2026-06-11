import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PUBLIC_VAPID_KEY = 'BNFaeucr4cV7X1MsqUWfG0BvtyMvKJpprkQj_x7e33uIphcP5A69S3juDUHYHcefkImFoIfHUbpehK50XNwXktc';

export async function registerForPushNotificationsAsync(userId: string) {
    if (!Device.isDevice && Platform.OS !== 'web') {
        logger.warn('Must use physical device for Push Notifications');
        return;
    }

    let token: string | undefined;

    if (Platform.OS === 'web') {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    logger.warn('Web Push permission denied');
                    return;
                }

                const registration = await navigator.serviceWorker.register('/service-worker.js');
                await navigator.serviceWorker.ready;

                let subscription = await registration.pushManager.getSubscription();
                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
                    });
                }
                
                token = JSON.stringify(subscription);
            } catch (error) {
                logger.error('Error registering web push:', error);
                return;
            }
        } else {
            logger.warn('Push messaging is not supported in this browser');
            return;
        }
    } else {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            logger.warn('Failed to get push token for push notification!');
            return;
        }

        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        
        const expoTokenResponse = await Notifications.getExpoPushTokenAsync({
            projectId: projectId
        });
        token = expoTokenResponse.data;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }
    }

    if (token && userId) {
        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ expo_push_token: token })
                .eq('user_id', userId);
            if (updateError) {
                logger.error('Failed to update push token in supabase profiles:', updateError);
            } else {
                logger.log('Successfully saved push token in supabase profiles');
            }
        } catch (dbErr) {
            logger.error('Error updating profiles with push token:', dbErr);
        }
    }

    return token;
}
