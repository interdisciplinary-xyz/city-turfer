import { SECTION_ANCHORS } from '../home-sections/home-sections.constants';

/** The footer's section links: the header's four, labelled by `header.nav.<key>`. */
export const FOOTER_LINKS = [
  { key: 'how', href: `#${SECTION_ANCHORS.how}` },
  { key: 'app', href: `#${SECTION_ANCHORS.app}` },
  { key: 'privacy', href: `#${SECTION_ANCHORS.privacy}` },
  { key: 'faq', href: `#${SECTION_ANCHORS.faq}` },
] as const;
