import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

export type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
};
