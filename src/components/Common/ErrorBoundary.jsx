import React from 'react'
import { AlertTriangle } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center bg-bg-primary p-6">
          <div className="flex w-full max-w-md flex-col items-center text-center rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-8 shadow-2xl">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">Something went wrong</h1>
            <p className="mb-6 text-sm text-gray-400">
              An unexpected error occurred while rendering this component.
            </p>
            {this.state.error && (
              <div className="mb-8 w-full rounded-lg bg-[#0f1117] p-3 text-left overflow-auto max-h-40 border border-[#2a2d3e]">
                <p className="text-xs font-mono text-gray-400 break-words whitespace-pre-wrap">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <div className="flex w-full gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 rounded-lg border border-[#2a2d3e] px-4 py-2 font-medium text-gray-300 transition-colors hover:bg-[#252840] hover:text-white"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
