import axios from 'axios';

const apiClient = axios.create({
    // Using '/api' ensures requests go to 192.168.100.57/api
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000', 
    headers: {
        'Content-Type': 'application/json',
    },
    // THE UPGRADE: This tells the browser to automatically send the HttpOnly cookie
    withCredentials: true 
});

// 🎯 THE TRIPWIRE: Catch 401 Unauthorized errors globally
apiClient.interceptors.response.use(
    (response) => {
        // If the backend allows the request, just pass the data through normally
        return response;
    },
    (error) => {
        // If the backend rejects the request because the cookie is missing/expired
        if (error.response && error.response.status === 401) {
            
            // 1. Erase the ghost data from localStorage
            localStorage.removeItem('user_data');
            
            // 2. Force the browser to redirect to the login page
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;