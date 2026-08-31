import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

describe('ErrorBoundary', () => {
	// Suppress console.error for these tests
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('should render children without error', () => {
		render(
			<ErrorBoundary>
				<div>Test content</div>
			</ErrorBoundary>,
		)

		expect(screen.getByText('Test content')).toBeInTheDocument()
	})

	it('should render fallback UI when error occurs', () => {
		// Component that throws an error during render
		const ThrowError = () => {
			throw new Error('Test error')
		}

		render(
			<ErrorBoundary>
				<ThrowError />
			</ErrorBoundary>,
		)

		expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
		expect(screen.getByText(/encountered an unexpected error/i)).toBeInTheDocument()
	})

	it('should display custom fallback when provided', () => {
		const ThrowError = () => {
			throw new Error('Test error')
		}

		const customFallback = <div>Custom error message</div>

		render(
			<ErrorBoundary fallback={customFallback}>
				<ThrowError />
			</ErrorBoundary>,
		)

		expect(screen.getByText('Custom error message')).toBeInTheDocument()
		expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument()
	})

	it('should display error message in details', () => {
		const ThrowError = () => {
			throw new Error('Specific test error')
		}

		render(
			<ErrorBoundary>
				<ThrowError />
			</ErrorBoundary>,
		)

		expect(screen.getByText(/Specific test error/)).toBeInTheDocument()
	})

	it('should have refresh button', () => {
		const ThrowError = () => {
			throw new Error('Test error')
		}

		render(
			<ErrorBoundary>
				<ThrowError />
			</ErrorBoundary>,
		)

		const refreshButton = screen.getByText('Refresh Page')
		expect(refreshButton).toBeInTheDocument()
	})
})
