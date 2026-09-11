import React, { createContext, useState, useEffect, useContext } from 'react';
import apiClient from '../services/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 🎯 JavaScript cannot read HttpOnly cookies, so we only check for UI data
        const storedUser = localStorage.getItem('user_data');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const formData = new URLSearchParams();
            formData.append('username', username); 
            formData.append('password', password);

            const response = await apiClient.post('/auth/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            // 🎯 The token is no longer in response.data (it's in the cookie!)
            // We only extract the non-sensitive UI details sent by the backend
            const { role, plant_id, department } = response.data;

            const userData = { username, role, plant_id, department };
            
            // We only save the UI data to localStorage
            localStorage.setItem('user_data', JSON.stringify(userData));
            
            setUser(userData);
            return userData;
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        // 🎯 No more access_token to remove! Just clear the UI data.
        localStorage.removeItem('user_data');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);