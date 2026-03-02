import { Component, ErrorInfo, ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Erro inesperado ao carregar o sistema.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro de renderizacao nao tratado", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full rounded-lg border bg-card p-6 space-y-3">
          <h1 className="text-lg font-semibold text-foreground">Falha ao carregar o sistema</h1>
          <p className="text-sm text-muted-foreground">
            O sistema encontrou um erro inesperado e nao conseguiu concluir o carregamento.
          </p>
          <p className="text-xs text-destructive break-words">{this.state.message}</p>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={this.handleReload}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
