---
name: mobile-i18n
description: >-
  The app in English and Polish: where strings live, keys, useT and translator(), ICU plurals
  (Polish one/few/many/other), number formats, the Polish glossary, what stays untranslated,
  audit:i18n. Use to add a string, translate, write Polish copy, fix a plural or add a language.
---

# Mobile app languages

Decisions L1–L12: `docs/decisions/mobile-i18n-2026-10-23.md`. **In progress:** the foundation
(`apps/mobile/src/i18n/`, step 1) and the `common` namespace exist; the screens move to the
catalogue in step 2, so most copy is still inline English.

## Where strings live

- `apps/mobile/messages/<locale>/<namespace>.json`, locales `en` (source and fallback) and `pl`. One
  namespace per area: `common`, `record`, `turf`, `history`, `stats`, `achievements`, `account`,
  `backup`, `health`, `info`, `signIn`, `errors`. A new area gets a new file in **every** locale.
- Keys are camelCase, named for meaning, not wording (`startButton`, `discardTitle`), nested at most
  one level for a group (`gpsState.lost`). No `.` inside a key. Add a key in `en` and `pl` in the
  same change; never leave a locale for later (audit:i18n fails).
- Same ICU syntax as the website (`apps/web/messages/en.json`, `pl.json`), so copy can move.
- Copy in `*.constants.ts` (`TYPE_LABEL`, …) moves to the catalogue; constants keep ids and keys,
  not words. `@cityturfer/brand` copy stays English for the website's branding page and Storybook.

## Using them

```tsx
const t = useT('record'); // apps/mobile/src/i18n, in components
<Text>{t('startButton', { type })}</Text>;

const t = translator('record'); // outside React: Alert text built in handlers, the notification
Alert.alert(t('discardTitle'), t('discardBody'), [{ text: t('cancel'), style: 'cancel' }]);
```

`useT` re-renders on a language change; `translator()` reads the language at call time, so call it
when the text is built, never at module top level. Both come from `@/i18n` (also `useLocale()`,
`useLanguageSetting()`, `loadLanguageSetting()`: await it before building text in a headless launch,
where no provider has read the saved setting). The `I18nProvider` wraps the root layout; the root
layout keeps its launch spinner until the saved setting is read (`ready`). Keys are typed from the
English JSON: a new namespace is one import per locale in `apps/mobile/src/i18n/catalogue.ts`.

## Writing messages

- **Plurals** in ICU, never `n === 1 ? … : …`. English needs `one` and `other`; Polish needs all of
  `one`, `few`, `many`, `other` (`other` is fractions: "2,5 km"). audit:i18n checks both.

  ```json
  "en": "{count, plural, one {# activity} other {# activities}}"
  "pl": "{count, plural, one {# aktywność} few {# aktywności} many {# aktywności} other {# aktywności}}"
  ```

- **Whole messages:** never splice translated fragments (`TYPE_LABEL[type].toLowerCase()`, `'Start '
  - label`). Polish inflects: pass the id and branch inside the message: `{type, select, walk
    {Zacznij spacer} run {Zacznij bieg} cycle {Zacznij jazdę} other {Zacznij}}`. Select options must
    match across locales.
- **Placeholders** are the same names in every locale; numbers arrive already formatted.
- **Apostrophes:** a single `'` is literal (`Don't`); `'{'` escapes a brace; `''` is one quote.
  Polish quotes are „…”.
- **Errors:** map an error code to an `errors` key; never show `Error.message`.

## Numbers, dates, units

Through `apps/mobile/src/ui-kit/format.ts` on the **app** language, never `toFixed` or the phone's
locale in a component: `2,50 km`, `5:12 /km` in Polish. Each function takes the locale last and
defaults to the current one (tests pass `'en'` / `'pl'`). Decimals are `fixed()`: the digits of
`toFixed` (English unchanged, never grouped: Hermes' `Intl.NumberFormat` has no `useGrouping`) with
the locale's decimal mark from Intl. Dates use `Intl.DateTimeFormat` with the app language in the
phone's regional variant when they agree (`en-GB` keeps "22 Oct"). A component that formats but does
not call `useT` reads `useLocale()` so it re-renders on a change (memoised rows: pass it as
`extraData`). Units stay metric symbols in every language (`km`, `km/h`, `km²`); accessibility
labels spell units out through the catalogue. `formatArea` keeps its grouping-free output.

## Not translated

- Code and domain terms (`cycle`, `Claim`, `Turf Cell`): only the catalogue translates (L9).
- User data: stored activity names, city names the user typed. The default activity name is made in
  the language active at creation and never rewritten (L7).
- Dev-only screens and seeders (`apps/mobile/src/dev/`), the developer card
  (`apps/mobile/src/contexts/cloud-backup/ui/backup-developer-card.tsx`), tests, logs and
  diagnostics. They are exempt from the lint rule in `apps/mobile/eslint.config.mjs`.
- Native strings (iOS permission prompts, `CFBundleLocalizations`, Android `locales_config`): a
  later binary release, not over the air (L10).

## Polish glossary (from `apps/web/messages/pl.json`)

| English                  | Polish                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| turf                     | **turf**, inflected: Twój turf, Mapa turfu, staje się Twoim turfem |
| Turf Map                 | Mapa turfu                                                         |
| cells                    | komórki (1530 komórek)                                             |
| Walk / Run / Ride (type) | Spacer / Bieg / Rower                                              |
| walks, runs and rides    | spacery, biegi i przejażdżki                                       |
| activity, activities     | aktywność, aktywności                                              |
| achievement              | osiągnięcie                                                        |
| Home City / your city    | Twoje miasto                                                       |
| route                    | trasa                                                              |
| cloud backup             | kopia zapasowa, kopia w chmurze                                    |
| Apple Health workouts    | treningi z Apple Health                                            |
| account / sign in        | konto / zaloguj się                                                |

Address the Turfer informally and **capitalise** the forms of Ty: Ty, Twój, Twoja, Twoje, Ciebie, Ci
("Ulice są Twoje"); the reflexive swój/swoją stays lowercase. Decimal comma, `km²`. Natural Polish
wins over a literal translation; brand-designer reviews every Polish message (step 4).

## Adding a language

A folder `apps/mobile/messages/<locale>/` with every namespace file, one entry in `LOCALES`
(`apps/mobile/src/i18n/locales.ts`) and its imports in `catalogue.ts`, its plural data for the
polyfill (L3: a `locale-data/<locale>.js` require in `apps/mobile/src/i18n/plural-rules.ts`; Hermes
has no `Intl.PluralRules`), and the website's pair kept in step. audit:i18n takes the plural
categories from CLDR, so it checks the new locale without changes.

## Verify

```bash
pnpm run audit:i18n                                   # keys, ICU, placeholders, plurals (in ci:quality)
pnpm -C apps/mobile exec eslint <files>               # local-rules/no-raw-text, once switched on
pnpm -C apps/mobile exec jest src/i18n src/ui-kit     # locale resolution, translator, format.ts in en and pl
pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios   # unchanged: ships over the air
```

Until step 2 switches the rule on, check a migrated file with
`pnpm -C apps/mobile exec eslint --rule '{"local-rules/no-raw-text":"error"}' <files>`. Then run the
Maestro language flow (`mobile-testing` skill) and look at the changed screens on the simulator in
**both** languages: long Polish words on small screens, plurals at 1, 2, 5, 22 and 1,5. Never call a
language done from the audit alone: Hermes plural rules show only on a simulator.
