// Re-export shim: the Shared Kernel lives in @cityturfer/core (packages/core/src/shared-kernel), so
// the phone and the server run the same maths. Kept so `@/shared-kernel` imports keep working.
export * from '@cityturfer/core/shared-kernel';
