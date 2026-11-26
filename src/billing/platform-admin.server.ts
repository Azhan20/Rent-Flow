import type { DecodedIdToken } from 'firebase-admin/auth';

/** Server-only authorization result for narrowly privileged billing operations. */
declare const platformAdminActorBrand: unique symbol;

export type PlatformAdminActor = Readonly<{
  firebaseUid: string;
  rentflowUserId: string;
  authorizationSource: string;
  authorizedAt: Date;
  [platformAdminActorBrand]: true;
}>;

/**
 * A future policy must derive privilege from a trusted platform-admin source,
 * not request fields, organization roles or account ownership. No such policy
 * is configured in this project, so writes must remain disabled.
 */
export interface PlatformAdminAuthorizationPolicy {
  readonly sourceId: string;
  authorizeVerifiedToken(token: DecodedIdToken): Promise<{ firebaseUid: string; rentflowUserId: string } | null>;
}

export class PlatformAdminAuthorizationError extends Error {
  constructor(readonly code: 'PLATFORM_ADMIN_AUTH_UNAVAILABLE' | 'PLATFORM_ADMIN_REQUIRED', message: string) {
    super(message);
    this.name = 'PlatformAdminAuthorizationError';
  }
}

function configuredPlatformAdminPolicy(): PlatformAdminAuthorizationPolicy | null {
  // Firebase custom claims or a separate platform-admin ACL have not been
  // provisioned and reviewed. Keep this null until a trusted source exists.
  return null;
}

/** No request-body role, account ID or override value participates here. */
export async function authorizePlatformAdmin(verifiedToken: DecodedIdToken): Promise<PlatformAdminActor> {
  if (!verifiedToken?.uid) {
    throw new PlatformAdminAuthorizationError('PLATFORM_ADMIN_REQUIRED', 'A verified Firebase identity is required.');
  }
  const policy = configuredPlatformAdminPolicy();
  if (!policy) {
    throw new PlatformAdminAuthorizationError('PLATFORM_ADMIN_AUTH_UNAVAILABLE', 'Privileged Enterprise override writes are disabled.');
  }
  const authorized = await policy.authorizeVerifiedToken(verifiedToken);
  if (!authorized || authorized.firebaseUid !== verifiedToken.uid || !authorized.rentflowUserId) {
    throw new PlatformAdminAuthorizationError('PLATFORM_ADMIN_REQUIRED', 'A trusted platform-admin authorization is required.');
  }
  return Object.freeze({
    firebaseUid: verifiedToken.uid,
    rentflowUserId: authorized.rentflowUserId,
    authorizationSource: policy.sourceId,
    authorizedAt: new Date(),
  }) as PlatformAdminActor;
}

/** Safe audit fields to persist with a future authorized override write. */
export function platformAdminAuditFields(actor: PlatformAdminActor) {
  return {
    actorUserId: actor.rentflowUserId,
    metadata: {
      actorFirebaseUid: actor.firebaseUid,
      authorizationSource: actor.authorizationSource,
      authorizedAt: actor.authorizedAt.toISOString(),
    },
  } as const;
}
