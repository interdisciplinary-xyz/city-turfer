/**
 * ESLint rule: no-raw-text
 *
 * User-facing text must come from the message catalogue (a `t()` call), not a literal in the
 * component. Opt-in: no preset enables it; an app turns it on once its copy is translatable.
 *
 * Flags, when the text holds at least one letter (any script, `\p{L}`):
 *   - JSX text (`<Text>Start</Text>`) and a string or template literal as a JSX child
 *     (`<Text>{'Start'}</Text>`);
 *   - a string or template literal (template: a letter in its fixed parts) given to a user-facing
 *     prop (`title`, `label`, `placeholder`, `accessibilityLabel`, … — option `props`), also as a
 *     branch of `?:`, `||`, `??` or the right side of `&&`;
 *   - the same literals as the first or second argument of `Alert.alert(…)`, and the `text` of
 *     its buttons (third argument).
 *
 * Text without a letter (`·`, `/`, `12`, `—`) passes, so separators and numbers need no message.
 * Exempt a file or folder (dev-only screens, tests) in the consumer's config, not inline.
 */

const LETTER = /\p{L}/u;

export const DEFAULT_PROPS = [
  'title',
  'label',
  'placeholder',
  'accessibilityLabel',
  'accessibilityHint',
  'headerTitle',
  'headerBackTitle',
  'tabBarLabel',
];

/** The literal text of a node that a user would read, or null when it is not a literal. */
function literalText(node) {
  if (!node) {
    return null;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join(' ');
  }
  return null;
}

/** Literal branches of an expression: itself, both arms of `?:`, the sides of `||`, `??`, `&&`. */
function literalBranches(node) {
  if (!node) {
    return [];
  }
  if (node.type === 'ConditionalExpression') {
    return [...literalBranches(node.consequent), ...literalBranches(node.alternate)];
  }
  if (node.type === 'LogicalExpression') {
    // `a && 'x'` renders only its right side; `a || 'x'` and `a ?? 'x'` either side.
    const left = node.operator === '&&' ? [] : literalBranches(node.left);
    return [...left, ...literalBranches(node.right)];
  }
  return literalText(node) === null ? [] : [node];
}

const preview = (text) => {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 40 ? `${t.slice(0, 39)}…` : t;
};

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hard-coded user-facing text in JSX, user-facing props and Alert.alert',
    },
    messages: {
      rawText: 'Hard-coded user-facing text "{{text}}": move it to the message catalogue and render it with t().',
    },
    schema: [
      {
        type: 'object',
        properties: { props: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const props = new Set(context.options[0]?.props ?? DEFAULT_PROPS);

    function check(node, text) {
      if (text !== null && LETTER.test(text)) {
        context.report({ node, messageId: 'rawText', data: { text: preview(text) } });
      }
    }
    const checkBranches = (expression) => {
      for (const n of literalBranches(expression)) {
        check(n, literalText(n));
      }
    };

    return {
      JSXText(node) {
        check(node, node.value);
      },

      JSXExpressionContainer(node) {
        const parent = node.parent;
        if (parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment')) {
          checkBranches(node.expression);
        }
      },

      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!name || !props.has(name) || !node.value) {
          return;
        }
        if (node.value.type === 'Literal') {
          check(node.value, literalText(node.value));
        } else if (node.value.type === 'JSXExpressionContainer') {
          checkBranches(node.value.expression);
        }
      },

      CallExpression(node) {
        const callee = node.callee;
        const isAlert =
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Alert' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'alert';
        if (!isAlert) {
          return;
        }
        const [title, message, buttons] = node.arguments;
        checkBranches(title);
        checkBranches(message);
        if (buttons?.type === 'ArrayExpression') {
          for (const button of buttons.elements) {
            if (button?.type !== 'ObjectExpression') {
              continue;
            }
            for (const p of button.properties) {
              if (p.type === 'Property' && !p.computed && p.key.type === 'Identifier' && p.key.name === 'text') {
                checkBranches(p.value);
              }
            }
          }
        }
      },
    };
  },
};
