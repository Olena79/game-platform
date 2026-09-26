const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface AuthUser {
	id: string
	name: string
	surname?: string
	email: string
	telegramConnected?: boolean
}

export interface AuthResponse {
	accessToken: string
	refreshToken: string
	user: AuthUser
}

async function handleResponse<T>(res: Response): Promise<T> {
	const data = await res.json()
	if (!res.ok) throw new Error(data.message || 'Request failed')
	return data as T
}

export const loginRequest = (email: string, password: string): Promise<AuthResponse> =>
	fetch(`${API}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	}).then(handleResponse<AuthResponse>)

export const registerRequest = (
	name: string,
	surname: string,
	email: string,
	password: string,
): Promise<AuthResponse> =>
	fetch(`${API}/api/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, surname, email, password }),
	}).then(handleResponse<AuthResponse>)

export const getMeRequest = (token: string): Promise<AuthUser> =>
	fetch(`${API}/api/auth/me`, {
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<AuthUser>)

/** Always resolves the same way, whether or not the account exists. */
export const forgotPasswordRequest = (email: string) =>
	fetch(`${API}/api/auth/forgot-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email }),
	}).then(handleResponse<{ ok: boolean }>)

export const resetPasswordRequest = (token: string, password: string) =>
	fetch(`${API}/api/auth/reset-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token, password }),
	}).then(handleResponse<{ ok: boolean }>)

export const exportAccountRequest = (authToken: string) =>
	fetch(`${API}/api/account/export`, {
		headers: { Authorization: `Bearer ${authToken}` },
	}).then(handleResponse<Record<string, unknown>>)

/** Irreversible. The password is required for accounts that have one. */
export const deleteAccountRequest = (authToken: string, password?: string) =>
	fetch(`${API}/api/account`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
		body: JSON.stringify({ password, confirm: true }),
	}).then(handleResponse<{ ok: boolean }>)

export const googleAuthRequest = (idToken: string): Promise<AuthResponse> =>
	fetch(`${API}/api/auth/google`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token: idToken }),
	}).then(handleResponse<AuthResponse>)

export const getTelegramStatusRequest = (token: string): Promise<{ telegramConnected: boolean }> =>
	fetch(`${API}/api/telegram/status`, {
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ telegramConnected: boolean }>)

export const updateNameRequest = (token: string, name: string, surname: string): Promise<AuthUser> =>
	fetch(`${API}/api/auth/me`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ name, surname }),
	}).then(handleResponse<AuthUser>)
