import React from 'react';
// Imported per family on purpose: the '@expo/vector-icons' barrel re-exports
// every set, and each one requires its own font, which would pull ~3.9MB of TTFs
// into the bundle instead of the 348KB this family needs.
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export type TabIconName = 'summary' | 'log' | 'trends' | 'settings';

type Props = {
  name: TabIconName;
  color: string;
  size?: number;
};

/**
 * Keyed by tab rather than by glyph, so a tab can change its icon freely.
 *
 * All four are solid glyphs on purpose. MaterialIcons ships no outlined house or
 * gear, so an all-outline bar is impossible; mixing the two weights left the
 * stroked chart looking spindly beside the filled gear.
 */
const GLYPHS: Record<TabIconName, React.ComponentProps<typeof MaterialIcons>['name']> = {
  summary: 'home',
  log: 'add-circle',
  trends: 'insert-chart',
  settings: 'settings',
};

export default function TabIcon({ name, color, size = 24 }: Props) {
  return <MaterialIcons name={GLYPHS[name]} size={size} color={color} />;
}
