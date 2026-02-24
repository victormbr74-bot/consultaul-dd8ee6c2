export const TEMP_LOGIN_RETURN_AT = new Date(2026, 1, 27, 0, 0, 0);

export const isTemporaryConsultaPublicAccessEnabled = (now = new Date()) =>
  now.getTime() < TEMP_LOGIN_RETURN_AT.getTime();

export const canAccessConsultaWithoutLogin = (pathname: string, now = new Date()) => {
  if (!isTemporaryConsultaPublicAccessEnabled(now)) return false;
  return pathname === "/" || pathname.startsWith("/loterica/");
};
