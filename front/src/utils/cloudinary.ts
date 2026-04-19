export async function uploadToCloudinary(file: File): Promise<string> {
	const cloud  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
	const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string
	const fd = new FormData()
	fd.append('file', file)
	fd.append('upload_preset', preset)
	const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd })
	const data = await res.json()
	if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
	return data.secure_url as string
}
