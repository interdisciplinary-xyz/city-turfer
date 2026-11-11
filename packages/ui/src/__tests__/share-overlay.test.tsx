import { DARK, FONT_FAMILY, TIER_COLOR } from '@cityturfer/brand';
import type { ReactElement } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ShareOverlay, type ShareOverlayProps } from '../index';

function render(element: ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element);
  });
  return tree!;
}

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map((t) => t.props.children as string);

const BASE: ShareOverlayProps = {
  width: 1080,
  layout: 'top',
  photo: { uri: 'file:///photo.jpg' },
  stats: [
    { label: 'Distance', value: '5.74', unit: 'km' },
    { label: 'Moving time', value: '34:44' },
    { label: 'Avg pace', value: '6:03', unit: '/km' },
  ],
  turfLine: '+128 new turf cells',
  title: 'Evening run',
  when: '9 Nov 2026 · 17:36',
  place: 'Oliwa, Gdańsk',
  wordmark: { uri: 'wordmark.png' },
  renderTypeIcon: (size, color) => <View testID='icon' style={{ width: size, height: size, backgroundColor: color }} />,
  accessibilityLabel: 'Share card',
  testID: 'card',
};

/** Plateau and bands: absolutely placed night Views with an opacity. */
const scrimBands = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(View)
    .map((v) => flat(v.props.style))
    .filter((s) => s.backgroundColor === DARK.bg && typeof s.opacity === 'number');

describe('ShareOverlay', () => {
  it('lays a 9:16 card at the given width with every string, the photo and the wordmark', () => {
    const tree = render(<ShareOverlay {...BASE} width={360} />);
    const card = tree.root.find((n) => typeof n.type === 'string' && n.props.testID === 'card');
    expect(flat(card.props.style)).toMatchObject({ width: 360, height: 640 });
    expect(card.props.accessibilityRole).toBe('image');
    expect(texts(tree)).toEqual([
      'Distance',
      '5.74',
      'km',
      'Moving time',
      '34:44',
      'Avg pace',
      '6:03',
      '/km',
      '+128 new turf cells',
      'Evening run',
      '9 Nov 2026 · 17:36',
      'Oliwa, Gdańsk',
    ]);
    const images = tree.root.findAllByType(Image).map((i) => i.props.source.uri);
    expect(images).toEqual(['file:///photo.jpg', 'wordmark.png']);
  });

  it('scales every size by width / 1080 and draws all text in DARK.text with a shadow', () => {
    const tree = render(<ShareOverlay {...BASE} width={540} />);
    const value = tree.root.findAllByType(Text).find((t) => t.props.children === '5.74')!;
    expect(flat(value.props.style)).toMatchObject({
      fontSize: 60,
      fontFamily: FONT_FAMILY.numeric,
      color: DARK.text,
      textShadowRadius: 6,
    });
    expect(value.props.adjustsFontSizeToFit).toBe(true);
    for (const t of tree.root.findAllByType(Text)) {
      expect(flat(t.props.style).color).toBe(DARK.text);
    }
    const icon = tree.root.find((n) => n.props.testID === 'icon' && typeof n.type !== 'string');
    expect(flat(icon.props.style)).toMatchObject({ width: 28, backgroundColor: DARK.text });
  });

  it('draws a glowing turf dot only with a turf line, and a top scrim only in the top layout', () => {
    const glowing = (tree: ReactTestRenderer) =>
      tree.root.findAllByType(View).filter((v) => flat(v.props.style).backgroundColor === TIER_COLOR.glowing);
    expect(glowing(render(<ShareOverlay {...BASE} />))).toHaveLength(1);
    expect(glowing(render(<ShareOverlay {...BASE} turfLine={undefined} />))).toHaveLength(0);
    // Two scrims (plateau + 12 bands each) on top, one on bottom.
    expect(scrimBands(render(<ShareOverlay {...BASE} />))).toHaveLength(26);
    expect(scrimBands(render(<ShareOverlay {...BASE} layout='bottom' />))).toHaveLength(13);
  });

  it('fades in 0.05 steps from the 0.6 plateau', () => {
    const opacities = scrimBands(render(<ShareOverlay {...BASE} layout='bottom' />)).map((s) => s.opacity as number);
    expect(opacities[0]).toBe(0.6);
    expect(opacities.slice(1).map((o) => Math.round(o * 1000) / 1000)).toEqual([
      0.575, 0.525, 0.475, 0.425, 0.375, 0.325, 0.275, 0.225, 0.175, 0.125, 0.075, 0.025,
    ]);
  });

  it('never scales with the system font size (a fixed-size image)', () => {
    for (const t of render(<ShareOverlay {...BASE} />).root.findAllByType(Text)) {
      expect(t.props.allowFontScaling).toBe(false);
    }
  });

  it('tells when the photo has loaded or failed (ready to capture)', () => {
    const onPhotoLoad = jest.fn();
    const photo = render(<ShareOverlay {...BASE} onPhotoLoad={onPhotoLoad} />).root.findAllByType(Image)[0];
    act(() => photo.props.onLoad());
    act(() => photo.props.onError());
    expect(onPhotoLoad).toHaveBeenCalledTimes(2);
  });

  it('leaves out the place line without a place', () => {
    expect(texts(render(<ShareOverlay {...BASE} place={undefined} />))).not.toContain('Oliwa, Gdańsk');
  });
});
