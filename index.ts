// Entry point. The background location task must be defined in the global
// scope before anything else runs, so headless launches (app killed, OS
// delivering locations) find it. Then hand over to expo-router.
import './src/contexts/recording/infrastructure/background-task';
import 'expo-router/entry';
