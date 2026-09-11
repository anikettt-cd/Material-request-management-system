import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRole }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="flex justify-center p-10">Loading...</div>;
    }

    // 🛑 If there is no user, kick them to the login page
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // 🛑 If role check fails, kick them out
    if (allowedRole && user.role !== allowedRole) {
        return <Navigate to="/unauthorized" replace />;
    }

    // ✅ If they pass all checks, render whatever child route they asked for!
    return <Outlet />; 
};

export default ProtectedRoute;