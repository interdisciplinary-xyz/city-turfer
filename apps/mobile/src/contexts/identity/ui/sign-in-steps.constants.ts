/** Sign-in's steps: the email, then a password (local profile or chosen) or the emailed code. */
export type SignInStep = 'email' | 'password' | 'code';

/** Which field takes the keyboard after a switch; null: none. */
export type SignInFocus = 'email' | 'password' | null;
