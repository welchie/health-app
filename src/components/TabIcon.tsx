import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type TabIconName = 'summary' | 'log' | 'trends' | 'settings';

type Props = {
  name: TabIconName;
  color: string;
  size?: number;
};

/**
 * Drawn here rather than pulled from an icon pack: the app already owns
 * react-native-svg for its charts, and these match the 2px stroke weight the
 * chart lines use.
 */
export default function TabIcon({ name, color, size = 24 }: Props) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Keyed by tab, so this stays 'summary' while drawing a house. */}
      {name === 'summary' && (
        <>
          <Path d="M3 11.5 L12 4 L21 11.5" {...common} />
          <Path d="M5.5 10 V20 H18.5 V10" {...common} />
          <Path d="M10 20 V14 H14 V20" {...common} />
        </>
      )}

      {name === 'log' && (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Line x1={12} y1={8} x2={12} y2={16} {...common} />
          <Line x1={8} y1={12} x2={16} y2={12} {...common} />
        </>
      )}

      {name === 'trends' && (
        <>
          <Path d="M3 20 L3 4" {...common} opacity={0.35} />
          <Path d="M3 20 L21 20" {...common} opacity={0.35} />
          <Path d="M6 16 L11 10 L14 13 L20 6" {...common} />
        </>
      )}

      {name === 'settings' && (
        <>
          <Line x1={4} y1={7} x2={20} y2={7} {...common} />
          <Line x1={4} y1={12} x2={20} y2={12} {...common} />
          <Line x1={4} y1={17} x2={20} y2={17} {...common} />
          <Circle cx={9} cy={7} r={2.4} {...common} fill={color} />
          <Circle cx={15} cy={12} r={2.4} {...common} fill={color} />
          <Circle cx={8} cy={17} r={2.4} {...common} fill={color} />
        </>
      )}
    </Svg>
  );
}
