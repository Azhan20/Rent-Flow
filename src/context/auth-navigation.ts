export const EMAIL_VERIFICATION_RETURN_PARAM = 'rentflow_email_verification_return';

export function createEmailVerificationContinueUrl(currentHref: string): string {
  const url = new URL(currentHref);
  url.searchParams.delete('auth');
  url.searchParams.set(EMAIL_VERIFICATION_RETURN_PARAM, '1');
  return url.toString();
}

export function consumeEmailVerificationReturn(currentHref: string): {
  returnedFromVerification: boolean;
  relativeUrl: string;
} {
  const url = new URL(currentHref);
  const returnedFromVerification = url.searchParams.get(EMAIL_VERIFICATION_RETURN_PARAM) === '1';
  if (returnedFromVerification) url.searchParams.delete(EMAIL_VERIFICATION_RETURN_PARAM);
  return {
    returnedFromVerification,
    relativeUrl: `${url.pathname}${url.search}${url.hash}`,
  };
}
