import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import { AnimatePresence } from "framer-motion";
import OfflineBanner from "@/components/OfflineBanner";
import ThemeSync from "@/components/ThemeSync";
import PushListener from "@/components/PushListener";
import AdminInviteBanner from "@/components/AdminInviteBanner";
import AdminRoute from "@/components/admin/AdminRoute";
import { useAdmin, AdminProvider } from "@/hooks/useAdmin";
import AdminLayout from "@/components/admin/AdminLayout";
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ExerciseLibrary = lazy(() => import("./pages/ExerciseLibrary"));
const Nutrition = lazy(() => import("./pages/Nutrition"));
const Recipes = lazy(() => import("./pages/Recipes"));
const Progress = lazy(() => import("./pages/Progress"));
const Records = lazy(() => import("./pages/Records"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Settings = lazy(() => import("./pages/Settings"));
const Support = lazy(() => import("./pages/Support"));
const WorkoutPlanner = lazy(() => import("./pages/WorkoutPlanner"));
const WorkoutSession = lazy(() => import("./pages/WorkoutSession"));
const MealPlanner = lazy(() => import("./pages/MealPlanner"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const AdminAnnouncements = lazy(
  () => import("./pages/admin/AdminAnnouncements"),
);
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const Library = lazy(() => import("./pages/Library"));
const GroceryList = lazy(() => import("./pages/GroceryList"));
const AdminCoaching = lazy(() => import("./pages/admin/AdminCoaching"));
import { OfflineProvider } from "@/contexts/OfflineContext";

const queryClient = new QueryClient();

const Spinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function ProtectedRoute({
  children,
  allowOnboarding = false,
}: {
  children: React.ReactNode;
  allowOnboarding?: boolean;
}) {
  const { user, loading, needsOnboarding } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (needsOnboarding && !allowOnboarding)
    return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function DashboardGate() {
  const { isAdmin, loading } = useAdmin();
  if (loading) return <Spinner />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Dashboard />;
}

function RootRedirect() {
  const { user, loading, needsOnboarding } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Landing />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AuthRedirect() {
  const { user, loading, needsOnboarding } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Auth />;
  return (
    <Navigate to={needsOnboarding ? "/onboarding" : "/dashboard"} replace />
  );
}

function AppRoutes() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth" element={<AuthRedirect />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute allowOnboarding>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardGate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workout-planner"
          element={
            <ProtectedRoute>
              <WorkoutPlanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workout-session"
          element={
            <ProtectedRoute>
              <WorkoutSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exercise-library"
          element={
            <ProtectedRoute>
              <ExerciseLibrary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nutrition"
          element={
            <ProtectedRoute>
              <Nutrition />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recipes"
          element={
            <ProtectedRoute>
              <Recipes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meal-planner"
          element={
            <ProtectedRoute>
              <MealPlanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <Progress />
            </ProtectedRoute>
          }
        />
        <Route
          path="/records"
          element={
            <ProtectedRoute>
              <Records />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rewards"
          element={
            <ProtectedRoute>
              <Rewards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <Support />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <Library />
            </ProtectedRoute>
          }
        />
        <Route
          path="/grocery"
          element={
            <ProtectedRoute>
              <GroceryList />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route
            index
            element={
              <AdminRoute section="overview">
                <AdminOverview />
              </AdminRoute>
            }
          />
          <Route
            path="users"
            element={
              <AdminRoute section="users">
                <AdminUsers />
              </AdminRoute>
            }
          />
          <Route
            path="content"
            element={
              <AdminRoute section="content">
                <AdminContent />
              </AdminRoute>
            }
          />
          <Route
            path="coaching"
            element={
              <AdminRoute section="coaching">
                <AdminCoaching />
              </AdminRoute>
            }
          />
          <Route
            path="activity"
            element={
              <AdminRoute section="activity">
                <AdminActivity />
              </AdminRoute>
            }
          />
          <Route
            path="announcements"
            element={
              <AdminRoute section="announcements">
                <AdminAnnouncements />
              </AdminRoute>
            }
          />
          <Route
            path="support"
            element={
              <AdminRoute section="support">
                <AdminSupport />
              </AdminRoute>
            }
          />
          <Route
            path="settings"
            element={
              <AdminRoute section="settings">
                <AdminSettings />
              </AdminRoute>
            }
          />
          <Route
            path="reports"
            element={
              <AdminRoute section="reports">
                <AdminReports />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OfflineProvider>
            <AdminProvider>
              <ThemeSync />
              <PushListener />
              <SiteSettingsProvider>
                <OfflineBanner />
                <AdminInviteBanner />
                <Suspense fallback={<Spinner />}>
                  <AppRoutes />
                </Suspense>
              </SiteSettingsProvider>
            </AdminProvider>
          </OfflineProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
