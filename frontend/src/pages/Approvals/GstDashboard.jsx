import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Ban, FileText, Loader2, MapPin, Edit2, Check, Eye, Database } from 'lucide-react';
import apiClient from '../../services/apiClient';

const GstDashboard = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Tracks the full request object when viewing all fields
    const [viewDetails, setViewDetails] = useState(null);

    // Tracks active text field overrides on specific table cells inline
    const [inlineSteucs, setInlineSteucs] = useState({});
    const [editingRowId, setEditingRowId] = useState(null);
    
    // Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, type: '', requestId: null, currentSteuc: '' });
    const [comments, setComments] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/gst/pending'); 
            setRequests(response.data);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleActionSubmit = async () => {
        if (!comments.trim() && (modalConfig.type === 'Return' || modalConfig.type === 'Reject')) {
            return alert(`Comments are mandatory when ${modalConfig.type.toLowerCase()}ing a request.`);
        }
        if (modalConfig.type === 'Approve') {
            const finalSteuc = inlineSteucs[modalConfig.requestId] !== undefined 
                ? inlineSteucs[modalConfig.requestId] 
                : modalConfig.currentSteuc;

            if (!finalSteuc || finalSteuc.length < 4) {
                return alert("Validation Error: The Tax Control Code (STEUC) must be between 4 and 8 digits.");
            }
        }
        
        setIsProcessing(true);

        try {
            let endpoint = '';
            let payload = {};

            if (modalConfig.type === 'Approve') {
                endpoint = `/gst/approve/${modalConfig.requestId}`;
                
                // Reads modified code string straight from the target row dictionary matrix
                const finalSteuc = inlineSteucs[modalConfig.requestId] !== undefined 
                    ? inlineSteucs[modalConfig.requestId] 
                    : modalConfig.currentSteuc;

                payload = { 
                    comments: comments || "Tax and compliance data verified by GST Audit",
                    steuc: finalSteuc || null 
                };
            } else if (modalConfig.type === 'Return') {
                endpoint = `/workflow/${modalConfig.requestId}/send-correction`;
                payload = { note: comments };
            } else if (modalConfig.type === 'Reject') {
                endpoint = `/workflow/${modalConfig.requestId}/reject`;
                payload = { note: comments };
            }

            const response = await apiClient.post(endpoint, payload);
            
            alert(response.data.message || "Action successful!");
            setModalConfig({ isOpen: false, type: '', requestId: null, currentSteuc: '' });
            setComments('');
            setEditingRowId(null); 
            fetchRequests(); 
            
        } catch (error) {
            console.error("Action failed:", error);
            alert(error.response?.data?.detail || "Failed to process request.");
        } finally {
            setIsProcessing(false);
        }
    };

    const openModal = (type, req) => {
        const activeSteuc = inlineSteucs[req.request_id] !== undefined 
            ? inlineSteucs[req.request_id] 
            : (req.control_code_gst || '');

        setModalConfig({ isOpen: true, type, requestId: req.request_id, currentSteuc: activeSteuc });
        setComments('');
    };

    return (
        <div className="max-w-6xl mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-purple-600" /> GST & Audit Queue
                </h1>
                <p className="text-gray-500 mt-1">Review material descriptions and assign official Tax Control Codes (STEUC).</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Req ID</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Plant & Type</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-purple-700 uppercase">Control Code (STEUC)</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {requests.length > 0 ? (
                                requests.map((req) => {
                                    const isEditingThisRow = editingRowId === req.request_id;
                                    const liveSteucValue = inlineSteucs[req.request_id] !== undefined 
                                        ? inlineSteucs[req.request_id] 
                                        : (req.control_code_gst || '');

                                    return (
                                        <tr key={req.request_id} className="hover:bg-purple-50/50">
                                            <td className="px-6 py-4 text-sm font-medium">#{req.request_id}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{req.material_description}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-700">{req.plant_id}</span>
                                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-gray-200">
                                                        {req.material_type}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            <td className="px-6 py-4 text-sm font-medium">
                                                <div className="flex items-center gap-2">
                                                    {isEditingThisRow ? (
                                                        <input
                                                            type="text"
                                                            value={liveSteucValue}
                                                            placeholder="Enter Tax Code..."
                                                            onChange={(e) => {
                                                             const val = e.target.value;
                                                               if (/^\d*$/.test(val) && val.length <= 8) {
                                                                    setInlineSteucs({
                                                                       ...inlineSteucs,
                                                                       [req.request_id]: val
                                                                   });
                                                               }
                                                           }}
                                                            className="w-36 border-2 border-purple-500 rounded px-2 py-0.5 text-xs font-mono font-bold text-purple-900 bg-purple-50 outline-none uppercase tracking-wider"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        liveSteucValue ? (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                                                {liveSteucValue}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                                                Pending Assignment
                                                            </span>
                                                        )
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            if (isEditingThisRow) {
                                                                setEditingRowId(null);
                                                            } else {
                                                                setEditingRowId(req.request_id);
                                                                if (inlineSteucs[req.request_id] === undefined) {
                                                                    setInlineSteucs({ ...inlineSteucs, [req.request_id]: req.control_code_gst || '' });
                                                                }
                                                            }
                                                        }}
                                                        className={`p-1 rounded transition-colors ${
                                                            isEditingThisRow 
                                                                ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                                                                : 'text-gray-400 hover:text-purple-600 hover:bg-gray-100'
                                                        }`}
                                                        title={isEditingThisRow ? "Save View" : "Edit Inline"}
                                                    >
                                                        {isEditingThisRow ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 items-center">
                                                    <button 
                                                        onClick={() => setViewDetails(req)} 
                                                        className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors mr-2" 
                                                        title="View All Data"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => openModal('Approve', req)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium hover:bg-green-100 transition-colors">
                                                        <CheckCircle className="w-4 h-4" /> Approve
                                                    </button>
                                                    <button onClick={() => openModal('Return', req)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md text-sm font-medium hover:bg-yellow-100 transition-colors">
                                                        <XCircle className="w-4 h-4" /> Return
                                                    </button>
                                                    <button onClick={() => openModal('Reject', req)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100 transition-colors">
                                                        <Ban className="w-4 h-4" /> Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500"><CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />Your GST review queue is empty.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* DYNAMIC ACTION MODAL */}
            {modalConfig.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className={`text-lg font-bold flex items-center gap-2 mb-4 
                            ${modalConfig.type === 'Approve' ? 'text-green-700' : 
                              modalConfig.type === 'Return' ? 'text-yellow-700' : 'text-red-700'}`}>
                            
                            {modalConfig.type === 'Approve' && <CheckCircle className="w-5 h-5" />}
                            {modalConfig.type === 'Return' && <XCircle className="w-5 h-5" />}
                            {modalConfig.type === 'Reject' && <Ban className="w-5 h-5" />}
                            
                            {modalConfig.type === 'Approve' ? 'Verify Tax Code & Route to Store' : 
                             modalConfig.type === 'Return' ? 'Return to Creator for Corrections' : 'Permanently Reject Material'}
                        </h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {modalConfig.type === 'Approve' ? 'Approval Comments (Optional)' : `Reason for ${modalConfig.type} (Required)`}
                            </label>
                            <textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                rows="3"
                                placeholder={modalConfig.type === 'Approve' ? "Tax codes validated." : "Please explain the required changes..."}
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setModalConfig({ isOpen: false, type: '', requestId: null, currentSteuc: '' })} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                            <button 
                                onClick={handleActionSubmit} 
                                disabled={isProcessing || ((modalConfig.type === 'Return' || modalConfig.type === 'Reject') && !comments.trim()) || (modalConfig.type === 'Approve' && !modalConfig.currentSteuc?.trim())}
                                className={`px-4 py-2 flex items-center gap-2 text-sm font-bold text-white rounded-lg shadow-sm 
                                    ${modalConfig.type === 'Approve' ? 'bg-green-600 hover:bg-green-700' : 
                                      modalConfig.type === 'Return' ? 'bg-yellow-600 hover:bg-yellow-700' : 
                                      'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
                            >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Action'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL DATA VIEW MODAL */}
            {viewDetails && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50/50 rounded-t-xl">
                            <h3 className="text-xl font-bold text-purple-900 flex items-center gap-2">
                                <Database className="w-6 h-6 text-purple-600" />
                                Complete Master Record: #{viewDetails.request_id}
                            </h3>
                            <button onClick={() => setViewDetails(null)} className="text-gray-400 hover:text-gray-700 transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {Object.entries(viewDetails).map(([key, value]) => (
                                    <div key={key} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            {key.replace(/_/g, ' ')}
                                        </span>
                                        <span className="block text-sm font-semibold text-gray-900 break-words">
                                            {value !== null && value !== '' ? String(value) : <span className="text-gray-400 italic">Empty</span>}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
                            <button onClick={() => setViewDetails(null)} className="px-6 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 shadow-sm transition-colors">
                                Close Record
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GstDashboard;