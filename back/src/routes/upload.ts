import { Router, Request, Response, NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

// Configure once at module load. Undefined values will cause uploads to
// fail gracefully at request time (503) rather than crashing the server on start.
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key:    process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
})

function isCloudinaryConfigured(): boolean {
	return !!(
		process.env.CLOUDINARY_CLOUD_NAME &&
		process.env.CLOUDINARY_API_KEY &&
		process.env.CLOUDINARY_API_SECRET
	)
}

// Accept images only, max 10 MB, buffered in memory (no temp files on disk)
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (file.mimetype.startsWith('image/')) cb(null, true)
		else cb(new Error('Only image files are allowed'))
	},
})

const router = Router()

// POST /api/upload
// Requires auth. Accepts multipart/form-data with field "file".
// Returns { url: string } — the secure Cloudinary URL.
router.post(
	'/',
	authMiddleware,
	upload.single('file'),
	async (req: AuthRequest, res: Response): Promise<void> => {
		if (!isCloudinaryConfigured()) {
			res.status(503).json({ message: 'Image upload service is not configured on this server.' })
			return
		}

		if (!req.file) {
			res.status(400).json({ message: 'No file provided' })
			return
		}

		try {
			const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
				const stream = cloudinary.uploader.upload_stream(
					{ folder: 'mindflow', resource_type: 'image' },
					(error, result) => {
						if (error || !result) reject(error ?? new Error('Cloudinary upload failed'))
						else resolve(result as { secure_url: string })
					},
				)
				stream.end(req.file!.buffer)
			})

			res.json({ url: result.secure_url })
		} catch (err) {
			console.error('[upload]', err instanceof Error ? err.message : 'unknown')
			res.status(500).json({ message: 'Upload failed' })
		}
	},
)

// Multer errors (wrong mime type, file too large) must be caught by an
// Express error-handler — they don't reach the route callback.
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
	if (err instanceof MulterError) {
		res.status(400).json({ message: err.message })
	} else if (err?.message === 'Only image files are allowed') {
		res.status(400).json({ message: err.message })
	} else {
		res.status(500).json({ message: 'Upload error' })
	}
})

export default router
