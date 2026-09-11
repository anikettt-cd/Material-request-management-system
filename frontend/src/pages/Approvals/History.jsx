import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, RotateCcw, Clock, Loader2 } from "lucide-react";
import apiClient from "../../services/apiClient"; // Adjust path to your axios instance

const History = () => {
  const [activeTab, setActiveTab] = useState("Approved");
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch data from the universal backend route
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        // This hits the Python route we discussed earlier!
        const response = await apiClient.get("/history/my-history"); 
        setHistoryData(response.data);
      } catch (error) {
        console.error("Failed to fetch history", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

 // 1. Force it to be an array so .filter() never crashes
  const safeHistoryData = Array.isArray(historyData) ? historyData : [];

  // 2. Filter the data safely
  const filteredData = safeHistoryData.filter((req) => {
    // Convert to uppercase so "Rejected", "REJECTED", and "rejected" all match
    const action = (req.action_type || "").toUpperCase();

    if (activeTab === "Approved") return action.includes("APPROVED"); 
    if (activeTab === "Rejected") return action.includes("REJECTED");
    if (activeTab === "Returned") return action.includes("RETURNED");
    
    return true;
  });
  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-600" />
          My Action History
        </h1>
        <p className="text-gray-500 mt-1">
          Review requests you have previously processed.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 🎯 THE TAB CONTROLS */}
        <div className="flex border-b border-gray-200 bg-gray-50/50">
          <button
            onClick={() => setActiveTab("Approved")}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${
              activeTab === "Approved"
                ? "border-b-2 border-green-500 text-green-700 bg-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <CheckCircle className="w-4 h-4" /> Approved
          </button>
          
          <button
            onClick={() => setActiveTab("Returned")}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${
              activeTab === "Returned"
                ? "border-b-2 border-orange-500 text-orange-700 bg-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <RotateCcw className="w-4 h-4" /> Returned for Correction
          </button>

          <button
            onClick={() => setActiveTab("Rejected")}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${
              activeTab === "Rejected"
                ? "border-b-2 border-red-500 text-red-700 bg-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <XCircle className="w-4 h-4" /> Rejected
          </button>
        </div>

        {/* 🎯 THE DATA TABLE */}
        <div className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredData.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4 font-bold">Req ID</th>
                  <th className="px-6 py-4 font-bold">Description</th>
                  <th className="px-6 py-4 font-bold">Action Date</th>
                  <th className="px-6 py-4 font-bold">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((req) => (
                  <tr key={req.request_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      #{req.request_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {req.material_description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(req.action_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                       {/* This shows where the request is right now, even if they approved it days ago */}
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-200">
                        {req.current_stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16 px-4">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900">No {activeTab} Records</h3>
              <p className="text-gray-500 mt-1">
                You haven't {activeTab.toLowerCase()} any requests yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;