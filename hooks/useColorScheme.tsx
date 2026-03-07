import React, { createContext, useContext, useState } from 'react';
import { useColorScheme as _useColorScheme } from 'react-native';
import type { ThemeMode } from '@/constants/theme';

type ThemeOverride = 'system' | 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeMode;
    themeOverride: ThemeOverride;
    setThemeOverride: (v: ThemeOverride) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'light',
    themeOverride: 'system',
    setThemeOverride: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemTheme = _useColorScheme() ?? 'light';
    const [themeOverride, setThemeOverride] = useState<ThemeOverride>('system');

    const theme: ThemeMode = themeOverride === 'system' ? systemTheme : themeOverride;

    return (
        <ThemeContext.Provider value={{ theme, themeOverride, setThemeOverride }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useColorScheme(): ThemeMode {
    return useContext(ThemeContext).theme;
}

export function useThemeSettings() {
    return useContext(ThemeContext);
}
