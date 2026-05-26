import { useAuth } from "@/lib/auth";
import { Redirect, Route, Switch } from "wouter";
import { Layout } from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Scan from "@/pages/scan";
import Riwayat from "@/pages/riwayat";
import Master from "@/pages/master";

function ProtectedRoute({ component: Component, roles = ["user", "master"] }: { component: any, roles?: string[] }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!roles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

export default function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>

      <Route path="/:path*">
        <Layout>
          <Switch>
            <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
            <Route path="/scan" component={() => <ProtectedRoute component={Scan} />} />
            <Route path="/riwayat" component={() => <ProtectedRoute component={Riwayat} />} />
            <Route path="/master" component={() => <ProtectedRoute component={Master} roles={["master"]} />} />
            <Route path="/master/:path*" component={() => <ProtectedRoute component={Master} roles={["master"]} />} />
            <Route>404 Not Found</Route>
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}