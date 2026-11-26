/** Provider-neutral boundary for later verified billing events. No live adapter
 * or checkout implementation is supplied in Stage 2. */
/** Provider adapters can be added without coupling domain logic to Paddle. */
export type PaymentProvider = string & {};

export type VerifiedProviderEvent = {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  occurredAt: Date;
  /** Normalized provider payload only; never raw card or credential material. */
  payload: Readonly<Record<string, unknown>>;
};

/**
 * Canonical statuses stored by RentFlow. Paddle's `paused` maps to
 * `SUSPENDED`; `canceled` maps to `CANCELLED`. Paddle reports scheduled
 * cancellation as `active` until its effective date, so adapters must retain
 * the scheduled cancellation timestamp separately and not preemptively cancel.
 */
export type AccountSubscriptionStatus =
  | 'PENDING'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type PaddleSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled';

export function normalizePaddleSubscriptionStatus(status: PaddleSubscriptionStatus): AccountSubscriptionStatus {
  switch (status) {
    case 'active': return 'ACTIVE';
    case 'trialing': return 'TRIALING';
    case 'past_due': return 'PAST_DUE';
    case 'paused': return 'SUSPENDED';
    case 'canceled': return 'CANCELLED';
  }
}

export type ProviderSubscriptionState = {
  provider: PaymentProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  providerPriceId: string | null;
  internalPriceIdentifier: string;
  planIdentifier: string;
  catalogVersion: string;
  interval: 'MONTHLY' | 'YEARLY';
  status: AccountSubscriptionStatus;
  periodStartsAt: Date | null;
  periodEndsAt: Date | null;
  cancellationRequestedAt: Date | null;
  cancelledAt: Date | null;
};

/** The implementation must verify provider signatures before returning an event. */
export interface BillingProviderAdapter {
  readonly provider: PaymentProvider;
  verifyAndNormalizeWebhook(input: {
    rawBody: Uint8Array;
    headers: Readonly<Record<string, string | undefined>>;
  }): Promise<VerifiedProviderEvent>;
  mapVerifiedEvent(event: VerifiedProviderEvent): ProviderSubscriptionState | null;
}
