import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#1C1C2E] flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container rounded-2xl p-8 max-w-md w-full shadow-lg border border-gray-200 dark:border-surface-raised text-center">
            <div className="text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="font-headline-md text-gray-900 dark:text-white mb-2">Oops, something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              We're sorry, but the application encountered an unexpected error.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-success-lime text-green-900 font-label-md py-2 px-6 rounded-full hover:brightness-105 active:scale-95 transition-all"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
