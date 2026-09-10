import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/** App-wide crash guard — keeps a render error from blanking the whole screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[crash]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="text-destructive" size={24} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-heading font-bold">Something broke</h1>
            <p className="text-sm text-muted-foreground">
              Your data is safe. Reload the page to carry on — if it keeps happening, send us a ticket from Support.
            </p>
          </div>
          <details className="text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer select-none">Technical details</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-secondary p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
              {error.message || String(error)}
            </pre>
          </details>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={15} /> Reload
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-secondary/70 transition-colors"
            >
              <Home size={15} /> Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
