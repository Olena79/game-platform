const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface AuthUser {
	id: string
	name: string
	surname?: string
	email: string
	phone?: string
}

export interface AuthResponse {
	token: string
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
	phone: string,
	password: string,
): Promise<AuthResponse> =>
	fetch(`${API}/api/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, surname, email, phone, password }),
	}).then(handleResponse<AuthResponse>)

export const getMeRequest = (token: string): Promise<AuthUser> =>
	fetch(`${API}/api/auth/me`, {
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<AuthUser>)

export const googleAuthRequest = (credential: string): Promise<AuthResponse> =>
	fetch(`${API}/api/auth/google`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ credential }),
	}).then(handleResponse<AuthResponse>)
