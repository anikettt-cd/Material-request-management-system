import React, { useState, useEffect } from "react";
import {
  Activity,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../services/apiClient";

const TrackRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyRequests = async () => {
      try {
        // Ensure this path matches the backend endpoint exactly
        const response = await apiClient.get("/creator/requests");
        setRequests(response.data);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyRequests();
  }, []);

  const getStatusBadge = (status, stage) => {
    if (status === "Completed" || status === "Pending IT") {
      return (
        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-extrabold uppercase border border-green-200 flex items-center gap-1 w-max">
          <CheckCircle className="w-3.5 h-3.5" /> Approved
        </span>
      );
    }
    if (status === "Returned") {
      return (
        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-extrabold uppercase border border-yellow-200 flex items-center gap-1 w-max">
          <AlertTriangle className="w-3.5 h-3.5" /> Needs Correction
        </span>
      );
    }
    if (status === "Rejected") {
      return (
        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-extrabold uppercase border border-red-200 flex items-center gap-1 w-max">
          <XCircle className="w-3.5 h-3.5" /> Rejected
        </span>
      );
    }
    return (
      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-extrabold uppercase border border-blue-200 flex items-center gap-1 w-max">
        <Clock className="w-3.5 h-3.5" /> In Progress
      </span>
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto pb-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" /> My Request Tracker
          </h1>
          <p className="text-gray-500 mt-1 text-base">
            Monitor the live status and retrieve your generated SAP codes.
          </p>
        </div>
        <button
          onClick={() => navigate("/creator/new-request")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all"
        >
          + New Request
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
                    Req ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
                    Plant
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
                    Current Stage
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
                    Overall Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-blue-700 uppercase tracking-wider">
                    Final SAP Code
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.length > 0 ? (
                  requests.map((req) => (
                    <tr
                      key={req.request_id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-6 py-5 text-base font-black text-gray-900">
                        #{req.request_id}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-gray-800">
                        {req.material_description}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-gray-600">
                        {req.plant_id}
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-extrabold text-gray-700 uppercase tracking-wide bg-gray-100 px-3 py-1 rounded-md border border-gray-200">
                          {req.current_stage.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {getStatusBadge(req.status, req.current_stage)}
                      </td>
                      <td className="px-6 py-5">
                        {req.generated_material_code ? (
                          <span className="text-lg font-black text-green-700 tracking-widest bg-green-50 border-2 border-green-200 px-3 py-1 rounded-lg">
                            {req.generated_material_code}
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-gray-400 italic">
                            Awaiting Generation
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center">
                      <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-lg font-bold text-gray-500">
                        You haven't submitted any requests yet.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackRequests;
