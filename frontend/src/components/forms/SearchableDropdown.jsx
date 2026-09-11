import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Lock } from 'lucide-react';

const SearchableDropdown = ({ label, required, value, options, onChange, disabled, placeholder }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (value) {
            setSearch(value);
        } else {
            setSearch('');
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o =>
        o.code.toLowerCase().includes(search.toLowerCase()) ||
        (o.desc && o.desc.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="relative" ref={wrapperRef}>
            <label className="block text-xs font-bold text-gray-700 mb-1 tracking-wide">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {disabled ? <Lock className="h-4 w-4 text-gray-300" /> : <Search className="h-4 w-4 text-gray-400" />}
                </div>
                <input
                    type="text"
                    placeholder={placeholder || "Search or Select..."}
                    value={search}
                    disabled={disabled}
                    required={required && !value}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                        if (value) onChange(''); 
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="block w-full py-2 pl-9 pr-8 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>

                {isOpen && !disabled && (
                    <ul className="absolute z-20 w-full bg-white border border-gray-300 mt-1 max-h-56 overflow-y-auto rounded-md shadow-lg">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => (
                                <li
                                    key={idx}
                                    className="px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-gray-700 border-b border-gray-50"
                                    onMouseDown={() => {
                                        onChange(opt.code); 
                                        setIsOpen(false);
                                    }}
                                >
                                    <span className="font-bold">{opt.code}</span> {opt.desc ? `- ${opt.desc}` : ''}
                                </li>
                            ))
                        ) : (
                            <li className="px-3 py-2 text-sm text-gray-500 text-center italic">No matching results.</li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default SearchableDropdown;