# GitHub Pages

The app must be compiled with Vite before publishing. Publishing the source branch directly serves an HTML file that points at `src/main.tsx`, which browsers cannot run.

In **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. The `Build and deploy FitX Pages` workflow builds and publishes `dist` when `codex/branding-feature-access-upgrade` changes. It checks TypeScript and unit tests before deploying.

The published URL is `https://heftyallen.github.io/fitx-hub/`. The Pages build uses `/fitx-hub/` for its assets, worker scope, manifest and email return links. Member and admin navigation uses hash URLs such as `/fitx-hub/#/nutrition`, so refreshing a page works on static hosting. Old direct paths redirect through `404.html`.

For a local Pages build, run `npm run build:pages`, then `npm run preview` and open `/fitx-hub/`. `npm run build` still builds the existing root-hosted app with its current routes.

The frontend continues to use the existing Firebase and Supabase backend. Add `heftyallen.github.io` to **Firebase Authentication → Settings → Authorized domains** to support Google sign-in and email action return URLs on this host. Keep the existing provider configuration and credentials. GitHub Pages does not deploy Firebase security rules or Supabase Edge Functions; follow the rollout instructions in [Member experience, branding and access](Member-Experience-Branding-Access.md) for those updates.

Only public browser configuration belongs in a Vite build. Do not put server credentials, service-role keys or payment secrets in the workflow or any `VITE_` variable.
