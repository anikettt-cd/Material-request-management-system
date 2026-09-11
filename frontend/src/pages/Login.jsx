import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import virajLogo from '../assets/viraj_logo.jpg';
const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const userData = await login(username, password);
            
            console.log("Logged in user data:", userData);

            if (userData.role === 'Creator') {
                navigate('/creator/tracking');
            } else if (userData.role === 'Plant_Head') {
                navigate('/approvals/plant-head');
            } else if (userData.role === 'Purchase') {
                navigate('/approvals/purchase');
            } else if (userData.role === 'Material_Head') {
                navigate('/approvals/material-head');
            } else if (userData.role === 'GST') {
                navigate('/approvals/gst');
            } else if (userData.role === 'Store') {
                navigate('/approvals/store');
            } else if (userData.role === 'IT_Admin') {
                navigate('/approvals/global');
            } else if (userData.role === 'Admin') {
                // 🎯 ADDED: Route for the Super Admin to access the User Management Dashboard
                navigate('/admin/users');
            } else {
                setError(`Unknown role detected: ${userData.role}. Please contact Admin.`);
            }
        } catch (err) {
            if (err.response?.data?.detail) setError(err.response.data.detail);
            else setError('Invalid credentials or server connection failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="flex justify-center mb-6">
                         {/* 🎯 Replaced the blue box with your official logo */}
                        <img src={virajLogo} alt="Viraj Logo" className="h-16 object-contain" />
                    </div>
                    <h2 className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight">Viraj Profiles Ltd.</h2>
                         <p className="mt-2 text-sm text-gray-500 font-medium">Material Request Management Portal</p>
                    
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-red-700 font-medium">{error}</span>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="employee.name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                {/* NOTE: Leaving this as type="password". If Chrome blocks it during testing, change to "text" temporarily! */}
                                <input
                                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        type="submit" disabled={isSubmitting}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {isSubmitting && <Loader2 className="animate-spin h-5 w-5 mr-2" />}
                        {isSubmitting ? 'Verifying...' : 'Secure Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;