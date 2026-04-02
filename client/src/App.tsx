import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { Loader2, Dumbbell } from "lucide-react";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import SuperAdminPage from "@/pages/superadmin";
import DashboardPage from "@/pages/dashboard";
import BranchPublicPage from "@/pages/branch-public";
import BlockedPage from "@/pages/blocked";
import ExplorePage from "@/pages/explore";
import FavoritesPage from "@/pages/favorites";
import ProfilePage from "@/pages/profile";
import AcceptTermsPage from "@/pages/accept-terms";
import LegalPage from "@/pages/legal";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import PromotionsPage from "@/pages/promotions";

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-md bg-primary">
        <Dumbbell className="h-7 w-7 text-primary-foreground" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <FullScreenLoader />;

  if (location === "/terminos" || location === "/privacidad") {
    return <LegalPage />;
  }

  if (location === "/forgot-password") {
    return <ForgotPasswordPage />;
  }

  if (location.startsWith("/reset-password")) {
    return <ResetPasswordPage />;
  }

  if (location.startsWith("/verify-email")) {
    return <VerifyEmailPage />;
  }

  if (location === "/explore") {
    return <ExplorePage />;
  }

  if (location === "/promotions") {
    return <PromotionsPage />;
  }

  if (location === "/favorites") {
    if (!user) return <LoginPage />;
    return <FavoritesPage />;
  }

  if (location === "/profile") {
    if (!user) return <LoginPage />;
    return <ProfilePage />;
  }

  if (location.startsWith("/app/")) {
    return (
      <Switch>
        <Route path="/app/:slug" component={BranchPublicPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (location === "/blocked") {
    return <BlockedPage />;
  }

  if (!user) {
    return <LoginPage />;
  }

  const isImpersonating = !!(user as any).impersonating;

  if (user.role === "SUPER_ADMIN" && !isImpersonating) {
    if (location !== "/superadmin" && !location.startsWith("/superadmin")) {
      return <Redirect to="/superadmin" />;
    }
    return <SuperAdminPage />;
  }

  if (user.role === "BRANCH_ADMIN" || isImpersonating) {
    if (user.branch && user.branch.status === "blacklisted") {
      return <BlockedPage />;
    }
    if (location !== "/dashboard" && !location.startsWith("/dashboard")) {
      return <Redirect to="/dashboard" />;
    }
    return <DashboardPage />;
  }

  if (user.role === "CUSTOMER") {
    if (!user.acceptedTerms) {
      return <AcceptTermsPage />;
    }
    if (user.branch && user.branch.status !== "active") {
      return <BlockedPage />;
    }
    if (location === "/" || location === "") {
      return <Redirect to="/explore" />;
    }
    if (user.branch) {
      return <Redirect to={`/app/${user.branch.slug}`} />;
    }
    return <Redirect to="/explore" />;
  }

  return <LoginPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <AuthenticatedRouter />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
