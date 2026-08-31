import React, { ReactNode, ReactElement } from 'react'
import * as Sentry from '@sentry/react'

interface Props {
	children: ReactNode
	fallback?: ReactElement
}

interface State {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		Sentry.captureException(error, {
			contexts: {
				react: {
					componentStack: errorInfo.componentStack,
				},
			},
		})
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className='min-h-screen flex items-center justify-center bg-gray-100 p-4'>
						<div className='bg-white rounded-lg shadow-lg p-8 max-w-md w-full'>
							<h1 className='text-2xl font-bold text-red-600 mb-4'>Oops! Something went wrong</h1>
							<p className='text-gray-700 mb-4'>
								We encountered an unexpected error. Please try refreshing the page.
							</p>
							{this.state.error && (
								<div className='bg-gray-100 p-3 rounded text-sm text-gray-800 mb-4 overflow-auto max-h-32'>
									<p className='font-mono text-xs'>{this.state.error.message}</p>
								</div>
							)}
							<button
								onClick={() => window.location.reload()}
								className='w-full bg-blue-600 text-white py-2 px-4 rounded font-semibold hover:bg-blue-700 transition'
							>
								Refresh Page
							</button>
						</div>
					</div>
				)
			)
		}

		return this.props.children
	}
}
