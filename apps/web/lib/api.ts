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

export const authAPI = {
    signup: (username: string, password: string, type: string) => api.post('/signup', { username, password, type }),
    signin: (username: string, password: string) => api.post('/signin', { username, password }),
};

// User APIs
export const userAPI = {
    updateMetadata: (avatarId: string) => api.post('/user/metadata', { avatarId }),
    getBulkMetadata: (userIds: string) => api.get(`/user/metadata/bulk?ids=[${userIds}]`),
};

// Space APIs
export const spaceAPI = {
    createSpace: (name: string, dimensions: string, mapId: string) => api.post('/space', { name, dimensions, mapId }),
    getAllSpaces: () => api.get('/space/all'),
    getSpace: (spaceId: string) => api.get(`/space/${spaceId}`),
    deleteSpace: (spaceId: string) => api.delete(`/space/${spaceId}`),
    addElement: (elementId: string, spaceId: string, x: number, y: number) => api.post('/space/element', { elementId, spaceId, x, y }),
    deleteElement: (id: string) => api.delete('/space/element', { data: { id } }),
};

// Avatar APIs
export const avatarAPI = {
    getAvatars: () => api.get('/avatars'),
    getUserAvatar : (id: string) => api.get('/avatar' , {
        params: {
            id
        }
    }),
};

export const elementAPI = {
    getElements: () => api.get('/elements'),
}

export const mapAPI = {
    getMaps: () => api.get('/maps'),
}


// Admin APIs
export const adminAPI = {
    createAvatar: (imageUrl: string, name: string) => api.post('/admin/avatar', { imageUrl, name }),
    createElement: (imageUrl: string, width: number, height: number, isStatic: boolean) => api.post('/admin/element', {
        imageUrl, width, height, static: isStatic
    }),
    updateElement: (elementId: string, imageUrl : string) => api.put(`/admin/element/${elementId}`, { imageUrl }),
    createMap: (thumbnail: string, dimensions: string, name: string, defaultElement: defaultElement[]) => api.post('/admin/map', {
        thumbnail, dimensions, name, defaultElement
    }),
    getMaps: () => api.get('/admin/maps'),
};

export default api;