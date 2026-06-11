import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, Platform, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, ResponsiveScrollView } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: {
    session_id?: string;
    url?: string;
  };
  read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const theme = useColorScheme();
  const c = Colors[theme];
  const isDark = theme === 'dark';
  const { user, subscription } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notifications
  const { data: notifications, isLoading, refetch } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Poll every 15s to keep it fresh
  });

  // Mark a single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  // Delete all notifications
  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications_unread_count', user?.id] });
    },
  });

  // Delete a single notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications_unread_count', user?.id] });
    },
  });

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            deleteAllNotificationsMutation.mutate();
          },
        },
      ]
    );
  };

  const handleDeleteNotification = (id: string) => {
    Haptics.selectionAsync();
    deleteNotificationMutation.mutate(id);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    Haptics.selectionAsync();
    
    // Mark as read
    if (!item.read) {
      markAsReadMutation.mutate(item.id);
    }

    // Navigate to report if session_id is available
    const sessionId = item.data?.session_id;
    if (sessionId) {
      if (subscription?.is_active) {
        router.push(`/report/${sessionId}` as any);
      } else {
        router.push('/subscription');
      }
    }
  };

  const handleMarkAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    markAllAsReadMutation.mutate();
  };

  const hasUnread = notifications?.some(n => !n.read) ?? false;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: c.textTertiary }]}>Stay updated with recommendations</Text>
        </View>
        
        <View style={styles.headerActions}>
          {hasUnread && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              disabled={markAllAsReadMutation.isPending}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done" size={15} color={Colors.brand.secondary} />
              <Text style={styles.actionBtnText}>Mark read</Text>
            </TouchableOpacity>
          )}
          {notifications && notifications.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              disabled={deleteAllNotificationsMutation.isPending}
              style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.08)', marginLeft: Spacing.sm }]}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.brand.secondary} />
        </View>
      ) : notifications && notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.brand.secondary}
            />
          }
          renderItem={({ item }) => {
            return (
              <Card
                theme={theme}
                style={[
                  styles.card,
                  !item.read && {
                    borderColor: isDark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.15)',
                    backgroundColor: isDark ? 'rgba(37,99,235,0.05)' : 'rgba(37,99,235,0.02)',
                  }
                ]}
                onPress={() => handleNotificationPress(item)}
              >
                <View style={styles.cardContent}>
                  {/* Left Icon Status */}
                  <View style={[
                    styles.iconBg,
                    {
                      backgroundColor: item.read
                        ? (isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6')
                        : (isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)'),
                    }
                  ]}>
                    <Ionicons
                      name={item.read ? "mail-open-outline" : "mail"}
                      size={20}
                      color={item.read ? c.textTertiary : Colors.brand.secondary}
                    />
                  </View>

                  {/* Info Text */}
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.cardTitle,
                          { color: c.text, fontWeight: item.read ? '600' : '800' }
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {!item.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={[styles.cardBody, { color: c.textSecondary }]} numberOfLines={3}>
                      {item.body}
                    </Text>
                    <Text style={[styles.cardDate, { color: c.textTertiary }]}>
                      {formatDate(item.created_at)}
                    </Text>
                  </View>
                  
                  <View style={styles.rightActions}>
                    {item.data?.session_id ? (
                      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} style={{ marginBottom: Spacing.sm }} />
                    ) : null}
                    <TouchableOpacity
                      onPress={() => handleDeleteNotification(item.id)}
                      style={[styles.deleteBtn, { marginTop: item.data?.session_id ? Spacing.xs : 0 }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color={c.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      ) : (
        <ResponsiveScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.brand.secondary}
            />
          }
        >
          <EmptyState
            icon="notifications-off-outline"
            title="All caught up!"
            subtitle="You don't have any notifications right now."
            theme={theme}
          />
        </ResponsiveScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Platform.select({ ios: 56, web: 16, default: 48 }),
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  title: { fontSize: FontSize.lg, fontWeight: '800' },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.brand.secondary,
  },
  listContent: {
    padding: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    padding: Spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: FontSize.base,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand.secondary,
    marginLeft: Spacing.sm,
  },
  cardBody: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: Spacing.sm,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: BorderRadius.sm,
  },
});
