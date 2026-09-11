import React, { useState, useEffect, useMemo } from 'react';
import { Clock, User, CheckCircle, Edit3, ArrowRight, Loader2, XCircle, ShieldAlert, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import apiClient from '../../services/apiClient';

const AuditTimeline = () => {
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedReqId, setExpandedReqId] = useState(null); // Track which accordion is open

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get('/it-department/audit-logs');
                setAuditLogs(response.data);
            } catch (err) {
                console.error("Failed to fetch audit logs:", err);
                setError("Failed to load secure audit trail. Ensure you have IT Admin privileges.");
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    // 🎯 GROUPING LOGIC: Group the flat log array by request_id
    const groupedLogs = useMemo(() => {
        const groups = {};
        auditLogs.forEach(log => {
            if (!groups[log.request_id]) {
                groups[log.request_id] = [];
            }
            groups[log.request_id].push(log);
        });

        // Convert to an array and sort so the request with the newest log is at the top
        return Object.entries(groups).sort(([, logsA], [, logsB]) => {
            return new Date(logsB[0].timestamp) - new Date(logsA[0].timestamp);
        }).map(([reqId, logs]) => ({
            reqId: parseInt(reqId),
            logs: logs
        }));
    }, [auditLogs]);

    const getActionStyle = (action) => {
        if (!action) return { icon: <Clock className="w-5 h-5 text-gray-600" />, bg: "bg-gray-100", border: "border-gray-200" };

        const act = action.toUpperCase();
        if (act.includes("SUBMITTED")) return { icon: <User className="w-5 h-5 text-blue-600" />, bg: "bg-blue-100", border: "border-blue-200" };
        if (act.includes("APPROVED")) return { icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: "bg-green-100", border: "border-green-200" };
        if (act.includes("FINALIZED")) return { icon: <CheckCircle className="w-5 h-5 text-indigo-600" />, bg: "bg-indigo-100", border: "border-indigo-200" };
        if (act.includes("EDITED")) return { icon: <Edit3 className="w-5 h-5 text-amber-600" />, bg: "bg-amber-100", border: "border-amber-200" };
        if (act.includes("REJECTED") || act.includes("CANCEL")) return { icon: <XCircle className="w-5 h-5 text-red-600" />, bg: "bg-red-100", border: "border-red-200" };

        return { icon: <Clock className="w-5 h-5 text-gray-600" />, bg: "bg-gray-100", border: "border-gray-200" };
    };

    // 🎯 FIX: Snip off the timezone offsets so JavaScript interprets it as a local time string directly
    const formatDate = (dateString) => {
        if (!dateString) return '';

        // Strip trailing 'Z' or '+00:00' offsets completely
        const cleanTimestamp = dateString.toString().replace('Z', '').replace('+00:00', '').trim();

        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        // Swapped to toLocaleString for comprehensive cross-browser time formatting compatibility
        return new Date(cleanTimestamp).toLocaleString(undefined, options);
    };

    const toggleAccordion = (reqId) => {
        setExpandedReqId(prev => prev === reqId ? null : reqId);
    };

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                <p className="text-sm font-medium text-gray-500">Decrypting secure ledger...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-6 rounded-xl border border-red-200 flex items-center gap-3 text-red-700">
                <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                <p className="font-bold">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full h-full min-h-[600px] flex flex-col">
            <div className="mb-4 border-b border-gray-100 pb-4">
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-indigo-600" /> Global Audit Trail
                </h3>
                <p className="text-sm text-gray-500 mt-1">Select a request below to view its compliance history.</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {groupedLogs.length === 0 ? (
                    <p className="text-gray-500 italic text-sm text-center mt-10">No workflow events recorded yet.</p>
                ) : (
                    groupedLogs.map((group) => {
                        const isExpanded = expandedReqId === group.reqId;
                        const latestLog = group.logs[0];

                        return (
                            <div key={group.reqId} className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200">

                                {/* 🎯 ACCORDION HEADER */}
                                <button
                                    onClick={() => toggleAccordion(group.reqId)}
                                    className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isExpanded ? 'bg-indigo-50 border-b border-indigo-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-md ${isExpanded ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-gray-200 text-gray-500 shadow-sm'}`}>
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-black ${isExpanded ? 'text-indigo-900' : 'text-gray-900'}`}>
                                                Request #{group.reqId}
                                            </h4>
                                            <p className="text-xs font-semibold text-gray-500 mt-0.5">
                                                {group.logs.length} tracked event{group.logs.length !== 1 && 's'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-right">
                                        <div className="hidden sm:block">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Latest Update</span>
                                            <span className="text-xs font-mono text-gray-600">{formatDate(latestLog.timestamp)}</span>
                                        </div>
                                        {isExpanded ? <ChevronDown className="w-5 h-5 text-indigo-500" /> : <ChevronRight className="w-5 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {/* 🎯 EXPANDED TIMELINE BODY */}
                                {isExpanded && (
                                    <div className="p-5 bg-white">
                                        <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
                                            {group.logs.map((log) => {
                                                const style = getActionStyle(log.action_type);
                                                return (
                                                    <div key={log.log_id} className="relative pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10 ${style.bg}`}>
                                                            {style.icon}
                                                        </div>

                                                        <div className={`p-3 rounded-lg border ${style.border} bg-gray-50/50`}>
                                                            <div className="flex justify-between items-start mb-1.5">
                                                                <div>
                                                                    <span className="font-bold text-gray-900 text-sm">{log.username}</span>
                                                                    <span className="ml-2 px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-gray-200 text-gray-700">
                                                                        {log.action_type.replace(/_/g, ' ')}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs font-mono font-bold text-gray-500 whitespace-nowrap ml-2">
                                                                    {formatDate(log.timestamp)}
                                                                </span>
                                                            </div>

                                                            {log.comments && (
                                                                <p className="text-sm text-gray-700 font-medium">{log.comments}</p>
                                                            )}

                                                            {/* GITHUB DIFF VIEWER */}
                                                            {log.changes_diff && Object.keys(log.changes_diff).length > 0 && (
                                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                                    <div className="space-y-1.5">
                                                                        {Object.entries(log.changes_diff).map(([field, values]) => (
                                                                            <div key={field} className="text-xs bg-white border border-gray-100 rounded p-1.5 shadow-sm flex items-center gap-2">
                                                                                <span className="font-mono font-bold text-gray-700 w-1/3 truncate">
                                                                                    {field.replace(/_/g, ' ')}:
                                                                                </span>
                                                                                <span className="flex-1 bg-red-50 text-red-700 px-1.5 py-0.5 rounded line-through decoration-red-300 truncate">
                                                                                    {values.old}
                                                                                </span>
                                                                                <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                                <span className="flex-1 bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold truncate border border-green-100">
                                                                                    {values.new}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AuditTimeline;