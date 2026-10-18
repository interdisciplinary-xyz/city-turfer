/**
 * ESLint rule: enforce-tailwind-arbitrary
 *
 * Warns when Tailwind shorthand scale classes are used instead of explicit
 * arbitrary pixel values (e.g. `px-6` should be `px-[24px]`).
 */

// Tailwind spacing scale → pixel values (scale × 4)
const SPACING_TO_PX = {
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px',
};

const RADIUS_TO_PX = {
  sm: '2px',
  DEFAULT: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
};

const FONT_SIZE_TO_PX = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
  '5xl': '48px',
  '6xl': '60px',
  '7xl': '72px',
  '8xl': '96px',
  '9xl': '128px',
};

// Spacing utility prefixes (includes negative variants)
const SPACING_PREFIXES = [
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'ms',
  'me',
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'inset-x',
  'inset-y',
  'w',
  'h',
  'size',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'basis',
  'scroll-m',
  'scroll-mx',
  'scroll-my',
  'scroll-mt',
  'scroll-mb',
  'scroll-ml',
  'scroll-mr',
  'scroll-p',
  'scroll-px',
  'scroll-py',
  'scroll-pt',
  'scroll-pb',
  'scroll-pl',
  'scroll-pr',
];

// Build regex for spacing: matches "prefix-value" but NOT "prefix-0" or keyword values
// Handles optional responsive/state prefixes like "md:", "hover:", "group-hover:", "-"
const spacingPrefixGroup = SPACING_PREFIXES.map((p) => p.replace('-', '\\-')).join('|');
const SPACING_RE = new RegExp(
  '(?:^|\\s)' +
    '(-?)' + // optional negative
    '(?:[a-z][a-z0-9-]*:)*' + // optional variant prefixes (md:, hover:, etc.)
    '(-?)' + // optional negative after variant
    '(' +
    spacingPrefixGroup +
    ')' +
    '-(\\d+(?:\\.\\d+)?)' +
    '(?=\\s|$)',
  'g'
);

// Radius shorthand pattern
const RADIUS_RE = /(?:^|\s)(?:[a-z][a-z0-9-]*:)*rounded-(sm|md|lg|xl|2xl|3xl)(?=\s|$)/g;

// Font size shorthand pattern
const FONT_SIZE_RE = /(?:^|\s)(?:[a-z][a-z0-9-]*:)*text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?=\s|$)/g;

/**
 * Find all violations in a className string.
 * Returns array of { match, fix, index } objects.
 */
function findViolations(value) {
  const violations = [];

  // Spacing
  let m;
  SPACING_RE.lastIndex = 0;
  while ((m = SPACING_RE.exec(value)) !== null) {
    const fullMatch = m[0].trimStart();
    const scale = m[4];

    // Skip zero values
    if (scale === '0') {
      continue;
    }

    const px = SPACING_TO_PX[scale];
    if (!px) {
      continue;
    }

    // Reconstruct the fix: preserve variant prefixes and negation
    const fix = fullMatch.replace(new RegExp('(' + spacingPrefixGroup + ')-(\\d+(?:\\.\\d+)?)$'), '$1-[' + px + ']');

    violations.push({ match: fullMatch, fix });
  }

  // Radius
  RADIUS_RE.lastIndex = 0;
  while ((m = RADIUS_RE.exec(value)) !== null) {
    const fullMatch = m[0].trimStart();
    const variant = m[1];
    const px = RADIUS_TO_PX[variant];
    if (!px) {
      continue;
    }

    const fix = fullMatch.replace(/rounded-(sm|md|lg|xl|2xl|3xl)$/, 'rounded-[' + px + ']');
    violations.push({ match: fullMatch, fix });
  }

  // Font size
  FONT_SIZE_RE.lastIndex = 0;
  while ((m = FONT_SIZE_RE.exec(value)) !== null) {
    const fullMatch = m[0].trimStart();
    const variant = m[1];
    const px = FONT_SIZE_TO_PX[variant];
    if (!px) {
      continue;
    }

    const fix = fullMatch.replace(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, 'text-[' + px + ']');
    violations.push({ match: fullMatch, fix });
  }

  return violations;
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce Tailwind arbitrary pixel values instead of shorthand scale classes',
    },
    fixable: 'code',
    messages: {
      useArbitrary: 'Use arbitrary value `{{fix}}` instead of shorthand `{{original}}`.',
    },
    schema: [],
  },

  create(context) {
    function checkStringValue(node, raw) {
      if (typeof raw !== 'string') {
        return;
      }

      const violations = findViolations(raw);
      for (const { match, fix } of violations) {
        context.report({
          node,
          messageId: 'useArbitrary',
          data: { original: match, fix },
        });
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== 'className') {
          return;
        }

        // className='...'
        if (node.value && node.value.type === 'Literal') {
          checkStringValue(node.value, node.value.value);
        }

        // className={`...`}
        if (
          node.value &&
          node.value.type === 'JSXExpressionContainer' &&
          node.value.expression.type === 'TemplateLiteral'
        ) {
          for (const quasi of node.value.expression.quasis) {
            checkStringValue(quasi, quasi.value.raw);
          }
        }
      },

      // Also check parseCssClasses('...') calls
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'parseCssClasses') {
          for (const arg of node.arguments) {
            if (arg.type === 'Literal' && typeof arg.value === 'string') {
              checkStringValue(arg, arg.value);
            }
            if (arg.type === 'TemplateLiteral') {
              for (const quasi of arg.quasis) {
                checkStringValue(quasi, quasi.value.raw);
              }
            }
          }
        }
      },
    };
  },
};
