import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export const validateBody = (schema: ZodSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			const validated = schema.parse(req.body)
			req.body = validated as any
			next()
		} catch (error: any) {
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors?.map((e: any) => ({
					field: e.path.join('.'),
					message: e.message,
				})),
			})
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
			return res.status(400).json({
				error: 'Invalid parameters',
				details: error.errors?.map((e: any) => ({
					field: e.path.join('.'),
					message: e.message,
				})),
			})
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
			return res.status(400).json({
				error: 'Invalid query parameters',
				details: error.errors?.map((e: any) => ({
					field: e.path.join('.'),
					message: e.message,
				})),
			})
		}
	}
}
