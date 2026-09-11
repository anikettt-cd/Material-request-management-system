import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Loader2,
  Edit2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../services/apiClient";

const MyRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get("/creator/requests");
        setRequests(response.data);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  // 🔍 Filter Logic
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.material_description
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      req.request_id?.toString().includes(searchTerm);

    const matchesStatus = statusFilter === "All" || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 🎯 FIX: Map 'Active' to the Correction Required UI
  const getStatusBadge = (status, reqId) => {
    switch (status) {
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case "Active": // 🚀 Changed this from 'Correction Required' to 'Active' to match your database!
        return (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
              <XCircle className="w-3.5 h-3.5" /> Action Needed
            </span>
            <button
              onClick={() => navigate(`/creator/edit-request/${reqId}`)}
              className="text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded-md border border-blue-200 hover:bg-blue-100 flex items-center gap-1 text-xs font-bold transition-all shadow-sm"
            >
              <Edit2 className="w-3 h-3" /> Edit & Fix
            </button>
          </div>
        );
      default:
        return <span className="text-gray-500">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" /> My Material Requests
          </h1>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search ID or Description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-64 py-2 pl-3 border border-gray-300 rounded-lg text-sm bg-white"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-48 py-2 pl-3 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            {/* 🎯 FIX: Changed value to 'Active' so the filter matches the DB status */}
            <option value="Active">Correction Required</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                  Req ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                  Plant
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                  Submitted
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRequests.map((req) => (
                <tr key={req.request_id} className="hover:bg-blue-50/50">
                  <td className="px-6 py-4 text-sm font-medium">
                    #{req.request_id}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold">
                    {req.material_description}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {req.material_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {req.plant_id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {req.created_at
                      ? new Date(req.created_at).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(req.status, req.request_id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyRequests;
