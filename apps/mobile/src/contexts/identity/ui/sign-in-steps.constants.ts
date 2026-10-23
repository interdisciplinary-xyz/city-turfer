/** Sign-in's steps: the email, then a password (local profile or chosen) or the emailed code. */
export type SignInStep = 'email' | 'password' | 'code';

/** Which field takes the keyboard after a switch; null: none. */
export type SignInFocus = 'email' | 'password' | null;

export const SIGN_IN_COPY = {
  wrongPassword: 'Wrong email or password.',
  wrongChosenPassword:
    'Wrong email or password. No account password yet? Sign in with an email code, then set one in Me › Account.',
} as const;
