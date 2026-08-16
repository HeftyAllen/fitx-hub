# FitX Journey

Fitness tracking app: workouts, nutrition, progress, rewards — plus a role-based
admin console that controls branding, content and communications app-wide.

## Documentation

- [User Guide](docs/FitX-Journey-User-Guide.md) — everything a member can do
- [Admin Guide](docs/FitX-Journey-Admin-Guide.md) — roles and every console section
- [Security & Deployment](SECURITY.md) — env vars, rules deployment, first admin

## Stack

React 18 + Vite 5 + TypeScript + Tailwind CSS + shadcn/ui, framer-motion for
motion, recharts for charts, Firebase (auth, Firestore, storage) for data, and a
server function proxy for third-party food/exercise providers.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:8080
```

## Feature map

| Area | Routes |
| --- | --- |
| Member | `/dashboard` `/workout-planner` `/workout-session` `/exercise-library` `/nutrition` `/recipes` `/meal-planner` `/grocery` `/progress` `/records` `/calendar` `/rewards` `/settings` `/support` |
| Admin | `/admin` `/admin/users` `/admin/content` `/admin/activity` `/admin/announcements` `/admin/support` `/admin/reports` `/admin/settings` |

Roles: `admin`, `moderator`, `staff`, `readonly` — see `src/lib/permissions.ts`.
