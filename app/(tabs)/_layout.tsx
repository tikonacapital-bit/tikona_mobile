import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Logo } from '@/components/Logo';

const TAB_ITEMS = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconFocused: 'home' },
  { name: 'reports', title: 'Reports', icon: 'document-text-outline', iconFocused: 'document-text' },
  { name: 'analyst', title: 'Analyst', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles' },
  { name: 'portfolio', title: 'Portfolio', icon: 'pie-chart-outline', iconFocused: 'pie-chart' },
  { name: 'settings', title: 'Account', icon: 'person-outline', iconFocused: 'person' },
] as const;

const SIDEBAR_EXPANDED = 280;
const SIDEBAR_COLLAPSED = 68;

function WebSidebar({ state, navigation }: BottomTabBarProps) {
  const theme = useColorScheme();
  const c = Colors[theme];
  const isDark = theme === 'dark';
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [toggleHovered, setToggleHovered] = useState(false);

  const toggleSidebar = () => setIsExpanded(prev => !prev);
  const sidebarWidth = isExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: isDark ? '#0F1318' : '#FAFBFC',
          borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
          width: sidebarWidth,
          transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        } as any,
      ]}
    >
      {/* ═══ Top Row: Logo + Toggle ═══ */}
      <View style={[styles.topRow, !isExpanded && styles.topRowCollapsed]}>
        <View style={styles.logoRow}>
          {isExpanded ? (
            <Logo 
              size={34} 
              fontSize={15} 
              align="left" 
              tagline="Equity Research"
            />
          ) : (
            <Logo size={34} showText={false} />
          )}
        </View>

        {/* Toggle Button — clean icon button */}
        <TouchableOpacity
          onPress={toggleSidebar}
          style={[
            styles.toggleBtn,
            {
              backgroundColor: toggleHovered
                ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')
                : 'transparent',
            },
            Platform.OS === 'web' && ({
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            } as any),
          ]}
          activeOpacity={0.7}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setToggleHovered(true),
            onMouseLeave: () => setToggleHovered(false),
          } : {})}
        >
          <Ionicons
            name={isExpanded ? 'menu-outline' : 'menu-outline'}
            size={20}
            color={toggleHovered ? c.text : c.textSecondary}
            style={Platform.OS === 'web' ? { transition: 'color 0.2s ease' } as any : {}}
          />
        </TouchableOpacity>
      </View>

      {/* ═══ Separator ═══ */}
      <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

      {/* ═══ Navigation Items ═══ */}
      <View style={styles.navSection}>
        {state.routes.map((route, index) => {
          const tabItem = TAB_ITEMS.find(t => t.name === route.name);
          if (!tabItem) return null;

          const isFocused = state.index === index;
          const isHovered = hoveredIdx === index;
          const iconName = isFocused ? tabItem.iconFocused : tabItem.icon;
          const activeColor = Colors.brand.secondary;

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={[
                styles.navItem,
                !isExpanded && styles.navItemCollapsed,
                {
                  backgroundColor: isFocused
                    ? (isDark ? 'rgba(37,99,235,0.14)' : 'rgba(37,99,235,0.08)')
                    : isHovered
                      ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')
                      : 'transparent',
                  borderLeftColor: isFocused ? activeColor : 'transparent',
                },
                Platform.OS === 'web' && ({
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                } as any),
              ]}
              activeOpacity={0.7}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredIdx(index),
                onMouseLeave: () => setHoveredIdx(null),
              } : {})}
            >
              <View style={styles.navIconWrap}>
                <Ionicons
                  name={iconName as any}
                  size={20}
                  color={isFocused ? activeColor : isHovered ? c.text : c.textSecondary}
                  style={Platform.OS === 'web' ? { transition: 'color 0.15s ease' } as any : {}}
                />
              </View>
              {isExpanded && (
                <Text
                  style={[
                    styles.navLabel,
                    {
                      color: isFocused ? activeColor : isHovered ? c.text : c.textSecondary,
                      fontWeight: isFocused ? '700' : '500',
                    },
                    Platform.OS === 'web' && ({ transition: 'color 0.15s ease' } as any),
                  ]}
                  numberOfLines={1}
                >
                  {tabItem.title}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ═══ Footer ═══ */}
      <View style={styles.footer}>
        <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
        {isExpanded ? (
          <View style={styles.footerContent}>
            <Logo size={18} fontSize={10} />
          </View>
        ) : (
          <Text style={[styles.footerCopy, { color: c.textTertiary }]}>©</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── Sidebar Container ── */
  sidebar: {
    borderRightWidth: 1,
    paddingTop: 16,
    justifyContent: 'flex-start',
    overflow: 'hidden' as any,
  },

  /* ── Top Row: Logo + Brand + Toggle ── */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  topRowCollapsed: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  brandSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* ── Toggle Button ── */
  toggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Separator ── */
  separator: {
    height: 1,
    marginHorizontal: 12,
  },

  /* ── Nav Items ── */
  navSection: {
    paddingTop: 10,
    paddingHorizontal: 8,
    flex: 1,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    borderLeftWidth: 3,
  },
  navIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 13,
    flexShrink: 1,
    letterSpacing: -0.1,
  },

  /* ── Footer ── */
  footer: {
    paddingBottom: 16,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  footerLogo: {
    width: 16,
    height: 16,
    borderRadius: 4,
    opacity: 0.5,
  },
  footerText: {
    fontSize: 9,
    letterSpacing: 0.2,
  },
  footerCopy: {
    fontSize: 10,
    textAlign: 'center',
    paddingTop: 12,
  },
});

export default function TabLayout() {
  const theme = useColorScheme();
  const c = Colors[theme];
  const { isWideWeb } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={isWideWeb ? (props) => <WebSidebar {...props} /> : undefined}
      screenOptions={{
        tabBarActiveTintColor: c.tabIconSelected,
        tabBarInactiveTintColor: c.textSecondary,
        headerShown: false,
        ...(isWideWeb
          ? {
            tabBarPosition: 'left' as any,
          }
          : {
            tabBarStyle: {
              backgroundColor: c.tabBarBg,
              borderTopColor: c.tabBarBorder,
              borderTopWidth: 1,
              ...Platform.select({
                ios: {
                  height: 60 + Math.max(insets.bottom, 20),
                  paddingBottom: Math.max(insets.bottom, 20),
                  paddingTop: 8,
                },
                default: {
                  minHeight: 60 + insets.bottom,
                  paddingBottom: Math.max(insets.bottom, 12),
                  paddingTop: 8,
                }
              })
            },
            tabBarItemStyle: {
              justifyContent: 'center',
              paddingVertical: 4,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600' as const,
            },
          }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'document-text' : 'document-text-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analyst"
        options={{
          title: 'Analyst',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'pie-chart' : 'pie-chart-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'person' : 'person-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
