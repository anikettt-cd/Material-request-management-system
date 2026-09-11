import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="text-gray-600 font-medium">
                Welcome back, <span className="text-gray-900 font-bold">{user?.username || 'User'}</span>
            </div>
            <div className="flex items-center gap-4">
                {/* Role Badge */}
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-semibold text-blue-700 border border-blue-100">
                    <User size={16} />
                    {user?.role?.replace('_', ' ')}
                </div>
                
                {/* Logout Button */}
                <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors px-3 py-2 rounded-md hover:bg-red-50 text-sm font-medium"
                >
                    <LogOut size={18} />
                    Logout
                </button>
            </div>
        </header>
    );
};

export default Navbar;