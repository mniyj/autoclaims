
import React from 'react';

interface FileDisplayProps {
  label: string;
  fileName?: string;
}

const FileDisplay: React.FC<FileDisplayProps> = ({ label, fileName }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="mt-1 flex items-center p-3 h-11 w-full border border-gray-200 rounded-md bg-gray-50 text-sm">
        {fileName ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-gray-800 truncate flex-grow">{fileName}</span>
            <a href="#" className="ml-4 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-800 flex-shrink-0">
              下载
            </a>
          </>
        ) : (
          <span className="text-gray-400">未上传</span>
        )}
      </div>
    </div>
  );
};

export default FileDisplay;
