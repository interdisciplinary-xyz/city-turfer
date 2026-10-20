// Identity's adapter SPI (@cityturfer/core/identity/ports): the gateways its adapters implement and
// the user value types they build. Only this context's adapters, test doubles and composition
// roots import it; everything else uses the public API (@cityturfer/core/identity).
export type { AuthGateway, SessionStore, SignInOutcome } from './application/ports';
export { type Email, type User, type UserId, userId } from './domain/user';
