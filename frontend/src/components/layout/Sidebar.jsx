import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
// 🎯 ADDED: 'History' icon for the new Action History page
import { FilePlus, CheckCircle, LayoutDashboard, Activity, Database, FileText, Settings, List, Users, ShieldCheck, History } from 'lucide-react';
import virajLogo from '../../assets/viraj_logo.jpg';

const Sidebar = () => {
    const { user } = useAuth();

    // Helper function to style active vs inactive links using Tailwind
    const navLinkClass = ({ isActive }) => 
        `flex items-center gap-3 p-3 rounded-md transition-all font-medium ${
            isActive 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`;

    return (
        <div className="w-64 bg-gray-900 text-white h-screen flex flex-col sticky top-0">
            {/* Logo Area */}
            <div className="h-20 flex items-center justify-center px-4 border-b border-gray-800 bg-white">
                <img src={virajLogo} alt="Viraj Logo" className="h-12 object-contain" />
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                
                {/* 🎯 CREATOR Specific Links */}
                {user?.role === 'Creator' && (
                    <>
                        <NavLink to="/creator/new-request" className={navLinkClass}>
                            <FilePlus size={20} /> New Request
                        </NavLink>
                        <NavLink to="/creator/my-requests" className={navLinkClass}>
                            <List size={20} /> My Requests
                        </NavLink>
                        <NavLink to="/creator/tracking" className={navLinkClass}>
                            <Activity size={20} /> Track Status
                        </NavLink>
                    </>
                )}

                {/* 🎯 PLANT HEAD Specific Links */}
                {user?.role === 'Plant_Head' && (
                    <NavLink to="/approvals/plant-head" className={navLinkClass}>
                        <CheckCircle size={20} /> Plant Approvals
                    </NavLink>
                )}

                {/* 🎯 MATERIAL HEAD Specific Links */}
                {user?.role === 'Material_Head' && (
                    <NavLink to="/approvals/material-head" className={navLinkClass}>
                        <CheckCircle size={20} /> Material Approvals
                    </NavLink>
                )}

                {/* 🎯 PURCHASE Specific Links */}
                {user?.role === 'Purchase' && (
                    <NavLink to="/approvals/purchase" className={navLinkClass}>
                        <CheckCircle size={20} /> Purchase Approvals
                    </NavLink>
                )}

                {/* 🎯 GST Specific Links */}
                {user?.role === 'GST' && (
                    <NavLink to="/approvals/gst" className={navLinkClass}>
                        <FileText size={20} /> GST & Audit
                    </NavLink>
                )}

                {/* 🎯 STORE Specific Links */}
                {user?.role === 'Store' && (
                    <NavLink to="/approvals/store" className={navLinkClass}>
                        <Database size={20} /> Master Creation
                    </NavLink>
                )}

                {/* 🎯 SHARED APPROVER LINKS (Shows up for all roles above) */}
                {['Plant_Head', 'Material_Head', 'Purchase', 'GST', 'Store'].includes(user?.role) && (
                    <NavLink to="/approvals/history" className={navLinkClass}>
                        <History size={20} /> Action History
                    </NavLink>
                )}

                {/* 🎯 IT ADMIN Specific Links */}
                {user?.role === 'IT_Admin' && (
                    <>
                        <NavLink to="/approvals/global" className={navLinkClass}>
                            <Settings size={20} /> IT Dashboard
                        </NavLink>
                        <NavLink to="/approvals/audit" className={navLinkClass}>
                            <ShieldCheck size={20} /> Audit Trail
                        </NavLink>
                    </>
                )}

                {/* 🎯 SUPER ADMIN Specific Links */}
                {user?.role === 'Admin' && (
                    <NavLink to="/admin/users" className={navLinkClass}>
                        <Users size={20} /> User Management
                    </NavLink>
                )}
            </nav>
        </div>
    );
};

export default Sidebar;