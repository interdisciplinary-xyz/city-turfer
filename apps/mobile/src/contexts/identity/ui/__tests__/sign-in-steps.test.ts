import { emailEditRestarts, onEmailSubmit, switchSignIn, wrongPasswordText } from '../sign-in-steps';
import { SIGN_IN_COPY } from '../sign-in-steps.constants';

describe('sign-in: "Use a password instead"', () => {
  it('focuses the email while it is empty, the password once there is one', () => {
    expect(switchSignIn(true, '')).toEqual({ step: 'password', chosePassword: true, focus: 'email' });
    expect(switchSignIn(true, '   ')).toMatchObject({ focus: 'email' });
    expect(switchSignIn(true, 'ola@example.com')).toEqual({ step: 'password', chosePassword: true, focus: 'password' });
  });

  it('back to an email code: the email step, nothing focused', () => {
    expect(switchSignIn(false, 'ola@example.com')).toEqual({ step: 'email', chosePassword: false, focus: null });
  });

  it('with a chosen password, return on the email moves on and editing it keeps the step', () => {
    expect(onEmailSubmit(true)).toBe('focus-password');
    expect(onEmailSubmit(false)).toBe('send');
    expect(emailEditRestarts('password', true)).toBe(false);
    expect(emailEditRestarts('password', false)).toBe(true); // a local profile's password step
    expect(emailEditRestarts('code', false)).toBe(true);
    expect(emailEditRestarts('email', false)).toBe(false);
  });

  it('a wrong chosen password also says how to get one', () => {
    expect(wrongPasswordText(true)).toBe(SIGN_IN_COPY.wrongChosenPassword);
    expect(wrongPasswordText(false)).toBe(SIGN_IN_COPY.wrongPassword);
  });
});
