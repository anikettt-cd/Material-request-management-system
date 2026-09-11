import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, CheckCircle, XCircle, Loader2, Database, MapPin, Power, AlertOctagon, Edit, X, Download, Check, Save } from 'lucide-react';
import apiClient from '../../services/apiClient';

const GlobalDashboard = () => {
    const [data, setData] = useState({ stats: {}, requests: [] });
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const [rejectModal, setRejectModal] = useState({ isOpen: false, requestId: null, reason: '' });
    const [actionModal, setActionModal] = useState({ isOpen: false, mode: '', requestData: null });

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/it-department/dashboard-data');
            setData(response.data);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // 🎯 STEP 1b: Approve Request
    const handleApproveRequest = async (requestId) => {
        if (!window.confirm(`Approve Request #${requestId}? This will flag it for SAP export.`)) return;
        
        try {
            setProcessing(true);
            const response = await apiClient.post(`/it-department/approve/${requestId}`);
            alert(response.data.message);
            fetchDashboardData();
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to approve request.");
        } finally {
            setProcessing(false);
        }
    };

    // 🎯 STEP 2: Row-Level Export Function
    const handleSingleExportExcel = async (requestId) => {
        try {
            setProcessing(true);
            const response = await apiClient.get(`/it-department/export-single/${requestId}`, { responseType: 'blob' });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Request_${requestId}_SAP_Data.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert("Failed to export Excel file for this request.");
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkExport = async () => {
        try {
            setProcessing(true);
            // Hit the new Python route
            const response = await apiClient.get('/it-department/export-bulk-ready', { responseType: 'blob' });
            
            // Create a Blob from the binary stream
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // Set dynamic filename
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `Viraj_SAP_Ready_BulkData_${dateStr}.xlsx`);
            
            // Click the link to trigger the browser download
            document.body.appendChild(link);
            link.click();
            
            // Clean up DOM and memory
            link.remove();
            window.URL.revokeObjectURL(url);
            
        } catch (error) {
            // Check if the backend threw a 404 (No data found)
            if (error.response && error.response.status === 404) {
                alert("No ready requests currently in the queue to export.");
            } else {
                alert("Failed to export bulk Excel file from the server.");
                console.error("Bulk Export Error:", error);
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleOverrideChange = (field, value) => {
        setActionModal(prev => ({
            ...prev,
            requestData: { ...prev.requestData, [field]: value }
        }));
    };

    // 🎯 STEP 1a: Save Edits
    const handleSaveEdits = async () => {
        const reqData = actionModal.requestData;
        try {
            setProcessing(true);
            const response = await apiClient.put(`/it-department/update/${reqData.request_id}`, reqData);
            alert(response.data.message || "Edits saved successfully.");
            setActionModal({ isOpen: false, mode: '', requestData: null });
            fetchDashboardData(); 
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to save edits.");
        } finally {
            setProcessing(false);
        }
    };

    // 🎯 STEP 3: Finalize & Sync to master_data_library
    const handleFinalizeAndAdd = async () => {
        const reqData = actionModal.requestData;

        if (!reqData.generated_material_code || reqData.generated_material_code.trim() === '') {
            return alert("Wait! You must enter the Generated SAP Material Code.");
        }

        if (!window.confirm(`Finalize Request #${reqData.request_id} with SAP code ${reqData.generated_material_code}? This will officially add the Code and Description to the Master Data Library.`)) return;
        
        try {
            setProcessing(true);
            const response = await apiClient.post(`/it-department/finalize/${reqData.request_id}`, reqData);
            alert(response.data.message || "Successfully added to Master Data Library.");
            setActionModal({ isOpen: false, mode: '', requestData: null });
            fetchDashboardData(); 
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to finalize material.");
        } finally {
            setProcessing(false);
        }
    };

    const submitEmergencyReject = async () => {
        if (!rejectModal.reason.trim()) return alert("A reason is required for an emergency override.");
        
        try {
            setProcessing(true);
            const response = await apiClient.post(`/it-department/override-reject/${rejectModal.requestId}?reason=${encodeURIComponent(rejectModal.reason)}`);
            alert(response.data.message);
            setRejectModal({ isOpen: false, requestId: null, reason: '' });
            fetchDashboardData();
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to execute override.");
        } finally {
            setProcessing(false);
        }
    };

    const getStatusStyle = (status) => {
        if (status === 'Active / Live' || status === 'Completed') return 'bg-green-100 text-green-800 border-green-200';
        if (status === 'Pending IT') return 'bg-purple-100 text-purple-800 border-purple-200';
        if (status === 'Ready for SAP') return 'bg-blue-100 text-blue-800 border-blue-200';
        if (status === 'Rejected') return 'bg-red-100 text-red-800 border-red-200';
        if (status === 'Returned') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-12 h-12 animate-spin text-gray-800" /></div>;
    }

    return (
        <div className="max-w-[1600px] mx-auto pb-10 px-4 md:px-8">
            <div className="mb-8 pt-6">
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                    <LayoutDashboard className="w-8 h-8 text-gray-800" /> Global IT Dashboard
                </h1>
                <p className="text-gray-500 mt-1 text-base">Company-wide master data queue, ERP integration, and legacy synchronization.</p>
            </div>

            {/* ANALYTICS CARDS (Full Width) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-gray-100 text-gray-700 rounded-lg"><Database className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase">Total Volume</p>
                        <h3 className="text-2xl font-black text-gray-900">{data.stats.total_requests || 0}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-700 rounded-lg"><Activity className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase">Pending IT</p>
                        <h3 className="text-2xl font-black text-gray-900">{data.stats.active_requests || 0}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-700 rounded-lg"><Download className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase">Ready for SAP</p>
                        <h3 className="text-2xl font-black text-gray-900">{data.requests.filter(r => r.status === 'Ready for SAP').length || 0}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-700 rounded-lg"><CheckCircle className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase">Completed</p>
                        <h3 className="text-2xl font-black text-gray-900">{data.stats.completed_requests || 0}</h3>
                    </div>
                </div>
            </div>

            {/* 🎯 MAIN LAYOUT: Full-Width Table */}
            <div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">Master Data Pipeline</h2>
                        
                        {/* 🎯 NEW BULK EXPORT BUTTON ADDED HERE */}
                        <button 
                            onClick={handleBulkExport}
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
                        >
                            <Download className="w-4 h-4" /> Export All Ready Data
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Req ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Plant / Desc</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">SAP Code</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase">IT Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {data.requests.length > 0 ? (
                                    data.requests.map((req) => (
                                        <tr key={req.request_id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4 text-sm font-black text-gray-900">#{req.request_id}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400"/> {req.plant_id}</span>
                                                    <span className="text-xs font-semibold text-gray-600">{req.material_description}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded text-xs font-extrabold uppercase border ${getStatusStyle(req.status)}`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900">
                                                {req.generated_material_code || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    
                                                    {req.current_stage === 'IT_Stage' && req.status === 'Pending IT' && (
                                                        <>
                                                            <button 
                                                                onClick={() => setActionModal({ isOpen: true, mode: 'edit', requestData: req })}
                                                                disabled={processing}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-300 rounded-md text-xs font-bold hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50"
                                                            >
                                                                <Edit className="w-3.5 h-3.5" /> Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => handleApproveRequest(req.request_id)}
                                                                disabled={processing}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-bold hover:bg-blue-100 transition-colors shadow-sm disabled:opacity-50"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> Approve
                                                            </button>
                                                        </>
                                                    )}

                                                    {req.current_stage === 'IT_Stage' && req.status === 'Ready for SAP' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleSingleExportExcel(req.request_id)}
                                                                disabled={processing}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm disabled:opacity-50"
                                                                title="Export this specific request to Excel"
                                                            >
                                                                <Download className="w-3.5 h-3.5" /> Export
                                                            </button>
                                                            <button 
                                                                onClick={() => setActionModal({ isOpen: true, mode: 'sync', requestData: req })}
                                                                disabled={processing}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-bold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                                            >
                                                                <Database className="w-3.5 h-3.5" /> Enter Code
                                                            </button>
                                                        </>
                                                    )}

                                                    {req.status !== 'Rejected' && req.status !== 'Active / Live' && req.status !== 'Completed' && (
                                                        <button 
                                                            onClick={() => setRejectModal({ isOpen: true, requestId: req.request_id, reason: '' })}
                                                            disabled={processing}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                                                            title="Emergency System Override"
                                                        >
                                                            <AlertOctagon className="w-3.5 h-3.5" /> Override
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-medium">No requests found in the system.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 🎯 ACTION MODAL */}
            {actionModal.isOpen && actionModal.requestData && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
                        <div className={`p-6 border-b border-gray-200 rounded-t-xl flex justify-between items-center ${actionModal.mode === 'sync' ? 'bg-green-50' : 'bg-gray-50'}`}>
                            <div>
                                <h3 className={`text-xl font-black flex items-center gap-2 ${actionModal.mode === 'sync' ? 'text-green-900' : 'text-gray-900'}`}>
                                    {actionModal.mode === 'sync' ? <Database className="w-6 h-6" /> : <Edit className="w-6 h-6" />} 
                                    {actionModal.mode === 'sync' ? 'Enter SAP Code & Finalize' : 'Edit Request Details'}
                                </h3>
                                <p className={`text-sm mt-1 ${actionModal.mode === 'sync' ? 'text-green-700' : 'text-gray-500'}`}>
                                    Request #{actionModal.requestData.request_id}
                                </p>
                            </div>
                            <button onClick={() => setActionModal({ isOpen: false, mode: '', requestData: null })} className="text-gray-500 hover:bg-gray-200 p-2 rounded-lg transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-gray-50 flex-grow">
                            
                            {actionModal.mode === 'sync' && (
                                <div className="bg-white p-5 rounded-lg border-2 border-indigo-200 mb-6 shadow-sm">
                                    <label className="block text-sm font-black text-indigo-900 mb-2">Generated SAP Material Code <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g., 300012345"
                                        value={actionModal.requestData.generated_material_code || ''} 
                                        onChange={(e) => handleOverrideChange('generated_material_code', e.target.value)} 
                                        className="w-full border-2 border-indigo-300 rounded-md p-3 text-lg font-mono font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all" 
                                    />
                                    <p className="text-xs font-bold text-indigo-600 mt-2">⚠️ Submitting this will push the code and description to the Master Data Library.</p>
                                </div>
                            )}

                            <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 ${actionModal.mode === 'sync' ? 'opacity-70' : ''}`}>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Material Description</label>
                                    <input type="text" value={actionModal.requestData.material_description || ''} onChange={(e) => handleOverrideChange('material_description', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Material Type</label>
                                    <input type="text" value={actionModal.requestData.material_type || ''} onChange={(e) => handleOverrideChange('material_type', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Plant ID</label>
                                    <input type="text" value={actionModal.requestData.plant_id || ''} onChange={(e) => handleOverrideChange('plant_id', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Storage Location</label>
                                    <input type="text" value={actionModal.requestData.storage_location || ''} onChange={(e) => handleOverrideChange('storage_location', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Base UOM</label>
                                    <input type="text" value={actionModal.requestData.base_unit_of_measure || ''} onChange={(e) => handleOverrideChange('base_unit_of_measure', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Material Group</label>
                                    <input type="text" value={actionModal.requestData.material_group || ''} onChange={(e) => handleOverrideChange('material_group', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Purchasing Group</label>
                                    <input type="text" value={actionModal.requestData.purchasing_group || ''} onChange={(e) => handleOverrideChange('purchasing_group', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Tax Code (GST)</label>
                                    <input type="text" value={actionModal.requestData.control_code_gst || ''} onChange={(e) => handleOverrideChange('control_code_gst', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Sales Org</label>
                                    <input type="text" value={actionModal.requestData.sales_org || ''} onChange={(e) => handleOverrideChange('sales_org', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Dist Channel</label>
                                    <input type="text" value={actionModal.requestData.dist_channel || ''} onChange={(e) => handleOverrideChange('dist_channel', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Val Category</label>
                                        <input type="text" value={actionModal.requestData.valuation_category || ''} onChange={(e) => handleOverrideChange('valuation_category', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Val Class</label>
                                        <input type="text" value={actionModal.requestData.valuation_class || ''} onChange={(e) => handleOverrideChange('valuation_class', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Long Description</label>
                                    <textarea value={actionModal.requestData.long_description || ''} onChange={(e) => handleOverrideChange('long_description', e.target.value)} rows="2" className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl flex justify-end gap-3">
                            <button onClick={() => setActionModal({ isOpen: false, mode: '', requestData: null })} className="px-5 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                            
                            {actionModal.mode === 'edit' ? (
                                <button onClick={handleSaveEdits} disabled={processing} className="px-6 py-2 flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors">
                                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Edits
                                </button>
                            ) : (
                                <button onClick={handleFinalizeAndAdd} disabled={processing} className="px-6 py-2 flex items-center gap-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors">
                                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Add to Master Data Library
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EMERGENCY REJECT MODAL */}
            {rejectModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border-t-4 border-red-600">
                        <h3 className="text-lg font-black text-red-700 flex items-center gap-2 mb-2">
                            <AlertOctagon className="w-6 h-6" /> Emergency System Override
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            You are about to permanently terminate Request #{rejectModal.requestId}. This bypasses all workflows.
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Override Reason (Required)</label>
                            <textarea
                                value={rejectModal.reason} 
                                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })} 
                                rows="3"
                                placeholder="State the reason for emergency termination..."
                                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none font-mono"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setRejectModal({ isOpen: false, requestId: null, reason: '' })} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                            <button onClick={submitEmergencyReject} disabled={processing || !rejectModal.reason.trim()} className="px-4 py-2 flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50">
                                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute Override'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalDashboard;