import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const fixture = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; email: string } },
  authChanged: null as null | ((user: unknown) => void),
  listeners: [] as { next: (value: unknown) => void; error: (value: unknown) => void }[],
}));
vi.mock("@/lib/firebase", () => ({ auth: fixture.auth, db: {}, googleProvider: {} }));
vi.mock("@/lib/pushNotifications", () => ({ unregisterPushBeforeSignOut: vi.fn() }));
vi.mock("firebase/auth", async importActual => ({
  ...await importActual<typeof import("firebase/auth")>(),
  getRedirectResult: async () => null,
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => { fixture.authChanged = callback; callback(fixture.auth.currentUser); return () => {}; },
}));
vi.mock("firebase/firestore", async importActual => ({
  ...await importActual<typeof import("firebase/firestore")>(),
  doc: () => ({}),
  onSnapshot: (_ref: unknown, _options: unknown, next: (value: unknown) => void, error: (value: unknown) => void) => { fixture.listeners.push({ next, error }); return () => {}; },
  runTransaction: async () => undefined,
}));

function Probe() {
  const { loading, needsOnboarding, profileError, userProfile, retryProfile } = useAuth();
  return <><output data-testid="state">{JSON.stringify({ loading, needsOnboarding, profileError, name: userProfile?.name })}</output><button onClick={retryProfile}>Retry</button></>;
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!);
const snapshot = (data: unknown, fromCache = false) => ({ exists: () => data !== null, data: () => data, metadata: { fromCache } });
beforeEach(() => {
  fixture.auth.currentUser = { uid: "friend", email: "friend@example.test" };
  fixture.listeners = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("does not treat a denied profile read as an incomplete profile and can reconnect", () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  act(() => fixture.listeners[0].error({ code: "permission-denied" }));
  expect(state()).toMatchObject({ loading: false, needsOnboarding: false });
  expect(state().profileError).toContain("access to your profile was denied");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(state().loading).toBe(true);
  act(() => fixture.listeners.at(-1)!.next(snapshot({ name: "Friend", goalType: "lose" })));
  expect(state()).toMatchObject({ loading: false, needsOnboarding: false, profileError: null, name: "Friend" });
});
it("ignores late profile callbacks from the previous account", () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  const previous = fixture.listeners[0];
  act(() => {
    fixture.auth.currentUser = { uid: "other", email: "other@example.test" };
    fixture.authChanged!(fixture.auth.currentUser);
    previous.next(snapshot({ name: "Previous", goalType: "lose" }));
    previous.error({ code: "permission-denied" });
  });
  expect(state()).toMatchObject({ loading: true, profileError: null });
  expect(state().name).toBeUndefined();
  act(() => fixture.listeners.at(-1)!.next(snapshot({ name: "Other", goalType: "maintain" })));
  expect(state().name).toBe("Other");
});
it("waits for the server before redirecting a cache-missing profile to onboarding", () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  act(() => fixture.listeners[0].next(snapshot(null, true)));
  expect(state().loading).toBe(true);
  act(() => fixture.listeners[0].next(snapshot(null)));
  expect(state()).toMatchObject({ loading: false, needsOnboarding: true, profileError: null });
});
