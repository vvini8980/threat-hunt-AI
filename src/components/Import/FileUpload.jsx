import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { parseExcelFile } from '../../utils/excel';

const FileUpload = ({ onFileLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (selectedFile) => {
    if (!selectedFile) return;
    
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = selectedFile.name.toLowerCase();
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
      setError('Invalid file type. Please upload an .xlsx or .xls file.');
      return;
    }

    setFile(selectedFile);
    setError('');

    try {
      const rows = await parseExcelFile(selectedFile);
      if (!rows || rows.length === 0) {
        throw new Error('The uploaded file is empty or formatted incorrectly.');
      }
      
      const headers = Object.keys(rows[0]);
      onFileLoaded(rows, headers);
    } catch (err) {
      setError(err.message || 'Failed to parse Excel file.');
      setFile(null); 
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    processFile(droppedFile);
  };

  const handleChange = (e) => {
    const selectedFile = e.target.files[0];
    processFile(selectedFile);
    e.target.value = null;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetState = () => {
    setFile(null);
    setError('');
  };

  let containerStyle = "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px] ";
  
  if (error) {
    containerStyle += "border-red-500 bg-[#1a1d27]";
  } else if (isDragging) {
    containerStyle += "border-indigo-500 bg-indigo-500/10";
  } else if (file) {
    containerStyle += "border-[#2a2d3e] bg-[#1a1d27] cursor-default";
  } else {
    containerStyle += "border-[#2a2d3e] bg-[#1a1d27] hover:border-indigo-500/50 hover:bg-[#1f2230]";
  }

  return (
    <div 
      className={containerStyle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (!file && !error) {
          fileInputRef.current?.click();
        }
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xlsx, .xls"
        onChange={handleChange}
      />

      {error ? (
        <div className="flex flex-col items-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-400 font-medium mb-6">{error}</p>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              resetState();
            }}
            className="px-6 py-2 bg-[#2a2d3e] hover:bg-[#353849] text-white rounded-lg text-sm font-medium transition-colors border border-gray-600 hover:border-gray-400"
          >
            Try again
          </button>
        </div>
      ) : file ? (
        <div className="flex flex-col items-center">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-white font-bold mb-1 text-lg">{file.name}</p>
          <p className="text-gray-400 text-sm mb-6">{formatFileSize(file.size)}</p>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              resetState();
              fileInputRef.current?.click();
            }}
            className="px-6 py-2 bg-[#2a2d3e] hover:bg-[#353849] text-white rounded-lg text-sm font-medium transition-colors border border-gray-600 hover:border-gray-400"
          >
            Change file
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Upload className={`h-12 w-12 mb-4 transition-colors ${isDragging ? 'text-indigo-400' : 'text-indigo-500'}`} />
          <p className="text-white font-bold text-lg mb-2">
            {isDragging ? 'Drop to upload' : 'Drag and drop your Excel file here'}
          </p>
          {!isDragging && (
            <p className="text-gray-400 text-sm font-medium">or click to browse</p>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
