export type MembershipBillingRequest = {
  branchId: string;
  membershipId: string;
  planId: string;
  eventType: "assign" | "renew";
  paymentEffectiveDate: string;
  paymentMethod: string | null;
};

export function getMembershipBillingRequestFingerprint(request: MembershipBillingRequest): string {
  return JSON.stringify([
    "membership-billing-v1",
    request.branchId,
    request.membershipId,
    request.planId,
    request.eventType,
    request.paymentEffectiveDate,
    request.paymentMethod,
  ]);
}

export function matchesMembershipBillingRequestFingerprint(
  contextJson: unknown,
  fingerprint: string,
): boolean {
  return typeof contextJson === "object"
    && contextJson !== null
    && "requestFingerprint" in contextJson
    && contextJson.requestFingerprint === fingerprint;
}
