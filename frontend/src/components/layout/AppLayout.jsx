import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../../context/AuthContext';

const AppLayout = () => {
    const { user, loading } = useAuth();

    // Prevent rendering while checking local storage for credentials
    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading Secure Portal...</div>;
    }
    
    // Security check: If no user is logged in, forcefully redirect to login page
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen bg-gray-50 w-full overflow-hidden">
            {/* Persistent Sidebar */}
            <Sidebar />
            
            {/* Main Content Column */}
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                
                {/* Scrollable Dashboard Area */}
                <main className="flex-1 overflow-y-auto p-6">
                    {/* <Outlet /> is where React Router injects the active page */}
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;