import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Building, Mail, Lock, Loader2, CheckCircle, Trash2, Edit2, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Form State (For Creating)
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('');
    const [plantId, setPlantId] = useState('');

    // 🎯 NEW STATE: For Tracking the User Being Edited
    const [editingUser, setEditingUser] = useState(null);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/admin/users');
            setUsers(response.data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setProcessing(true);
        
        try {
            const payload = {
                username,
                email,
                password,
                role,
                plant_id: plantId || null // Send null if empty
            };

            const response = await apiClient.post('/admin/create-user', payload);
            alert(response.data.message);
            
            // Reset form
            setUsername('');
            setEmail('');
            setPassword('');
            setRole('');
            setPlantId('');
            
            // Refresh table
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to create user. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`Are you sure you want to permanently delete ${username}?`)) {
            return; 
        }
 
        try {
            await apiClient.delete(`/admin/users/${userId}`);
            setUsers(prevUsers => prevUsers.filter(user => user.user_id !== userId));
            alert(`User ${username} deleted successfully.`);
        } catch (err) {
            console.error("Failed to delete user:", err);
            alert(err.response?.data?.detail || "Error deleting user.");
        } 
    };

    // 🎯 NEW FUNCTION: Handles the Edit Form Submission
    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                username: editingUser.username,
                email: editingUser.email,
                role: editingUser.role,
                plant_id: editingUser.plant_id || null,
                password: editingUser.new_password || "" // Send blank if no change
            };

            const response = await apiClient.put(`/admin/users/${editingUser.user_id}`, payload);
            alert(response.data?.message || "User updated successfully!");
            
            setEditingUser(null); // Close the modal
            fetchUsers(); // Refresh the table to show updated data
        } catch (error) {
            console.error("Failed to update user:", error);
            alert(error.response?.data?.detail || "Error updating user.");
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto pb-10 relative">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                    <Shield className="w-8 h-8 text-indigo-600" /> User Management
                </h1>
                <p className="text-gray-500 mt-1 text-base">Onboard new employees and manage system access roles.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT: CREATE USER FORM */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-24">
                        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-indigo-600" /> Onboard New User
                        </h2>
                        
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="h-4 w-4 text-gray-400" /></div>
                                    <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="john.doe" />
                                </div>
                                  {role === 'Material_Head' && (
                                       <p className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                                          ⚠️ Username MUST include "Mech" or "Elec" (e.g., Deepak_Mech)
                                       </p>
                                   )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-4 w-4 text-gray-400" /></div>
                                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="john@viraj.com" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-gray-400" /></div>
                                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="••••••••" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">System Role <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <select required value={role} onChange={(e) => setRole(e.target.value)} className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white cursor-pointer">
                                        <option value="" disabled>-- Select a precise role --</option>
                                        <option value="Creator">Creator (Initiates Data)</option>
                                        <option value="Plant_Head">Plant Head (L1 Approval)</option>
                                        <option value="Material_Head">Material Head (L2 Approval)</option>
                                        <option value="Purchase">Purchase (L3 Approval)</option>
                                        <option value="GST">GST & Audit (L4 Approval)</option>
                                        <option value="Store">Store Master (Generates Code)</option>
                                        <option value="IT_Admin">IT Admin (ERP Integration)</option>
                                        <option value="Admin">Super Admin (User Management)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plant ID (Optional)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Building className="h-4 w-4 text-gray-400" /></div>
                                    <input type="text" value={plantId} onChange={(e) => setPlantId(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="e.g., 1000" />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Leave blank for Global roles (IT, GST, Store).</p>
                            </div>

                            <button type="submit" disabled={processing} className="w-full mt-4 flex justify-center py-2.5 px-4 border border-transparent text-sm font-bold rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm disabled:opacity-50">
                                {processing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Create User'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* RIGHT: USER DIRECTORY TABLE */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900">Active Directory</h2>
                        </div>
                        
                        {loading ? (
                            <div className="flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-gray-400" /></div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">ID / User</th>
                                            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Assigned Role</th>
                                            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Plant</th>
                                            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {users.length > 0 ? (
                                            users.map((u) => (
                                                <tr key={u.user_id} className="hover:bg-gray-50/50">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-900">{u.username}</span>
                                                            <span className="text-xs text-gray-500">ID: #{u.user_id} | {u.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                            {u.role.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-mono text-gray-600 font-bold">
                                                        {u.plant_id || 'Global'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {u.is_active ? (
                                                            <span className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle className="w-3.5 h-3.5"/> Active</span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-gray-400">Inactive</span>
                                                        )}
                                                    </td>
                                                    {/* 🎯 Updated Actions Cell: Edit & Delete */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex justify-end space-x-4">
                                                            <button 
                                                                onClick={() => setEditingUser({ ...u, new_password: '' })}
                                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-900 font-bold transition-colors"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteUser(u.user_id, u.username)}
                                                                className="flex items-center gap-1 text-red-600 hover:text-red-900 font-bold transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" /> Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-medium">No users found in directory.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 🎯 EDIT USER MODAL OVERLAY */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-indigo-600" /> Edit User Profile
                            </h3>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" required
                                    value={editingUser.username}
                                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                                <input 
                                    type="email" required
                                    value={editingUser.email || ''}
                                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                                    <select 
                                        value={editingUser.role}
                                        onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                                    >
                                        <option value="Creator">Creator</option>
                                        <option value="Plant_Head">Plant Head</option>
                                        <option value="Material_Head">Material Head</option>
                                        <option value="Purchase">Purchase</option>
                                        <option value="GST">GST & Audit</option>
                                        <option value="Store">Store Master</option>
                                        <option value="IT_Admin">IT Admin</option>
                                        <option value="Admin">Super Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plant ID</label>
                                    <input 
                                        type="text" 
                                        value={editingUser.plant_id || ''}
                                        onChange={(e) => setEditingUser({...editingUser, plant_id: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        placeholder="Global"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reset Password</label>
                                <input 
                                    type="text" 
                                    placeholder="Leave blank to keep current password"
                                    value={editingUser.new_password}
                                    onChange={(e) => setEditingUser({...editingUser, new_password: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 text-sm"
                                />
                                <p className="text-xs text-amber-600 mt-1 font-medium">Typing a new password will instantly overwrite their old one.</p>
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-5 flex justify-end space-x-3 border-t border-gray-100 mt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 shadow-sm transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;