import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute'; 

// Creator Dashboards
import MyRequests from './pages/CreatorWorkspace/MyRequests';
import NewRequestForm from './pages/CreatorWorkspace/NewRequestForm';
import EditRequestForm from './pages/CreatorWorkspace/EditRequestForm';
import TrackRequests from "./pages/CreatorWorkspace/TrackRequests";

// Approvals Dashboards
import PlantHeadDashboard from './pages/Approvals/PlantHeadDashboard';
import MaterialHeadDashboard from './pages/Approvals/MaterialHeadDashboard'; 
import PurchaseDashboard from './pages/Approvals/PurchaseDashboard';
import GstDashboard from './pages/Approvals/GstDashboard';
import StoreDashboard from './pages/Approvals/StoreDashboard';

import GlobalDashboard from './pages/Approvals/GlobalDashboard';
import GlobalAuditPage from './pages/Approvals/GlobalAuditPage';
import AdminDashboard from './pages/Admin/AdminDashboard';
import History from './pages/Approvals/History';


function App() {
  return (
    <Routes>
      {/* 🟢 PUBLIC ROUTES */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      
      {/* 🔴 UNAUTHORIZED FALLBACK */}
      <Route path="/unauthorized" element={
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
          <h1 className="text-3xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
          <a href="/login" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">Return to Login</a>
        </div>
      } />
      
      {/* 🛡️ SECURITY LEVEL 1: Check if anyone is logged in at all */}
      <Route element={<ProtectedRoute />}>
          
          {/* 🎨 LAYOUT: If logged in, draw the sidebar and top navbar */}
          <Route element={<AppLayout />}>
          <Route path="/approvals/history" element={<History />} />

              
              {/* 🛡️ SECURITY LEVEL 2: CREATOR ONLY */}
              <Route element={<ProtectedRoute allowedRole="Creator" />}>
                  <Route path="/creator/new-request" element={<NewRequestForm />} />
                  <Route path="/creator/edit-request/:id" element={<EditRequestForm />} />
                  <Route path="/creator/my-requests" element={<MyRequests />} />
                  <Route path="/creator/tracking" element={<TrackRequests />} />
              </Route>
              
              {/* 🛡️ SECURITY LEVEL 2: PLANT HEAD ONLY */}
              <Route element={<ProtectedRoute allowedRole="Plant_Head" />}>
                  <Route path="/approvals/plant-head" element={<PlantHeadDashboard />} />
              </Route>

              {/* 🛡️ SECURITY LEVEL 2: MATERIAL HEAD ONLY */}
              <Route element={<ProtectedRoute allowedRole="Material_Head" />}>
                  <Route path="/approvals/material-head" element={<MaterialHeadDashboard />} />
              </Route>

              {/* 🛡️ SECURITY LEVEL 2: PURCHASE ONLY */}
              <Route element={<ProtectedRoute allowedRole="Purchase" />}>
                  <Route path="/approvals/purchase" element={<PurchaseDashboard />} />
              </Route>

              {/* 🛡️ SECURITY LEVEL 2: GST ONLY */}
              <Route element={<ProtectedRoute allowedRole="GST" />}>
                  <Route path="/approvals/gst" element={<GstDashboard />} />
              </Route>

              {/* 🛡️ SECURITY LEVEL 2: STORE ONLY */}
              <Route element={<ProtectedRoute allowedRole="Store" />}>
                  <Route path="/approvals/store" element={<StoreDashboard />} />
              </Route>
              
              {/* 🛡️ SECURITY LEVEL 2: IT ADMIN ONLY */}
              <Route element={<ProtectedRoute allowedRole="IT_Admin" />}>
                  <Route path="/approvals/audit" element={<GlobalAuditPage />} />
                  <Route path="/approvals/global" element={<GlobalDashboard />} />
              </Route>

              {/* 🛡️ SECURITY LEVEL 2: ADMIN ONLY */}
              <Route element={<ProtectedRoute allowedRole="Admin" />}>
                  <Route path="/admin/users" element={<AdminDashboard />} />
              </Route>

          </Route>
          
      </Route>

      {/* Catch-all for random URLs */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;