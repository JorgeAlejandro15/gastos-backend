export interface JwtPayload {
  sub: string;
  /** Email may be an empty string when the account was created with phone-only */
  email: string;
  /** Session id (auth_sessions.id) */
  sid: string;
  /** Token type */
  typ: 'access';
}
