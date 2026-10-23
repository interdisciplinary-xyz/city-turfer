// Entry point. The background location task must be defined in the global
// scope before anything else runs, so headless launches (app killed, OS
// delivering locations) find it. Then hand over to expo-router.
import './src/contexts/recording/infrastructure/background-task';
// Then Intl.PluralRules where the engine lacks it (Hermes), before any message is formatted.
import './src/i18n/plural-rules';
import 'expo-router/entry';
