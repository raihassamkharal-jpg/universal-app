import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Upload,
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  FileArchive,
  Download,
  Trash2,
  Search,
  Loader2,
  FolderPlus,
} from 'lucide-react';
import {
  fetchDriveFiles,
  uploadDriveFile,
  deleteDriveFile,
} from '../../lib/supabase/client';
import { formatFileSize, formatMessageTime } from '../../lib/utils';
import type { DriveFile } from '../../types/database';

interface UniversalDriveViewProps {
  currentUserId: string;
}

export const UniversalDriveView: React.FC<UniversalDriveViewProps> = ({ currentUserId }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const data = await fetchDriveFiles(currentUserId);
    setFiles(data);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    setUploading(true);
    const uploaded = await uploadDriveFile(
      currentUserId,
      file,
      activeFolder === 'All' ? 'General' : activeFolder
    );
    setUploading(false);

    if (uploaded) {
      setFiles((prev) => [uploaded, ...prev]);
      setErrorNotice(null);
    } else {
      setErrorNotice('Upload failed. Please check your file and try again.');
    }
  };

  const handleDelete = async (fileId: string) => {
    const ok = await deleteDriveFile(fileId, currentUserId);
    if (ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  // Derive unique folders
  const folders = Array.from(new Set(files.map((f) => f.folder_name || 'General')));

  // Total storage calculated
  const totalBytes = files.reduce((acc, f) => acc + (f.file_size || 0), 0);

  const filteredFiles = files.filter((f) => {
    if (activeFolder !== 'All' && (f.folder_name || 'General') !== activeFolder) {
      return false;
    }
    if (searchQuery.trim()) {
      return f.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    }
    return true;
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-purple-500" />;
    if (type.includes('zip') || type.includes('compressed'))
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    return <FileText className="w-5 h-5 text-emerald-500" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Universal Drive
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Cloud storage for your personal documents, media, and attachments ({formatFileSize(totalBytes)} used)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer">
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>Upload File</span>
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {errorNotice && (
        <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between shrink-0">
          <span>{errorNotice}</span>
          <button type="button" onClick={() => setErrorNotice(null)} className="text-neutral-400 hover:text-neutral-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Sub-bar: Folder Filter & Search */}
      <div className="px-4 sm:px-6 py-3 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveFolder('All')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeFolder === 'All'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            All Files
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                activeFolder === folder
                  ? 'bg-orange-500 text-white shadow-2xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              <Folder className="w-3 h-3" />
              <span>{folder}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search drive files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-60 pl-9 pr-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-neutral-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
            <span className="text-xs">Loading your drive files...</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
              <HardDrive className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-neutral-800 text-sm">No files uploaded yet</h4>
            <p className="text-xs text-neutral-500 max-w-xs mt-1">
              Upload files to keep them safe, accessible across all devices, and easy to share in chat.
            </p>
          </div>
        ) : (
          filteredFiles.map((file) => (
            <div
              key={file.id}
              className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/80 px-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                  {getFileIcon(file.file_type)}
                </div>
                <div className="min-w-0">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-xs sm:text-sm text-neutral-900 hover:text-orange-600 transition-colors truncate block"
                  >
                    {file.name}
                  </a>
                  <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{file.folder_name || 'General'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatMessageTime(file.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={file.file_url}
                  download={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </a>

                <button
                  onClick={() => handleDelete(file.id)}
                  className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
