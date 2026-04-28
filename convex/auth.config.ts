// Convex trusts Clerk-issued JWTs. The `domain` below must match the
// Issuer URL of the "Convex" JWT template in your Clerk dashboard exactly.
//
// For the dev Clerk instance `settling-ferret-88`, the issuer is:
//   https://settling-ferret-88.clerk.accounts.dev
//
// `applicationID` must match the JWT template's "aud" claim — by Clerk
// convention the Convex preset uses "convex".

export default {
  providers: [
    {
      domain: "https://settling-ferret-88.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
