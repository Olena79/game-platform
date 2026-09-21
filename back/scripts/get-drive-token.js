/**
 * One-time helper: turns an OAuth client into a refresh token for the account
 * that will own the recordings.
 *
 * A service account cannot be used here — it has no Drive storage of its own,
 * so every upload fails with 'storageQuotaExceeded'. Uploading as a real
 * account is the only option outside Google Workspace.
 *
 * Usage:
 *   1. Google Cloud console → APIs & Services → Credentials → Create
 *      credentials → OAuth client ID → Desktop app.
 *   2. Put the pair in back/.env:
 *        GOOGLE_OAUTH_CLIENT_ID=...
 *        GOOGLE_OAUTH_CLIENT_SECRET=...
 *   3. node --env-file=.env scripts/get-drive-token.js
 *   4. Approve in the browser, then copy the printed refresh token into
 *      GOOGLE_OAUTH_REFRESH_TOKEN (locally and on the server).
 */
const http = require('http')
const { google } = require('googleapis')

const PORT = 5555
const REDIRECT = `http://localhost:${PORT}`
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } = process.env
if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
	console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in back/.env first.')
	process.exit(1)
}

const oauth2 = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, REDIRECT)

const authUrl = oauth2.generateAuthUrl({
	access_type: 'offline',     // this is what makes Google hand back a refresh token
	prompt: 'consent',          // force it even if the app was approved before
	scope: [SCOPE],
})

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, REDIRECT)
	const code = url.searchParams.get('code')
	const error = url.searchParams.get('error')

	if (error) {
		res.end(`Authorisation failed: ${error}. You can close this tab.`)
		console.error('\nDenied:', error)
		server.close()
		return
	}
	if (!code) { res.end('Waiting for the authorisation code...'); return }

	try {
		const { tokens } = await oauth2.getToken(code)
		res.end('Done. You can close this tab and go back to the terminal.')
		console.log('\n────────────────────────────────────────────────')
		if (tokens.refresh_token) {
			console.log('GOOGLE_OAUTH_REFRESH_TOKEN=' + tokens.refresh_token)
			console.log('\nPut that line in back/.env and in the server environment.')
		} else {
			console.log('Google returned no refresh token. Remove this app at')
			console.log('https://myaccount.google.com/permissions and run the script again.')
		}
		console.log('────────────────────────────────────────────────')
	} catch (err) {
		res.end('Token exchange failed, see the terminal.')
		console.error('\nToken exchange failed:', err.message)
	}
	server.close()
})

server.listen(PORT, () => {
	console.log('Open this URL, sign in with the account that should own the recordings:\n')
	console.log(authUrl + '\n')
	console.log(`Waiting on ${REDIRECT} ...`)
})
