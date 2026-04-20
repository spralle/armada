import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ color: 'red', padding: '8px', fontSize: '12px' }}>
          <strong>JsonForm render error:</strong>
          <p>{error.message}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '10px' }}>
            {error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
