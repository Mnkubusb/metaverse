import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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

export const authAPI = {
    signup: (username: string, password: string, type: string) => api.post('/api/v1/signup', { username, password, type }),
    signin: (username: string, password: string) => api.post('/api/v1/signin', { username, password }),
};

// User APIs
export const userAPI = {
    updateMetadata: (avatarId: string) => api.post('/api/v1/user/metadata', { avatarId }),
    getBulkMetadata: (userIds: string) => api.get(`/api/v1/user/metadata/bulk?ids=[${userIds}]`),
};

// Space APIs
export const spaceAPI = {
    createSpace: (name: string, dimensions: string, mapId: string) => api.post('/api/v1/space', { name, dimensions, mapId }),
    getAllSpaces: () => api.get('/api/v1/space/all'),
    getSpace: (spaceId: string) => api.get(`/api/v1/space/${spaceId}`),
    deleteSpace: (spaceId: string) => api.delete(`/api/v1/space/${spaceId}`),
    addElement: (elementId: string, spaceId: string, x: number, y: number) => api.post('/api/v1/space/element', { elementId, spaceId, x, y }),
    deleteElement: (id: string) => api.delete('/api/v1/space/element', { data: { id } }),
};

// Avatar APIs
export const avatarAPI = {
    getAvatars: () => api.get('/api/v1/avatars'),
};

export const elementAPI = {
    getElements: () => api.get('/api/v1/elements'),
}

export const mapAPI = {
    getMaps: () => api.get('/api/v1/maps'),
}

// Admin APIs
export const adminAPI = {
    createAvatar: (imageUrl: string, name: string) => api.post('/api/v1/admin/avatar', { imageUrl, name }),
    createElement: (imageUrl: string, width: number, height: number, isStatic: boolean) => api.post('/api/v1/admin/element', {
        imageUrl, width, height, static: isStatic
    }),
    updateElement: (elementId: string, imageUrl : string) => api.put(`/api/v1/admin/element/${elementId}`, { imageUrl }),
    createMap: (thumbnail: string, dimensions: string, name: string, defaultElement: defaultElement[]) => api.post('/api/v1/admin/map', {
        thumbnail, dimensions, name, defaultElement
    }),
};

export default api;