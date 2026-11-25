import { SECTION_ANCHORS } from '@/domains/homepage/logic';

/** The footer's section links: the header's six, labelled by `header.nav.<key>`. */
export const FOOTER_LINKS = [
  { key: 'how', href: `#${SECTION_ANCHORS.how}` },
  { key: 'app', href: `#${SECTION_ANCHORS.app}` },
  { key: 'who', href: `#${SECTION_ANCHORS.who}` },
  { key: 'privacy', href: `#${SECTION_ANCHORS.privacy}` },
  { key: 'faq', href: `#${SECTION_ANCHORS.faq}` },
  { key: 'join', href: `#${SECTION_ANCHORS.join}` },
] as const;
