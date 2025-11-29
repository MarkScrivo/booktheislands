import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Upload, X, Loader2, Video as VideoIcon } from 'lucide-react';
import { Id } from '../convex/_generated/dataModel';

interface VideoUploadProps {
  onUploadComplete: (storageId: Id<"_storage">) => void;
  onRemove?: () => void;
  currentVideoUrl?: string;
  label?: string;
  maxSizeMB?: number;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  onUploadComplete,
  onRemove,
  currentVideoUrl,
  label = "Upload Video",
  maxSizeMB = 100,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentVideoUrl || null);

  // Update preview when currentVideoUrl changes (e.g., when listing data loads)
  useEffect(() => {
    if (currentVideoUrl) {
      setPreview(currentVideoUrl);
    }
  }, [currentVideoUrl]);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadProgress(0);

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file');
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`File must be smaller than ${maxSizeMB} MB`);
      return;
    }

    try {
      setUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Step 1: Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      });

      const uploadPromise = new Promise<{ storageId: Id<"_storage"> }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      const { storageId } = await uploadPromise;

      // Step 3: Notify parent component
      onUploadComplete(storageId);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload video');
      setPreview(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    if (onRemove) {
      onRemove();
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-gray-700">
        {label}
      </label>

      {/* Preview or Upload Button */}
      {preview ? (
        <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden">
          <video
            src={preview}
            controls
            className="w-full h-64 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition"
            disabled={uploading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="w-full h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="w-12 h-12 text-teal-600 animate-spin mb-3" />
              <p className="text-sm text-gray-600 font-bold">
                Uploading... {uploadProgress}%
              </p>
              <div className="w-64 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-teal-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <VideoIcon className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 font-bold">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                MP4, MOV, AVI up to {maxSizeMB}MB
              </p>
            </>
          )}
        </label>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Optional: YouTube URL alternative */}
      <div className="mt-4">
        <p className="text-xs text-gray-500 text-center">
          Or paste a YouTube URL in the description/notes
        </p>
      </div>
    </div>
  );
};
