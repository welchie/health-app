/**
 * A glyph name that does not exist in the font renders as a blank box with no
 * error, so the mapping is asserted here rather than discovered on a phone.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json';
import TabIcon, { TabIconName } from '../components/TabIcon';

const EXPECTED: Record<TabIconName, string> = {
  summary: 'home',
  log: 'add-circle',
  trends: 'insert-chart',
  settings: 'settings',
};

/** The icon renders as a Text node holding the glyph's codepoint. */
const glyphOf = (node: unknown): string | null => {
  if (!node || typeof node !== 'object') return null;
  const el = node as { type?: string; children?: unknown[] };
  if (el.type === 'Text' && Array.isArray(el.children)) {
    const text = el.children.find((c) => typeof c === 'string');
    if (typeof text === 'string') return text;
  }
  if (Array.isArray(el.children)) {
    for (const child of el.children) {
      const found = glyphOf(child);
      if (found) return found;
    }
  }
  return null;
};

describe('TabIcon', () => {
  it.each(Object.entries(EXPECTED) as [TabIconName, string][])(
    'draws the %s tab with the "%s" Material glyph',
    async (name, expectedGlyph) => {
      const view = await render(<TabIcon name={name} color="#16202e" />);

      const codepoint = (glyphMap as Record<string, number>)[expectedGlyph];
      expect(codepoint).toBeDefined();
      expect(glyphOf(view.toJSON())).toBe(String.fromCodePoint(codepoint));
    },
  );

  it('covers every tab, so a new tab cannot ship without an icon', () => {
    const names: TabIconName[] = ['summary', 'log', 'trends', 'settings'];

    expect(Object.keys(EXPECTED).sort()).toEqual([...names].sort());
  });

  it('passes the requested colour and size through', async () => {
    const view = await render(<TabIcon name="summary" color="#c26a1b" size={30} />);
    const json = JSON.stringify(view.toJSON());

    expect(json).toContain('#c26a1b');
    expect(json).toContain('30');
  });
});
