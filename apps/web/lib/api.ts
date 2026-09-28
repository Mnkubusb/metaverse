import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export interface defaultElement {
    elementId: string;
    x: number;
    y: number;
}

const api = axios.create({
    baseURL: API_URL
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// An expired or invalid session: clear it and send the user to log in again.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url: string = error.config?.url ?? '';
        if (error.response?.status === 401 && !url.startsWith('/signin') && !url.startsWith('/signup')
            && typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            }
        }
        return Promise.reject(error);
    }
);

export const authAPI = {
    signup: (username: string, password: string) => api.post('/signup', { username, password }),
    signin: (username: string, password: string) => api.post('/signin', { username, password }),
};

// User APIs
export const userAPI = {
    getUsers: () => api.get('/users'),
    updateMetadata: (avatarId: string) => api.post('/user/metadata', { avatarId }),
    getBulkMetadata: (userIds: string[]) => api.get(`/user/metadata/bulk?ids=${encodeURIComponent(JSON.stringify(userIds))}`),
};

// Space APIs
export type Visibility = 'Private' | 'Unlisted' | 'Public';

export const spaceAPI = {
    createSpace: (name: string, dimensions: string, mapId: string, visibility: Visibility = 'Unlisted') =>
        api.post('/space', { name, dimensions, mapId, visibility }),
    getAllSpaces: () => api.get('/space/all'),
    getJoinedSpaces: () => api.get('/space/joined'),
    explore: (page = 1) => api.get('/space/explore', { params: { page } }),
    getSpace: (spaceId: string) => api.get(`/space/${spaceId}`),
    joinSpace: (spaceId: string, inviteCode?: string) => api.post(`/space/${spaceId}/join`, { inviteCode }),
    updateSpace: (spaceId: string, data: { name?: string; visibility?: Visibility }) => api.patch(`/space/${spaceId}`, data),
    resetInvite: (spaceId: string) => api.post(`/space/${spaceId}/invite/reset`),
    getMembers: (spaceId: string) => api.get(`/space/${spaceId}/members`),
    removeMember: (spaceId: string, userId: string) => api.delete(`/space/${spaceId}/members/${userId}`),
    deleteSpace: (spaceId: string) => api.delete(`/space/${spaceId}`),
    addElement: (elementId: string, spaceId: string, x: number, y: number) => api.post('/space/element', { elementId, spaceId, x, y }),
    deleteElement: (id: string) => api.delete('/space/element', { data: { id } }),
};

export const noticeAPI = {
    list: (spaceId: string, boardId: string) => api.get(`/space/${spaceId}/boards/${boardId}/notices`),
    post: (spaceId: string, boardId: string, body: string, color: string) =>
        api.post(`/space/${spaceId}/boards/${boardId}/notices`, { body, color }),
    remove: (spaceId: string, noticeId: string) => api.delete(`/space/${spaceId}/notices/${noticeId}`),
};

// Link someone can open to enter the space; private spaces need the owner's invite code in it.
export function inviteLink(spaceId: string, inviteCode?: string | null) {
    const url = new URL(`/space/${spaceId}`, window.location.origin);
    if (inviteCode) url.searchParams.set('invite', inviteCode);
    return url.toString();
}

// Avatar APIs
export const avatarAPI = {
    getAvatars: () => api.get('/avatars'),
    getUserAvatar : (id: string) => api.get('/avatar' , {
        params: {
            id
        }
    }),
};

// The /elements endpoint is paginated (max 100 per page); callers here need the whole catalogue.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAllElements(): Promise<{ data: { elements: any[] } }> {
    const elements = [];
    for (let page = 1; ; page++) {
        const res = await api.get('/elements', { params: { page, limit: 100 } });
        elements.push(...res.data.elements);
        if (res.data.elements.length < 100) {
            return { data: { elements } };
        }
    }
}

export const elementAPI = {
    getElements: getAllElements,
}

export const mapAPI = {
    getMaps: () => api.get('/maps'),
}


// Admin APIs
export const adminAPI = {
    createAvatar: (imageUrl: string, name: string) => api.post('/admin/avatar', { imageUrl, name }),
    createElement: (imageUrl: string, width: number, height: number, isStatic: boolean , layer : string) => api.post('/admin/element', {
        imageUrl, width, height, static: isStatic , layer
    }),
    updateElement: (elementId: string, imageUrl : string) => api.put(`/admin/element/${elementId}`, { imageUrl }),
    createMap: (thumbnail: string, dimensions: string, name: string, defaultElement: defaultElement[]) => api.post('/admin/map', {
        thumbnail, dimensions, name, defaultElement
    }),
    getMaps: () => api.get('/admin/maps'),
};

export default api;