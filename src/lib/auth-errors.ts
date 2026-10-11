export function authErrorMessage(error: unknown, fallback = "We couldn't sign you in. Please try again."): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password wasn't accepted. If you signed up with Google, use Continue with Google. Otherwise check your details or reset your password.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/email-already-in-use": return "We couldn't create an account with these details. Try signing in using your original method or reset your password.";
    case "auth/weak-password": return "Choose a password with at least 6 characters.";
    case "auth/too-many-requests": return "Too many sign-in attempts. Wait a few minutes before trying again.";
    case "auth/network-request-failed": return "We couldn't connect to sign-in. Check your connection and try again.";
    case "auth/user-disabled": return "This account is disabled. Contact the app administrator for help.";
    case "auth/account-exists-with-different-credential": return "Use the sign-in method you originally used for this account.";
    case "auth/operation-not-allowed": return "This sign-in method is unavailable. Contact the app administrator.";
    default: return code ? fallback : error instanceof Error ? error.message : fallback;
  }
}
