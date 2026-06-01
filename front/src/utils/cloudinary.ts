const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

/**
 * Upload a single image file via the backend proxy (POST /api/upload).
 * Cloudinary credentials never leave the server — the frontend only sends
 * the file and the user's JWT.
 */
export async function uploadToCloudinary(file: File, token: string): Promise<string> {
	const fd = new FormData()
	fd.append('file', file)

	const res = await fetch(`${API}/api/upload`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
		body: fd,
	})

	const data = await res.json()
	if (!res.ok) throw new Error(data.message || 'Upload failed')
	return data.url as string
}
