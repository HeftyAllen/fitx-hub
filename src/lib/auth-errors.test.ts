import { expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

it("gives the same recovery guidance for invalid password credentials without disclosing account existence", () => {
  const expected = authErrorMessage({ code: "auth/invalid-credential" });
  expect(expected).toContain("Continue with Google");
  expect(expected).toContain("reset your password");
  expect(authErrorMessage({ code: "auth/user-not-found" })).toBe(expected);
  expect(authErrorMessage({ code: "auth/wrong-password" })).toBe(expected);
});
it("turns Firebase network, provider and rate-limit errors into useful actions", () => {
  expect(authErrorMessage({ code: "auth/network-request-failed" })).toContain("connection");
  expect(authErrorMessage({ code: "auth/account-exists-with-different-credential" })).toContain("originally used");
  expect(authErrorMessage({ code: "auth/too-many-requests" })).toContain("Wait");
  expect(authErrorMessage({ code: "auth/unknown-error", message: "Firebase: raw internals" })).not.toContain("raw internals");
});
