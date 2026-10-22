import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';

export type SessionGateProps = { locale: Locale; path: string; children: ReactNode };
