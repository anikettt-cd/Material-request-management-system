import React from 'react';
import AuditTimeline from '../../components/ui/AuditTimeline';
import { ShieldCheck } from 'lucide-react';

const GlobalAuditPage = () => {
    return (
        <div className="max-w-[1400px] mx-auto pb-10 px-4 md:px-8 pt-6">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-indigo-600" /> System Audit Trail
                </h1>
                <p className="text-gray-500 mt-1 text-base">
                    Immutable chronological ledger of all system modifications, approvals, and overrides.
                </p>
            </div>
            
            {/* The Timeline will now take up the full width of the screen! */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[600px]">
                <AuditTimeline />
            </div>
        </div>
    );
};

export default GlobalAuditPage;