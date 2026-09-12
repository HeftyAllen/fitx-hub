import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const FIREBASE_PROJECT_ID = "fit-x-journey";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export interface FirebaseIdentity {
  uid: string;
  email?: string;
}

export async function verifyFirebaseToken(token: string): Promise<FirebaseIdentity> {
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: FIREBASE_ISSUER,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ["RS256"],
  });
  if (!payload.sub) throw new Error("Firebase token has no user ID");
  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
}

function firestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  for (const key of ["stringValue", "booleanValue", "integerValue", "doubleValue", "timestampValue", "nullValue"]) {
    if (key in record) return record[key];
  }
  return value;
}

export async function getFirebaseAdminRole(uid: string, idToken: string): Promise<string | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Admin role check failed [${response.status}]: ${await response.text()}`);
  const document = await response.json();
  return String(firestoreValue(document?.fields?.role) ?? "") || null;
}