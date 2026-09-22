import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

/**
 * Zod 4 reports problems in `issues`; the old code read `errors`, which is
 * undefined there — so every rejected request arrived as an empty object and
 * the UI could only say "Request failed".
 */
function validationError(label: string, error: any) {
	const issues = (error?.issues ?? []).map((e: any) => ({
		field: Array.isArray(e.path) ? e.path.join('.') : String(e.path ?? ''),
		message: e.message,
	}))
	return {
		error: label,
		// `message` is what the client actually displays
		message: issues[0]?.message ?? label,
		details: issues,
	}
}

export const validateBody = (schema: ZodSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			const validated = schema.parse(req.body)
			req.body = validated as any
			next()
		} catch (error: any) {
			return res.status(400).json(validationError('Validation error', error))
		}
	}
}

export const validateParams = (schema: ZodSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			const validated = schema.parse(req.params)
			req.params = validated as any
			next()
		} catch (error: any) {
			return res.status(400).json(validationError('Invalid parameters', error))
		}
	}
}

export const validateQuery = (schema: ZodSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			const validated = schema.parse(req.query)
			req.query = validated as any
			next()
		} catch (error: any) {
			return res.status(400).json(validationError('Invalid query parameters', error))
		}
	}
}
