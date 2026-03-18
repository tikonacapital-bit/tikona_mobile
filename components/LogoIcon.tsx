import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

interface LogoIconProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
}

export const LogoIcon: React.FC<LogoIconProps> = ({
    size = 45,
    color = '#203D6F',
    strokeWidth = 3,
}) => {
    // Exact geometry for equilateral triangle + circle
    // To fill the viewbox (0,0 100,100), the triangle side should be around 85 units
    // Center is (50, 50)
    
    // Equilateral Triangle: side ~85, height ~73.6
    // Top point: (50, 13.2)
    // Bottom right: (86.8, 76.8)
    // Bottom left: (13.2, 76.8)
    
    // Circle radius should intersect or be centered
    // In Tikona logo, the circle passes through or near the triangle centers
    const trianglePoints = "50,13.2 86.8,76.8 13.2,76.8";
    const circleRadius = 30;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg 
                width={size} 
                height={size} 
                viewBox="0 0 100 100"
            >
                <G>
                    {/* The Triangle */}
                    <Path
                        d={`M 50,13.2 L 86.8,76.8 L 13.2,76.8 Z`}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    {/* The Circle - centered on the triangle's visual center */}
                    <Circle
                        cx="50"
                        cy="55.6" // Shifted down to be visually centered in the triangle
                        r={circleRadius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                    />
                </G>
            </Svg>
        </View>
    );
};
