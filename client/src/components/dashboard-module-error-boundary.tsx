import React from "react";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardModuleErrorBoundaryProps = {
  moduleLabel: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  children: React.ReactNode;
};

type DashboardModuleErrorBoundaryState = {
  error: Error | null;
};

export default class DashboardModuleErrorBoundary extends React.Component<
  DashboardModuleErrorBoundaryProps,
  DashboardModuleErrorBoundaryState
> {
  state: DashboardModuleErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): DashboardModuleErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[dashboard-module-render-error]", {
        module: this.props.moduleLabel,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Card className="border-border/70">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>No pudimos cargar este modulo</CardTitle>
            <CardDescription>
              Intenta cargarlo de nuevo o vuelve al resumen para seguir trabajando.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={this.handleRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
          <Button variant="outline" onClick={this.props.onGoHome}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Volver al resumen
          </Button>
        </CardContent>
      </Card>
    );
  }
}
