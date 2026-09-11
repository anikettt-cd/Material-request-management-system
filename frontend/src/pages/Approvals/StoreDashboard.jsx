import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Ban,
  Database,
  Loader2,
  MapPin,
  Edit2,
  Check,
  Eye,
  AlertCircle,
} from "lucide-react";
import apiClient from "../../services/apiClient";

const StoreDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tracks active edits for all modifiable fields inline
  const [inlineEdits, setInlineEdits] = useState({});
  const [editingRowId, setEditingRowId] = useState(null);

  // Tracks the full request object when viewing all fields
  const [viewDetails, setViewDetails] = useState(null);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: "",
    requestId: null,
  });
  const [comments, setComments] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 🎯 LIVE DATABASE ANALYZER STATES
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [duplicateMatches, setDuplicateMatches] = useState([]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/store/pending");
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

  // 🎯 LIVE MONITOR FOR MATERIAL DESCRIPTION EDITS
  useEffect(() => {
    if (!editingRowId) {
      setDuplicateWarning("");
      setDuplicateMatches([]);
      setIsCheckingDuplicate(false);
      return;
    }

    const edits = inlineEdits[editingRowId] || {};
    const rawInput = edits.matDesc;

    // If no edits have been made to the description yet, do nothing
    if (rawInput === undefined) return;

    const cleanInput = rawInput.trim();
    if (cleanInput.length < 3) {
      setDuplicateWarning("");
      setDuplicateMatches([]);
      setIsCheckingDuplicate(false);
      return;
    }

    const delayTimer = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      try {
        const response = await apiClient.get(
          `/creator/check-duplicate?description=${encodeURIComponent(cleanInput)}`,
        );
        if (response.data.is_duplicate) {
          // Filter out the current record so it doesn't catch itself as a duplicate while editing
          const filteredMatches = (response.data.matches || []).filter(
            (match) => String(match.code) !== String(editingRowId),
          );

          if (filteredMatches.length > 0) {
            setDuplicateWarning(response.data.message);
            setDuplicateMatches(filteredMatches);
          } else {
            setDuplicateWarning("");
            setDuplicateMatches([]);
          }
        } else {
          setDuplicateWarning("");
          setDuplicateMatches([]);
        }
      } catch (err) {
        console.error("Database duplicate check failed:", err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 600);

    return () => clearTimeout(delayTimer);
  }, [editingRowId, inlineEdits]);

  const handleActionSubmit = async () => {
    if (
      !comments.trim() &&
      (modalConfig.type === "Return" || modalConfig.type === "Reject")
    ) {
      return alert(
        `Comments are mandatory when ${modalConfig.type.toLowerCase()}ing a request.`,
      );
    }

    // 🎯 OVERRIDE SYSTEM: Check if they are approving while duplicates exist
    if (modalConfig.type === "Approve" && duplicateMatches.length > 0) {
      if (
        !window.confirm(
          "⚠️ Warning: Active duplicates or highly similar entries exist for the description you edited. Are you sure you want to approve this request and override the warning?",
        )
      ) {
        return; // Halt submission
      }
    }

    setIsProcessing(true);

    try {
      let endpoint = "";
      let payload = {};

      if (modalConfig.type === "Approve") {
        endpoint = `/store/approve/${modalConfig.requestId}`;

        // Read modified values or fallback to original nulls
        const edits = inlineEdits[modalConfig.requestId] || {};

        payload = {
          comments:
            comments ||
            "Store verification complete. Approved for IT processing.",
          material_type: edits.type || null,
          material_group: edits.matGroup || null,
          purchasing_group: edits.purchGroup || null,
          base_unit_of_measure: edits.uom ? edits.uom.toUpperCase() : null,
          material_description:
            edits.matDesc !== undefined ? edits.matDesc : null,
          long_description:
            edits.longDesc !== undefined ? edits.longDesc : null,
        };
      } else if (modalConfig.type === "Return") {
        endpoint = `/workflow/${modalConfig.requestId}/send-correction`;
        payload = { note: comments };
      } else if (modalConfig.type === "Reject") {
        endpoint = `/workflow/${modalConfig.requestId}/reject`;
        payload = { note: comments };
      }

      const response = await apiClient.post(endpoint, payload);

      alert(response.data.message || "Action successful!");

      setModalConfig({ isOpen: false, type: "", requestId: null });
      setComments("");
      setEditingRowId(null);
      fetchRequests();
    } catch (error) {
      console.error("Action failed:", error);
      alert(error.response?.data?.detail || "Failed to process request.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditChange = (reqId, field, value) => {
    setInlineEdits((prev) => ({
      ...prev,
      [reqId]: { ...(prev[reqId] || {}), [field]: value },
    }));
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-600" /> Final Master Data
          Verification
        </h1>
        <p className="text-gray-500 mt-1">
          Review finalized workflows, adjust attributes, and approve requests
          for IT processing.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* 🎯 FIX: Dynamically add 350px of empty space at the bottom ONLY when the dropdown is open */}
          <div
            className={`overflow-x-auto min-h-[400px] transition-all duration-300 ${duplicateMatches.length > 0 ? "pb-[350px]" : "pb-2"}`}
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-indigo-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-bold text-indigo-900 uppercase">
                    Req ID / Plant
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-indigo-900 uppercase w-1/4">
                    Description
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-indigo-900 uppercase">
                    Type / UOM
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-indigo-900 uppercase">
                    Mat / Purch Groups
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-indigo-900 uppercase">
                    Tax Code
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-bold text-indigo-900 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.length > 0 ? (
                  requests.map((req) => {
                    const isEditing = editingRowId === req.request_id;
                    const edits = inlineEdits[req.request_id] || {};

                    const liveType =
                      edits.type !== undefined ? edits.type : req.material_type;
                    const liveUom =
                      edits.uom !== undefined
                        ? edits.uom
                        : req.base_unit_of_measure;
                    const liveMatGroup =
                      edits.matGroup !== undefined
                        ? edits.matGroup
                        : req.material_group;
                    const livePurchGroup =
                      edits.purchGroup !== undefined
                        ? edits.purchGroup
                        : req.purchasing_group || "";
                    const liveMatDesc =
                      edits.matDesc !== undefined
                        ? edits.matDesc
                        : req.material_description;
                    const liveLongDesc =
                      edits.longDesc !== undefined
                        ? edits.longDesc
                        : req.long_description || "";

                    return (
                      <tr
                        key={req.request_id}
                        className={`hover:bg-indigo-50/30 ${isEditing ? "bg-indigo-50/50" : ""}`}
                      >
                        {/* ID & PLANT */}
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col mt-1">
                            <span className="text-sm font-bold text-gray-900">
                              #{req.request_id}
                            </span>
                            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {req.plant_id}
                            </span>
                          </div>
                        </td>

                        {/* 🎯 DESCRIPTION (EDITABLE WITH LIVE ANALYZER) */}
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-2 relative">
                            {isEditing ? (
                              <>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={liveMatDesc}
                                    onChange={(e) =>
                                      handleEditChange(
                                        req.request_id,
                                        "matDesc",
                                        e.target.value,
                                      )
                                    }
                                    className={`w-full border-2 rounded px-2 py-1 text-sm outline-none focus:ring-2 ${duplicateMatches.length > 0 ? "border-red-400 focus:ring-red-500 bg-red-50 text-red-950 font-bold" : "border-indigo-300 font-bold text-indigo-900 focus:border-indigo-500"}`}
                                    placeholder="Material Description"
                                  />
                                  {isCheckingDuplicate && (
                                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                      <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
                                    </div>
                                  )}
                                </div>
                                <textarea
                                  value={liveLongDesc}
                                  onChange={(e) =>
                                    handleEditChange(
                                      req.request_id,
                                      "longDesc",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full border-2 border-indigo-300 rounded px-2 py-1 text-xs text-gray-700 outline-none focus:border-indigo-500 resize-none"
                                  placeholder="Long Description (Optional)"
                                  rows="2"
                                />

                                {/* FTS Dropdown inline */}
                                {duplicateWarning && (
                                  <div className="mt-1 flex items-start gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-100 p-2 rounded shadow-sm">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <span>{duplicateWarning}</span>
                                  </div>
                                )}

                                {/* 🎯 FIXED FLOATING FULL-WIDTH DROPDOWN */}
                                {duplicateMatches.length > 0 && (
                                  <div className="absolute left-0 top-[100%] mt-1 w-[650px] bg-white border border-red-200 rounded-md shadow-2xl overflow-hidden z-[100]">
                                    <div className="px-3 py-1.5 bg-red-50 border-b border-red-100 flex justify-between items-center">
                                      <span className="text-[10px] font-bold text-red-800 uppercase tracking-wide">
                                        Conflicting Library Matches (
                                        {duplicateMatches.length})
                                      </span>
                                    </div>
                                    <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                                      {duplicateMatches.map((match, idx) => (
                                        <li
                                          key={idx}
                                          className="px-4 py-3 flex justify-between items-start gap-4 text-xs"
                                        >
                                          {/* 🎯 Fix: Removed 'truncate' and added 'break-words whitespace-normal' */}
                                          <span className="font-bold text-gray-800 break-words whitespace-normal leading-relaxed">
                                            {match.desc}
                                          </span>
                                          <span className="font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 flex-shrink-0 mt-0.5">
                                            Code:{" "}
                                            {match.code !== "None"
                                              ? match.code
                                              : "Pending"}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-sm font-bold text-indigo-700 break-words mt-1">
                                  {liveMatDesc}
                                </span>
                                {liveLongDesc && (
                                  <span
                                    className="text-[10px] text-gray-500 leading-tight line-clamp-2 mt-1"
                                    title={liveLongDesc}
                                  >
                                    {liveLongDesc}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* TYPE & UOM (EDITABLE) */}
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-2 mt-1">
                            {isEditing ? (
                              <>
                                <input
                                  type="text"
                                  value={liveType}
                                  onChange={(e) =>
                                    handleEditChange(
                                      req.request_id,
                                      "type",
                                      e.target.value.toUpperCase(),
                                    )
                                  }
                                  className="w-20 border-2 border-indigo-300 rounded px-1 text-[10px] font-bold uppercase outline-none focus:border-indigo-500"
                                  placeholder="TYPE"
                                />
                                <input
                                  type="text"
                                  value={liveUom}
                                  onChange={(e) =>
                                    handleEditChange(
                                      req.request_id,
                                      "uom",
                                      e.target.value.toUpperCase(),
                                    )
                                  }
                                  maxLength={3}
                                  className="w-16 border-2 border-indigo-300 rounded px-1 text-xs font-mono font-bold uppercase outline-none focus:border-indigo-500"
                                  placeholder="UOM"
                                />
                              </>
                            ) : (
                              <>
                                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold w-max border border-gray-200">
                                  {liveType}
                                </span>
                                <span className="text-sm font-bold text-gray-900 tracking-wider">
                                  {liveUom}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* GROUPS (EDITABLE) */}
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-2 mt-1">
                            {isEditing ? (
                              <>
                                <input
                                  type="text"
                                  value={liveMatGroup}
                                  onChange={(e) =>
                                    handleEditChange(
                                      req.request_id,
                                      "matGroup",
                                      e.target.value,
                                    )
                                  }
                                  className="w-24 border-2 border-indigo-300 rounded px-1 text-xs font-mono outline-none focus:border-indigo-500"
                                  placeholder="Mat Grp"
                                />
                                <input
                                  type="text"
                                  value={livePurchGroup}
                                  onChange={(e) =>
                                    handleEditChange(
                                      req.request_id,
                                      "purchGroup",
                                      e.target.value,
                                    )
                                  }
                                  className="w-24 border-2 border-indigo-300 rounded px-1 text-xs font-mono outline-none focus:border-indigo-500"
                                  placeholder="Purch Grp"
                                />
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-gray-600 font-mono">
                                  M: {liveMatGroup}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                  P: {livePurchGroup || "-"}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* TAX CODE (Static) */}
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex items-center px-2 py-1 mt-1 rounded text-xs font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            {req.control_code_gst || "N/A"}
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-4 py-4 text-right align-top">
                          <div className="flex justify-end gap-2 items-center mt-1">
                            {/* Inline Edit Toggle */}
                            <button
                              onClick={() =>
                                setEditingRowId(
                                  isEditing ? null : req.request_id,
                                )
                              }
                              className={`p-1.5 rounded transition-colors mr-1 ${isEditing ? "bg-green-100 text-green-700" : "text-gray-400 hover:text-indigo-600 hover:bg-gray-100"}`}
                              title="Edit Attributes"
                            >
                              {isEditing ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Edit2 className="w-4 h-4" />
                              )}
                            </button>

                            {/* View All Fields Button */}
                            <button
                              onClick={() => setViewDetails(req)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors mr-2"
                              title="View All Data"
                            >
                              <Eye className="w-5 h-5" />
                            </button>

                            {/* Approve, Return, Reject Buttons */}
                            <button
                              onClick={() => {
                                setModalConfig({
                                  isOpen: true,
                                  type: "Approve",
                                  requestId: req.request_id,
                                });
                                setComments("");
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" /> Approve
                            </button>
                            <button
                              onClick={() => {
                                setModalConfig({
                                  isOpen: true,
                                  type: "Return",
                                  requestId: req.request_id,
                                });
                                setComments("");
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md text-sm font-medium hover:bg-yellow-100 transition-colors"
                            >
                              <XCircle className="w-4 h-4" /> Return
                            </button>
                            <button
                              onClick={() => {
                                setModalConfig({
                                  isOpen: true,
                                  type: "Reject",
                                  requestId: req.request_id,
                                });
                                setComments("");
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                            >
                              <Ban className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Database className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                      Queue is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3
              className={`text-lg font-bold flex items-center gap-2 mb-4 
                            ${
                              modalConfig.type === "Approve"
                                ? "text-green-700"
                                : modalConfig.type === "Return"
                                  ? "text-yellow-700"
                                  : "text-red-700"
                            }`}
            >
              {modalConfig.type === "Approve" && (
                <CheckCircle className="w-5 h-5" />
              )}
              {modalConfig.type === "Return" && <XCircle className="w-5 h-5" />}
              {modalConfig.type === "Reject" && <Ban className="w-5 h-5" />}

              {modalConfig.type === "Approve"
                ? "Approve & Route to IT"
                : modalConfig.type === "Return"
                  ? "Return to Creator for Corrections"
                  : "Permanently Reject Material"}
            </h3>

            <div className="mb-4 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {modalConfig.type === "Approve"
                  ? "Final Comments (Optional)"
                  : `Reason for ${modalConfig.type} (Required)`}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows="3"
                placeholder={
                  modalConfig.type === "Approve"
                    ? "Store verification complete."
                    : "Please explain the required changes..."
                }
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setModalConfig({ isOpen: false, type: "", requestId: null })
                }
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleActionSubmit}
                disabled={
                  isProcessing ||
                  ((modalConfig.type === "Return" ||
                    modalConfig.type === "Reject") &&
                    !comments.trim())
                }
                className={`px-4 py-2 flex items-center gap-2 text-sm font-bold text-white rounded-lg shadow-sm 
                                    ${
                                      modalConfig.type === "Approve"
                                        ? "bg-green-600 hover:bg-green-700"
                                        : modalConfig.type === "Return"
                                          ? "bg-yellow-600 hover:bg-yellow-700"
                                          : "bg-red-600 hover:bg-red-700"
                                    } disabled:opacity-50`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Confirm Action"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL DATA VIEW MODAL */}
      {viewDetails && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50 rounded-t-xl">
              <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <Database className="w-6 h-6 text-indigo-600" />
                Complete Master Record: #{viewDetails.request_id}
              </h3>
              <button
                onClick={() => setViewDetails(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Data Grid */}
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(viewDetails).map(([key, value]) => (
                  <div
                    key={key}
                    className="bg-gray-50 p-3 rounded-lg border border-gray-100"
                  >
                    <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="block text-sm font-semibold text-gray-900 break-words">
                      {value !== null && value !== "" ? (
                        String(value)
                      ) : (
                        <span className="text-gray-400 italic">Empty</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
              <button
                onClick={() => setViewDetails(null)}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreDashboard;
