import enforceTailwindArbitrary from './enforce-tailwind-arbitrary.js';
import enforceTypesInConstants from './enforce-types-in-constants.js';
import noDeepDomainImport from './no-deep-domain-import.js';
import noDuplicateImports from './no-duplicate-imports.js';
import noRawText from './no-raw-text.js';

export default {
  'enforce-tailwind-arbitrary': enforceTailwindArbitrary,
  'enforce-types-in-constants': enforceTypesInConstants,
  'no-deep-domain-import': noDeepDomainImport,
  'no-duplicate-imports': noDuplicateImports,
  'no-raw-text': noRawText,
};
