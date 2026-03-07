import { Platform, useWindowDimensions } from 'react-native';

const BREAKPOINTS = {
    tablet: 768,
    desktop: 1024,
} as const;

const CONTENT_MAX_WIDTH = 960;
const NARROW_MAX_WIDTH = 480;

export function useResponsiveLayout() {
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isTablet = width >= BREAKPOINTS.tablet;
    const isDesktop = width >= BREAKPOINTS.desktop;
    const isWideWeb = isWeb && isTablet;

    return {
        isWeb,
        isTablet,
        isDesktop,
        isWideWeb,
        screenWidth: width,
        contentMaxWidth: CONTENT_MAX_WIDTH,
        narrowMaxWidth: NARROW_MAX_WIDTH,
        /** Number of columns for grid layouts like reports */
        gridColumns: isDesktop ? 3 : isTablet ? 2 : 2,
    };
}
