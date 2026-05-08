import { google } from 'googleapis'
import type { Readable } from 'stream'

function getDrive() {
	if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
		throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')
	}
	const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
	const auth = new google.auth.GoogleAuth({
		credentials,
		scopes: ['https://www.googleapis.com/auth/drive.file'],
	})
	return google.drive({ version: 'v3', auth })
}

export async function uploadStreamToDrive(
	stream: Readable,
	filename: string,
): Promise<{ fileId: string }> {
	const drive = getDrive()
	const requestBody: Record<string, unknown> = { name: filename }
	if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
		requestBody.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID]
	}
	const res = await drive.files.create({
		requestBody,
		media: { mimeType: 'video/webm', body: stream },
		fields: 'id',
	})
	return { fileId: res.data.id! }
}

export async function makeFilePublic(fileId: string): Promise<string> {
	const drive = getDrive()
	await drive.permissions.create({
		fileId,
		requestBody: { role: 'reader', type: 'anyone' },
	})
	return `https://drive.google.com/file/d/${fileId}/view`
}

export async function deleteFile(fileId: string): Promise<void> {
	const drive = getDrive()
	await drive.files.delete({ fileId })
}
