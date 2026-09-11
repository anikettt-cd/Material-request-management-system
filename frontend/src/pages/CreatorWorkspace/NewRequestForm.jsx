import React, { useState, useEffect } from "react";
import {
  Send,
  Loader2,
  Search,
  ChevronDown,
  Lock,
  AlertCircle,
  CheckCircle,
  Database,
  AlertOctagon
} from "lucide-react";
import SearchableDropdown from "../../components/forms/SearchableDropdown";
import apiClient from "../../services/apiClient";
import { useAuth } from "../../context/AuthContext";

const NewRequestForm = () => {
  const [plants, setPlants] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [materialGroups, setMaterialGroups] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [salesOrgs, setSalesOrgs] = useState([]);
  const [distChannels, setDistChannels] = useState([]);
  const [purchasingGroups, setPurchasingGroups] = useState([]);
  const [valCategoryMap, setValCategoryMap] = useState({});
  const [valClassMap, setValClassMap] = useState({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState(null);
  
  const [formErrors, setFormErrors] = useState({});

  // 🎯 Live Database States
  const [masterCount, setMasterCount] = useState(0);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  
  // 🎯 NEW: Modal state for the override feature
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  const [groupSearch, setGroupSearch] = useState("");
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [plantSearch, setPlantSearch] = useState("");
  const [isPlantOpen, setIsPlantOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [uomSearch, setUomSearch] = useState("");
  const [isUomOpen, setIsUomOpen] = useState(false);

  const { user } = useAuth();

  const [formData, setFormData] = useState({
    materialType: "ZCOM",
    plant: user?.plant_id || "",
    storageLocation: "",
    salesOrg: "",
    distChannel: "",
    materialDesc: "",
    longDescription: "",
    baseUom: "",
    materialGroup: "",
    controlCode: "",
    purchasingGroup: "",
    valuationCategory: "",
    valuationClass: "",
  });

  useEffect(() => {
    if (user?.plant_id && !formData.plant) {
      setFormData((prev) => ({ ...prev, plant: user.plant_id }));
    }
  }, [user]);

  // 📥 Fetch Standard Master Data
  useEffect(() => {
    const fetchApiData = async (fileName) => {
      try {
        const response = await apiClient.get(`/data/${fileName}`);
        return response.data;
      } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        return [];
      }
    };

    const fetchMasterData = async () => {
      const rawPlants = await fetchApiData("plants");
      const rawLocations = await fetchApiData("locations");
      const rawGroups = await fetchApiData("material_groups");
      const rawUoms = await fetchApiData("uom");
      const rawSales = await fetchApiData("Sales_Organization");
      const rawDist = await fetchApiData("Distribution_Channel");
      const rawPurch = await fetchApiData("Purchasing_Group");
      const rawValGroup = await fetchApiData("Valuation_Group");
      const rawValClass = await fetchApiData("Valuation_Class");

      setPlants(rawPlants.map((p) => ({ code: String(p["Plant"] || ""), desc: p["Description"] || "" })));
      setAllLocations(rawLocations.map((loc) => ({
        plantCode: String(loc["Plant"] || ""),
        code: String(loc["Storage Location"] || ""),
        desc: loc["Storage Location description"] || "",
      })));
      setUoms(rawUoms.map((u) => ({ code: String(u["UOM"] || ""), desc: u["UOM Description"] || "" })));

      const mapBulletproof = (rawData) =>
        rawData.map((item) => {
          const keys = Object.keys(item);
          return { code: String(item[keys[0]] || "").trim(), desc: String(item[keys[1]] || "").trim() };
        });

      const mapAndDedupe = (rawData) => {
        const map = new Map();
        rawData.forEach((item) => {
          const keys = Object.keys(item);
          if (item[keys[0]] && !map.has(item[keys[0]]))
            map.set(item[keys[0]], { code: String(item[keys[0]]).trim(), desc: String(item[keys[1]] || "").trim() });
        });
        return Array.from(map.values());
      };

      setMaterialGroups(mapBulletproof(rawGroups));
      setSalesOrgs(mapAndDedupe(rawSales));
      setDistChannels(mapAndDedupe(rawDist));
      setPurchasingGroups(mapAndDedupe(rawPurch));

      const catMap = {};
      rawValGroup.forEach((row) => {
        const keys = Object.keys(row);
        catMap[String(row[keys[0]] || "").trim()] = String(row[keys[1]] || "").trim();
      });
      setValCategoryMap(catMap);
      
      const clsMap = {};
      rawValClass.forEach((row) => {
        const keys = Object.keys(row);
        clsMap[String(row[keys[0]] || "").trim()] = String(row[keys[1]] || "").trim();
      });
      setValClassMap(clsMap);
    };

    fetchMasterData();
  }, []);

  // 🎯 Fetch Live Master Database Count
  useEffect(() => {
    apiClient
      .get("/creator/master-count")
      .then((response) => setMasterCount(response.data.count))
      .catch((err) => console.error("Could not fetch master count", err));
  }, []);

  useEffect(() => {
    if (formData.materialType && (Object.keys(valCategoryMap).length > 0 || Object.keys(valClassMap).length > 0)) {
      setFormData((prev) => ({
        ...prev,
        valuationCategory: valCategoryMap[prev.materialType] || prev.valuationCategory,
        valuationClass: valClassMap[prev.materialType] || prev.valuationClass,
      }));
    }
  }, [valCategoryMap, valClassMap]);

  // 🎯 DATABASE-ONLY LIVE ANALYZER
  useEffect(() => {
    const rawInput = formData.materialDesc;
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
        const response = await apiClient.get(`/creator/check-duplicate?description=${encodeURIComponent(cleanInput)}`);
        if (response.data.is_duplicate) {
          setDuplicateWarning(response.data.message);
          setDuplicateMatches(response.data.matches || []); 
        } else {
          setDuplicateWarning("");
          setDuplicateMatches([]); 
        }
      } catch (err) {
        console.error("Database check failed:", err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 600);

    return () => clearTimeout(delayTimer);
  }, [formData.materialDesc]);

  const filteredGroups = materialGroups.filter((g) => g.code.toLowerCase().includes(groupSearch.toLowerCase()) || g.desc.toLowerCase().includes(groupSearch.toLowerCase()));
  const filteredUoms = uoms.filter((u) => u.code.toLowerCase().includes(uomSearch.toLowerCase()) || u.desc.toLowerCase().includes(uomSearch.toLowerCase()));
  const availableLocations = formData.plant ? allLocations.filter((loc) => loc.plantCode === formData.plant) : [];
  const filteredLocations = availableLocations.filter((loc) => loc.code.toLowerCase().includes(locationSearch.toLowerCase()) || loc.desc.toLowerCase().includes(locationSearch.toLowerCase()));

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }));

    if (name === "materialType") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        valuationCategory: valCategoryMap[value] || "",
        valuationClass: valClassMap[value] || "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleControlCodeChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, ""); 
    if (numbersOnly.length <= 8) { 
      setFormData((prev) => ({ ...prev, controlCode: numbersOnly }));
      if (numbersOnly.length >= 4 || numbersOnly.length === 0) {
        setFormErrors((prev) => ({ ...prev, controlCode: null }));
      }
    }
  };

  // 🎯 STEP 1: INITIAL PRE-FLIGHT (Opens modal if duplicates found)
  const handleInitialSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};

    if (formData.controlCode && formData.controlCode.length > 0 && formData.controlCode.length < 4) {
      newErrors.controlCode = "Control code must be between 4 and 8 digits.";
    }
    if (!formData.longDescription || formData.longDescription.trim() === "") {
        newErrors.longDescription = "Long Material Description is required.";
    }
    if (!formData.salesOrg || formData.salesOrg.trim() === "") {
        newErrors.salesOrg = "Please select a Sales Organization.";
    }
    if (!formData.distChannel || formData.distChannel.trim() === "") {
        newErrors.distChannel = "Please select a Distribution Channel.";
    }
    if (!formData.purchasingGroup || formData.purchasingGroup.trim() === "") {
        newErrors.purchasingGroup = "Please select a Purchasing Group.";
    }

    if (Object.keys(newErrors).length > 0) {
        setFormErrors(newErrors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return; 
    }

    // 🎯 If duplicates exist, interrupt submission and show the override modal
    if (duplicateMatches.length > 0) {
        setIsOverrideModalOpen(true);
        return;
    }

    // If no duplicates and no errors, proceed directly to final submit
    await executeFinalSubmit();
  };

  // 🎯 STEP 2: ACTUAL SUBMISSION (Triggered immediately if clean, or via override modal)
  const executeFinalSubmit = async () => {
    setIsSubmitting(true);
    setIsOverrideModalOpen(false); // Close modal if open
    setSuccessMessage("");
    setError(null);

    const payload = {
      material_type: formData.materialType,
      plant_id: formData.plant,
      storage_location: formData.storageLocation,
      material_description: formData.materialDesc.trim(),
      long_description: formData.longDescription.trim(),
      base_unit_of_measure: formData.baseUom,
      material_group: formData.materialGroup,
      sales_org: formData.salesOrg || null,
      dist_channel: formData.distChannel || null,
      control_code_gst: formData.controlCode || null,
      purchasing_group: formData.purchasingGroup || null,
      valuation_category: formData.valuationCategory || null,
      valuation_class: formData.valuationClass || null,
    };

    try {
      const response = await apiClient.post("/creator/submit", payload);
      setSuccessMessage(`Success! Request #${response.data.tracking_id || ""} for "${formData.materialDesc}" has been routed for approval.`);
      
      // Reset form on success
      setFormData({
        materialType: "ZCOM",
        plant: user?.plant_id || "",
        storageLocation: "",
        salesOrg: "",
        distChannel: "",
        materialDesc: "",
        longDescription: "",
        baseUom: "",
        materialGroup: "",
        controlCode: "",
        purchasingGroup: "",
        valuationCategory: valCategoryMap["ZCOM"] || "",
        valuationClass: valClassMap["ZCOM"] || "",
      });
      setGroupSearch("");
      setLocationSearch("");
      setUomSearch("");
      setDuplicateWarning("");
      setDuplicateMatches([]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(`Validation Error: ${detail[0].msg}`);
      } else {
        setError(detail || err.message || "An error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm";
  const labelClass = "block text-xs font-bold text-gray-700 mb-1 tracking-wide";

  return (
    <div className="max-w-5xl mx-auto pb-10 relative">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Material Request</h1>
          <p className="text-gray-500 mt-1">Complete all 13 SAP master data fields below.</p>
        </div>

        {masterCount > 0 && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200 shadow-sm transition-all duration-500">
            <Database className="w-4 h-4" />
            <span className="text-xs font-bold">{masterCount.toLocaleString()} Master Records Active</span>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-start space-x-2 shadow-sm">
          <span className="text-sm text-green-800 font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start space-x-2 shadow-sm">
          <span className="text-sm text-red-800 font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleInitialSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 space-y-8">
          <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-100 space-y-5">

            <div>
              <label className={labelClass}>Material description <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="text"
                  name="materialDesc"
                  required
                  maxLength={40}
                  value={formData.materialDesc}
                  onChange={handleChange}
                  placeholder="Must be within 40 characters..."
                  className={`block w-full py-3 px-4 border ${duplicateWarning || duplicateMatches.length > 0 ? "border-red-400 focus:ring-red-500 bg-red-50 text-red-900" : "border-blue-300 focus:ring-blue-500 bg-white"} rounded-md text-base font-medium shadow-sm transition-colors`}
                />
                {isCheckingDuplicate && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex justify-between items-start mt-1.5 min-h-[20px]">
                <div className="w-full pr-4">
                  {duplicateWarning ? (
                    <div className="mt-1 bg-red-50 border border-red-200 p-3 rounded-md shadow-sm animate-in fade-in slide-in-from-top-2">
                      <span className="flex items-start gap-1.5 text-sm font-bold text-red-700">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        {duplicateWarning}
                      </span>
                    </div>
                  ) : (
                    formData.materialDesc.length >= 3 && !isCheckingDuplicate && (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-600 mt-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Description is unique
                      </span>
                    )
                  )}
                </div>
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap mt-1">{formData.materialDesc.length}/40</span>
              </div>

              {duplicateMatches.length > 0 && (
                <div className="mt-2 bg-white border border-red-200 rounded-md shadow-lg overflow-hidden z-40 relative animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-red-800 uppercase tracking-wide">Matching Records Found ({duplicateMatches.length})</span>
                    <span className="text-[10px] text-red-500 font-medium">Warning: Submission will require override</span>
                  </div>
                  <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {duplicateMatches.map((match, idx) => (
                      <li key={idx} className="px-4 py-3 hover:bg-red-50/40 transition-colors flex justify-between items-center group cursor-default gap-4">
                        <span className="text-sm font-bold text-gray-800 group-hover:text-red-700 transition-colors truncate">{match.desc}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors">UOM: {match.uom}</span>
                          <span className="text-xs font-mono font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded border border-gray-200 group-hover:bg-red-100 group-hover:border-red-200 group-hover:text-red-700 transition-colors">
                            Code: {match.code !== "None" ? match.code : "Pending"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Long Material Description <span className="text-red-500">*</span></label>
              <textarea
                name="longDescription"
                rows={3}
                maxLength={400}
                value={formData.longDescription}
                onChange={handleChange}
                placeholder="Enter detailed specifications, dimensions, or technical notes..."
                className={`block w-full py-3 px-4 border ${formErrors.longDescription ? "border-red-500" : "border-blue-300 focus:border-blue-500 focus:ring-blue-500"} rounded-md text-sm shadow-sm resize-y bg-white`}
              />
              {formErrors.longDescription && <p className="text-red-500 text-xs font-bold mt-1">{formErrors.longDescription}</p>}
              <p className="text-xs text-gray-500 mt-1 text-right">{(formData.longDescription || "").length}/400 characters</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Material type </label>
              <select name="materialType" value={formData.materialType} onChange={handleChange} className={inputClass}>
                <option value="ZCOM">ZCOM - Consumables</option>
                <option value="ZEIS">ZEIS - Electrical items & Spares</option>
                <option value="ZMIS">ZMIS - Mechanical items & Spares</option>
                <option value="ZNVA">ZNVA - NVM - Assets</option>
                <option value="ZNVM">ZNVM - Non-valuated materials</option>
                <option value="ZPAC">ZPAC - Packaging Materials</option>
                <option value="ZPRT">ZPRT - Production Tools</option>
                <option value="ZRET">ZRET - Returnable packaging</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Plant ID</label>
              <div className="relative">
                <input type="text" required value={formData.plant} readOnly className="block w-full px-3 py-2.5 border border-gray-200 rounded-md bg-gray-100 text-gray-600 font-bold cursor-not-allowed focus:outline-none text-sm" />
              </div>
              <p className="mt-1 text-xs text-green-600 font-medium flex items-center gap-1">✓ Auto-filled from your profile</p>
            </div>

            <div className="relative">
              <label className={labelClass}>Storage location <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {formData.plant ? <Search className="h-4 w-4 text-gray-400" /> : <Lock className="h-4 w-4 text-gray-300" />}
                </div>
                <input
                  type="text"
                  placeholder={formData.plant ? "Search Locations..." : "Select Plant first..."}
                  value={locationSearch}
                  disabled={!formData.plant}
                  onChange={(e) => {
                    setLocationSearch(e.target.value);
                    setIsLocationOpen(true);
                    if (formData.storageLocation) setFormData((prev) => ({ ...prev, storageLocation: "" }));
                  }}
                  onFocus={() => setIsLocationOpen(true)}
                  onBlur={() => setTimeout(() => setIsLocationOpen(false), 200)}
                  className="block w-full py-2 pl-9 pr-8 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
                {isLocationOpen && formData.plant && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 mt-1 max-h-56 overflow-y-auto rounded-md shadow-lg">
                    {filteredLocations.length > 0 ? (
                      filteredLocations.map((loc) => (
                        <li
                          key={loc.code}
                          className="px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-gray-700 border-b border-gray-50"
                          onMouseDown={() => {
                            setFormData((prev) => ({ ...prev, storageLocation: loc.code }));
                            setLocationSearch(loc.code);
                            setIsLocationOpen(false);
                          }}
                        >
                          <span className="font-bold">{loc.code}</span> - {loc.desc}
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-2 text-sm text-gray-500 text-center italic">No locations mapped.</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <SearchableDropdown
                  label={<>Sales Organization <span className="text-red-500">*</span></>}
                  options={salesOrgs}
                  value={formData.salesOrg}
                  onChange={(val) => {
                      setFormData((prev) => ({ ...prev, salesOrg: val }));
                      if (formErrors.salesOrg) setFormErrors(prev => ({ ...prev, salesOrg: null }));
                  }}
                  placeholder="Select Sales Org..."
                />
                {formErrors.salesOrg && <p className="text-red-500 text-xs font-bold mt-1">{formErrors.salesOrg}</p>}
            </div>

            <div>
                <SearchableDropdown
                  label={<>Distribution Channel <span className="text-red-500">*</span></>}
                  options={distChannels}
                  value={formData.distChannel}
                  onChange={(val) => {
                      setFormData((prev) => ({ ...prev, distChannel: val }));
                      if (formErrors.distChannel) setFormErrors(prev => ({ ...prev, distChannel: null }));
                  }}
                  placeholder="Select Dist Channel..."
                />
                {formErrors.distChannel && <p className="text-red-500 text-xs font-bold mt-1">{formErrors.distChannel}</p>}
            </div>

            <div className="relative">
              <label className={labelClass}>Base Unit of Measure <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search or Select UOM..."
                  value={uomSearch}
                  required={!formData.baseUom}
                  onChange={(e) => {
                    setUomSearch(e.target.value);
                    setIsUomOpen(true);
                    if (formData.baseUom) setFormData((prev) => ({ ...prev, baseUom: "" }));
                  }}
                  onFocus={() => setIsUomOpen(true)}
                  onBlur={() => setTimeout(() => setIsUomOpen(false), 200)}
                  className="block w-full py-2 pl-9 pr-8 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
                {isUomOpen && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 mt-1 max-h-56 overflow-y-auto rounded-md shadow-lg">
                    {filteredUoms.length > 0 ? (
                      filteredUoms.map((u, index) => (
                        <li
                          key={index}
                          className="px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-gray-700 border-b border-gray-50"
                          onMouseDown={() => {
                            setFormData((prev) => ({ ...prev, baseUom: u.code }));
                            setUomSearch(u.code);
                            setIsUomOpen(false);
                          }}
                        >
                          <span className="font-bold">{u.code}</span> {u.desc ? `- ${u.desc}` : ""}
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-2 text-sm text-gray-500 text-center italic">No matching UOMs found.</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative">
              <label className={labelClass}>Material Group <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search or Select..."
                  value={groupSearch}
                  required={!formData.materialGroup}
                  onChange={(e) => {
                    setGroupSearch(e.target.value);
                    setIsGroupOpen(true);
                    if (formData.materialGroup) setFormData((prev) => ({ ...prev, materialGroup: "" }));
                  }}
                  onFocus={() => setIsGroupOpen(true)}
                  onBlur={() => setTimeout(() => setIsGroupOpen(false), 200)}
                  className="block w-full py-2 pl-9 pr-8 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
                {isGroupOpen && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 mt-1 max-h-56 overflow-y-auto rounded-md shadow-lg">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => (
                        <li
                          key={group.code}
                          className="px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-gray-700 border-b border-gray-50"
                          onMouseDown={() => {
                            setFormData((prev) => ({ ...prev, materialGroup: group.code }));
                            setGroupSearch(group.code);
                            setIsGroupOpen(false);
                          }}
                        >
                          <span className="font-bold">{group.code}</span> - {group.desc}
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-2 text-sm text-gray-500 text-center italic">No matching groups found.</li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>Control code</label>
              <input
                type="text"
                name="controlCode"
                value={formData.controlCode}
                onChange={handleControlCodeChange}
                maxLength={8}
                className={`block w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm outline-none ${
                    formErrors.controlCode ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="HSN/SAC (4-8 digits)"
              />
              {formErrors.controlCode && <p className="text-red-500 text-xs font-bold mt-1">{formErrors.controlCode}</p>}
            </div>

            <div>
                <SearchableDropdown
                  label={<>Purchasing Group <span className="text-red-500">*</span></>}
                  options={purchasingGroups}
                  value={formData.purchasingGroup}
                  onChange={(val) => {
                      setFormData((prev) => ({ ...prev, purchasingGroup: val }));
                      if (formErrors.purchasingGroup) setFormErrors(prev => ({ ...prev, purchasingGroup: null }));
                  }}
                  placeholder="Select Purch Group..."
                />
                {formErrors.purchasingGroup && <p className="text-red-500 text-xs font-bold mt-1">{formErrors.purchasingGroup}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className={`${labelClass} flex justify-between`}>
                Valuation Category 
                <span className="text-[10px] text-blue-600 font-normal uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">Auto-filled</span>
              </label>
              <input type="text" name="valuationCategory" value={formData.valuationCategory} readOnly className={`${inputClass} bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border-gray-200`} placeholder="Select Material Type first" />
            </div>
            <div>
              <label className={`${labelClass} flex justify-between`}>
                Valuation Class 
                <span className="text-[10px] text-blue-600 font-normal uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">Auto-filled</span>
              </label>
              <input type="text" name="valuationClass" value={formData.valuationClass} readOnly className={`${inputClass} bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border-gray-200`} placeholder="Select Material Type first" />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-8 py-5 border-t border-gray-200 flex justify-end">
          <button type="button" className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 mr-3 transition-colors">
            Save Draft
          </button>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              isCheckingDuplicate ||
              !formData.materialDesc ||
              !formData.materialGroup ||
              !formData.plant ||
              !formData.storageLocation ||
              !formData.baseUom
            }
            className="flex items-center gap-2 bg-blue-600 py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-bold text-white hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            Submit for Approval
          </button>
        </div>
      </form>

      {/* 🎯 NEW: THE OVERRIDE MODAL */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 border-t-4 border-yellow-500">
            
            <h3 className="text-xl font-black text-gray-900 mb-2 flex items-center gap-2">
              <AlertOctagon className="w-6 h-6 text-yellow-500" />
              Potential Duplicates Found
            </h3>
            <p className="text-sm text-gray-600 mb-4">{duplicateWarning || "Our system has found highly similar materials. Please verify that this is a completely new item before proceeding."}</p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
              <ul className="space-y-3">
                {duplicateMatches.map((match, idx) => (
                  <li key={idx} className="text-sm bg-white p-3 rounded shadow-sm border border-yellow-100 flex justify-between items-center">
                    <span className="font-bold text-gray-800">{match.desc}</span>
                    <span className="text-gray-500 font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-100">Code: {match.code !== "None" ? match.code : "Pending"}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button 
                type="button"
                onClick={() => setIsOverrideModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel & Edit Description
              </button>
              
              <button 
                type="button"
                onClick={executeFinalSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 flex items-center gap-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Yes, Create Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewRequestForm;