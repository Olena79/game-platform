const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface PostData {
	_id: string
	authorId: string
	authorName: string
	authorSurname: string
	topic: string
	text: string
	likesCount: number
	isLiked: boolean
	commentsCount: number
	editedAt?: string
	createdAt: string
	updatedAt: string
}

export interface CommentData {
	_id: string
	postId: string
	parentId: string | null
	authorId: string
	authorName: string
	authorSurname: string
	text: string
	likesCount: number
	isLiked: boolean
	editedAt?: string
	createdAt: string
	updatedAt: string
}

async function handle<T>(res: Response): Promise<T> {
	const data = await res.json()
	if (!res.ok) throw new Error(data.message || 'Error')
	return data as T
}

export const getPosts = (
	sort: 'new' | 'popular',
	skip: number,
	limit = 20,
	token?: string,
): Promise<{ posts: PostData[]; total: number; hasMore: boolean }> =>
	fetch(`${API}/api/community/posts?sort=${sort}&skip=${skip}&limit=${limit}`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	}).then(handle)

export const createPost = (
	token: string,
	body: { topic: string; text: string },
): Promise<PostData> =>
	fetch(`${API}/api/community/posts`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(body),
	}).then(handle)

export const updatePost = (
	token: string,
	id: string,
	body: { topic?: string; text?: string },
): Promise<PostData> =>
	fetch(`${API}/api/community/posts/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(body),
	}).then(handle)

export const deletePost = (token: string, id: string): Promise<{ ok: boolean }> =>
	fetch(`${API}/api/community/posts/${id}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handle)

export const likePost = (token: string, id: string): Promise<{ postId: string; likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/community/posts/${id}/like`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handle)

export const unlikePost = (token: string, id: string): Promise<{ postId: string; likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/community/posts/${id}/like`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handle)

export const getComments = (postId: string, token?: string): Promise<CommentData[]> =>
	fetch(`${API}/api/community/posts/${postId}/comments`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	}).then(handle)

export const createComment = (
	token: string,
	postId: string,
	body: { text: string; parentId?: string },
): Promise<CommentData> =>
	fetch(`${API}/api/community/posts/${postId}/comments`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(body),
	}).then(handle)

export const updateComment = (token: string, id: string, text: string): Promise<CommentData> =>
	fetch(`${API}/api/community/comments/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ text }),
	}).then(handle)

export const deleteComment = (token: string, id: string): Promise<{ ok: boolean }> =>
	fetch(`${API}/api/community/comments/${id}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handle)

export const likeComment = (token: string, id: string): Promise<{ commentId: string; likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/community/comments/${id}/like`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handle)

export const unlikeComment = (token: string, id: string): Promise<{ commentId: string; likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/community/comments/${id}/like`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handle)
