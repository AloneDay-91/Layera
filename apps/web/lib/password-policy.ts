// Shared so the sign-up form and Better Auth cannot drift apart and reject a
// password only after the round-trip.
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
