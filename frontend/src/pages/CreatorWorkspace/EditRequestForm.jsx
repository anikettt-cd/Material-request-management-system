import React, { useState, useEffect } from "react";
import {
  Send,
  Loader2,
  Search,
  ChevronDown,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import SearchableDropdown from "../../components/forms/SearchableDropdown";
import apiClient from "../../services/apiClient";

const EditRequestForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // 📊 Master Data States
  const [plants, setPlants] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [materialGroups, setMaterialGroups] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [salesOrgs, setSalesOrgs] = useState([]);
  const [distChannels, setDistChannels] = useState([]);
  const [purchasingGroups, setPurchasingGroups] = useState([]);
  const [valCategoryMap, setValCategoryMap] = useState({});
  const [valClassMap, setValClassMap] = useState({});

  // ⚙️ System States
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState(null);
  
  // 🎯 Field-level error state for required fields
  const [formErrors, setFormErrors] = useState({}); 

  // 🚨 Duplicate Checker State
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // 🔍 Searchable Dropdown States
  const [groupSearch, setGroupSearch] = useState("");
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [plantSearch, setPlantSearch] = useState("");
  const [isPlantOpen, setIsPlantOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [uomSearch, setUomSearch] = useState("");
  const [isUomOpen, setIsUomOpen] = useState(false);

  const [formData, setFormData] = useState({
    materialType: "ZCOM",
    plant: "",
    storageLocation: "",
    salesOrg: "",
    distChannel: "",
    materialDesc: "",
    longDescription: "", // 🎯 Included!
    baseUom: "",
    materialGroup: "",
    controlCode: "",
    purchasingGroup: "",
    valuationCategory: "",
    valuationClass: "",
  });

  // 📥 FETCH MASTER DATA EXCEL FILES & EXISTING REQUEST DATA
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

    const fetchAllData = async () => {
      setIsFetchingData(true);
      try {
        const [
          rawPlants,
          rawLocations,
          rawGroups,
          rawUoms,
          rawSales,
          rawDist,
          rawPurch,
          rawValGroup,
          rawValClass,
        ] = await Promise.all([
          fetchApiData("plants"),
          fetchApiData("locations"),
          fetchApiData("material_groups"),
          fetchApiData("uom"),
          fetchApiData("Sales_Organization"),
          fetchApiData("Distribution_Channel"),
          fetchApiData("Purchasing_Group"),
          fetchApiData("Valuation_Group"),
          fetchApiData("Valuation_Class"),
        ]);

        setPlants(rawPlants.map((p) => ({ code: String(p["Plant"] || ""), desc: p["Description"] || "" })));
        setAllLocations(rawLocations.map((loc) => ({
            plantCode: String(loc["Plant"] || ""),
            code: String(loc["Storage Location"] || ""),
            desc: loc["Storage Location description"] || "",
        })));
        setUoms(rawUoms.map((u) => ({ code: String(u["UOM"] || ""), desc: u["UOM Description"] || "" })));

        const mapBulletproof = (rawData) =>
          rawData.map((item) => ({
            code: String(item[Object.keys(item)[0]] || "").trim(),
            desc: String(item[Object.keys(item)[1]] || "").trim(),
          }));
          
        const mapAndDedupe = (rawData) => {
          const map = new Map();
          rawData.forEach((item) => {
            const code = String(item[Object.keys(item)[0]] || "").trim();
            if (code && !map.has(code)) map.set(code, { code, desc: String(item[Object.keys(item)[1]] || "").trim() });
          });
          return Array.from(map.values());
        };

        setMaterialGroups(mapBulletproof(rawGroups));
        setSalesOrgs(mapAndDedupe(rawSales));
        setDistChannels(mapAndDedupe(rawDist));
        setPurchasingGroups(mapAndDedupe(rawPurch));

        const catMap = {};
        rawValGroup.forEach((row) => (catMap[String(row[Object.keys(row)[0]] || "").trim()] = String(row[Object.keys(row)[1]] || "").trim()));
        const clsMap = {};
        rawValClass.forEach((row) => (clsMap[String(row[Object.keys(row)[0]] || "").trim()] = String(row[Object.keys(row)[1]] || "").trim()));

        setValCategoryMap(catMap);
        setValClassMap(clsMap);

        // Fetch Existing Request Data
        if (id) {
          const reqResponse = await apiClient.get(`/creator/requests/${id}`);
          const reqData = reqResponse.data;

          setFormData({
            materialDesc: reqData.material_description || "",
            longDescription: reqData.long_description || "", // 🎯 Prefill Long Description
            materialType: reqData.material_type || "",
            plant: reqData.plant_id || "",
            storageLocation: reqData.storage_location || "",
            salesOrg: reqData.sales_org || "",
            distChannel: reqData.dist_channel || "",
            baseUom: reqData.base_unit_of_measure || "",
            materialGroup: reqData.material_group || "",
            controlCode: reqData.control_code_gst || "",
            purchasingGroup: reqData.purchasing_group || "",
            valuationCategory: reqData.valuation_category || "",
            valuationClass: reqData.valuation_class || "",
          });

          setPlantSearch(reqData.plant_id || "");
          setLocationSearch(reqData.storage_location || "");
          setGroupSearch(reqData.material_group || "");
          setUomSearch(reqData.base_unit_of_measure || "");
        }
      } catch (err) {
        console.error("Data Fetch Error:", err);
        setError("Failed to load existing request data.");
      } finally {
        setIsFetchingData(false);
      }
    };

    fetchAllData();
  }, [id]);

  // 🚀 LIVE DUPLICATE CHECKER (DEBOUNCED)
  useEffect(() => {
    if (formData.materialDesc.length < 3) {
      setDuplicateWarnings([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const response = await apiClient.get(`/creator/check-duplicate?query=${encodeURIComponent(formData.materialDesc)}`);
        setDuplicateWarnings(response.data.matches);
      } catch (err) {
        console.error("Failed to check for duplicates:", err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [formData.materialDesc]);

  // 🔍 Filter Logic
  const filteredGroups = materialGroups.filter((g) => g.code.toLowerCase().includes(groupSearch.toLowerCase()) || g.desc.toLowerCase().includes(groupSearch.toLowerCase()));
  const filteredPlants = plants.filter((p) => p.code.toLowerCase().includes(plantSearch.toLowerCase()) || p.desc.toLowerCase().includes(plantSearch.toLowerCase()));
  const filteredUoms = uoms.filter((u) => u.code.toLowerCase().includes(uomSearch.toLowerCase()) || u.desc.toLowerCase().includes(uomSearch.toLowerCase()));
  const availableLocations = formData.plant ? allLocations.filter((loc) => loc.plantCode === formData.plant) : [];
  const filteredLocations = availableLocations.filter((loc) => loc.code.toLowerCase().includes(locationSearch.toLowerCase()) || loc.desc.toLowerCase().includes(locationSearch.toLowerCase()));

  // 🎯 STANDARD INPUT HANDLER
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear error immediately when user types
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

  // 🎯 RESTRICTED CONTROL CODE HANDLER
  const handleControlCodeChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, ""); // Strip non-numbers
    
    if (numbersOnly.length <= 8) { // Max 8 chars
      setFormData((prev) => ({ ...prev, controlCode: numbersOnly }));
      // Clear error if they fix it
      if (numbersOnly.length >= 4 || numbersOnly.length === 0) {
        setFormErrors((prev) => ({ ...prev, controlCode: null }));
      }
    }
  };

  // 🎯 PRE-FLIGHT VALIDATION ON SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};

    // Check Control Code (Min 4 digits if filled)
    if (formData.controlCode && formData.controlCode.length > 0 && formData.controlCode.length < 4) {
      newErrors.controlCode = "Control code must be between 4 and 8 digits.";
    }

    // Check Required Fields
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

    // If there are errors, stop and show them
    if (Object.keys(newErrors).length > 0) {
        setFormErrors(newErrors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return; 
    }

    setIsSubmitting(true);
    setSuccessMessage("");
    setError(null);

    const payload = {
      material_description: formData.materialDesc,
      long_description: formData.longDescription, // Added to payload
      material_type: formData.materialType,
      plant_id: formData.plant,
      storage_location: formData.storageLocation,
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
      await apiClient.put(`/creator/re-submit/${id}`, payload);
      setSuccessMessage(`Success! Corrections applied and returned to pending queue.`);
      setTimeout(() => {
        navigate("/creator/my-requests");
      }, 2000);
    } catch (err) {
      console.error("Submission error:", err);
      setError(err.response?.data?.detail || "An error occurred while re-submitting the request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm";
  const labelClass = "block text-xs font-bold text-gray-700 mb-1 tracking-wide";

  if (isFetchingData) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500 font-medium">Fetching Request #{id}...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Material Request #{id}</h1>
          <p className="text-gray-500 mt-1">Update the necessary fields to fix the requested corrections.</p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-md shadow-sm">
          <span className="text-sm text-green-800 font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
          <span className="text-sm text-red-800 font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 space-y-8">
          
          {/* MATERIAL DESCRIPTION */}
          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 relative">
            <label className={labelClass}>
              Material description <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                name="materialDesc"
                required
                maxLength={40}
                value={formData.materialDesc}
                onChange={handleChange}
                placeholder="Must be within 40 characters..."
                className="block w-full py-3 px-4 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base font-medium shadow-sm pr-10"
              />
              {isCheckingDuplicates && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Loader2 className="animate-spin h-5 w-5 text-blue-500" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">{formData.materialDesc.length}/40 characters</p>

            {duplicateWarnings.length > 0 && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 p-4 rounded-md shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-yellow-800">Potential Duplicates Found</h4>
                    <p className="text-xs text-yellow-700 mt-1 mb-2">
                      Similar materials already exist. Please use the existing SAP Code instead of requesting a new one if listed below.
                    </p>
                    <ul className="text-xs text-yellow-900 font-mono space-y-1.5 bg-yellow-100/50 p-2 rounded border border-yellow-200">
                      {duplicateWarnings.map((match) => (
                        <li key={match.code} className="flex gap-2">
                          <span className="font-bold text-yellow-700 min-w-[140px]">{match.code}</span>
                          <span>{match.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 🎯 NEW: LONG MATERIAL DESCRIPTION */}
          <div>
            <label className={labelClass}>
              Long Material Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="longDescription"
              maxLength={400}
              rows={3}
              value={formData.longDescription}
              onChange={handleChange}
              placeholder="Enter detailed specifications, dimensions, or technical notes..."
              className={`block w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm ${
                formErrors.longDescription ? "border-red-500" : "border-gray-300"
              }`}
            />
            {formErrors.longDescription && (
              <p className="text-red-500 text-xs font-bold mt-1">{formErrors.longDescription}</p>
            )}
            <p className="text-xs text-gray-500 mt-1 text-right">{(formData.longDescription || "").length}/400 characters</p>
          </div>

          {/* ROW 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Material type</label>
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

            {/* PLANT */}
            <div className="relative">
              <label className={labelClass}>Plant <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search or Select..."
                  value={plantSearch}
                  required={!formData.plant}
                  onChange={(e) => {
                    setPlantSearch(e.target.value);
                    setIsPlantOpen(true);
                    if (formData.plant) {
                      setFormData((prev) => ({ ...prev, plant: "", storageLocation: "" }));
                      setLocationSearch("");
                    }
                  }}
                  onFocus={() => setIsPlantOpen(true)}
                  onBlur={() => setTimeout(() => setIsPlantOpen(false), 200)}
                  className="block w-full py-2 pl-9 pr-8 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm"
                />
                {isPlantOpen && (
                  <ul className="absolute z-20 w-full bg-white border border-gray-300 mt-1 max-h-56 overflow-y-auto rounded-md shadow-lg">
                    {filteredPlants.length > 0 ? (
                      filteredPlants.map((p) => (
                        <li
                          key={p.code}
                          className="px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-gray-700 border-b border-gray-50"
                          onMouseDown={() => {
                            setFormData((prev) => ({ ...prev, plant: p.code, storageLocation: "" }));
                            setPlantSearch(p.code);
                            setLocationSearch("");
                            setIsPlantOpen(false);
                          }}
                        >
                          <span className="font-bold">{p.code}</span> - {p.desc}
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-2 text-sm text-gray-500 text-center italic">No matching plants found.</li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* STORAGE LOCATION */}
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

          {/* ROW 2: STRICT REQUIRED DROPDOWNS */}
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

          {/* ROW 3: CONTROL CODE & PURCHASING GROUP */}
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

            {/* 🎯 RESTRICTED CONTROL CODE INPUT */}
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
              <input type="text" name="valuationCategory" value={formData.valuationCategory} readOnly className={`${inputClass} bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border-gray-200`} />
            </div>
            <div>
              <label className={`${labelClass} flex justify-between`}>
                Valuation Class 
                <span className="text-[10px] text-blue-600 font-normal uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">Auto-filled</span>
              </label>
              <input type="text" name="valuationClass" value={formData.valuationClass} readOnly className={`${inputClass} bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border-gray-200`} />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-8 py-5 border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !formData.materialDesc ||
              !formData.materialGroup ||
              !formData.plant ||
              !formData.storageLocation ||
              !formData.baseUom
            }
            className="flex items-center gap-2 bg-blue-600 py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-bold text-white hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            Re-Submit Request
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditRequestForm;