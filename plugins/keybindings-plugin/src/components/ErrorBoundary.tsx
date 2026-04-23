import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Alert, Button } from "@ghost-shell/ui";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class KeybindingsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[KeybindingsPanel] Render error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="p-4 flex flex-col gap-2">
          <Alert variant="destructive" className="text-xs">
            <div className="font-semibold mb-1">Keybindings panel encountered an error</div>
            <p className="text-muted-foreground">{this.state.error.message}</p>
          </Alert>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ error: null })}
            className="self-start"
          >
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
