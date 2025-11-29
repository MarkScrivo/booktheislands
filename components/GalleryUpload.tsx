import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Id } from '../convex/_generated/dataModel';

interface GalleryUploadProps {
  onUploadComplete: (storageIds: Id<"_storage">[]) => void;
  currentImageUrls?: string[];
  label?: string;
  maxImages?: number;
  maxSizeMB?: number;
}

export const GalleryUpload: React.FC<GalleryUploadProps> = ({
  onUploadComplete,
  currentImageUrls = [],
  label = "Gallery Images",
  maxImages = 5,
  maxSizeMB = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>(currentImageUrls);
  const [storageIds, setStorageIds] = useState<Id<"_storage">[]>([]);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  // Update previews when currentImageUrls changes (e.g., when listing data loads)
  useEffect(() => {
    if (currentImageUrls && currentImageUrls.length > 0) {
      setPreviews(currentImageUrls);
    }
  }, [currentImageUrls]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setError(null);

    // Check if adding these files would exceed max
    if (previews.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Validate all files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('All files must be images');
        return;
      }

      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        setError(`Each image must be smaller than ${maxSizeMB} MB`);
        return;
      }
    }

    try {
      setUploading(true);
      const newPreviews: string[] = [];
      const newStorageIds: Id<"_storage">[] = [];

      // Upload each file
      for (const file of files) {
        // Create preview
        const reader = new FileReader();
        const previewPromise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const preview = await previewPromise;
        newPreviews.push(preview);

        // Upload to Convex
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const { storageId } = await response.json();
        newStorageIds.push(storageId);
      }

      // Update state
      const updatedPreviews = [...previews, ...newPreviews];
      const updatedStorageIds = [...storageIds, ...newStorageIds];

      setPreviews(updatedPreviews);
      setStorageIds(updatedStorageIds);
      onUploadComplete(updatedStorageIds);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    const updatedPreviews = previews.filter((_, i) => i !== index);
    const updatedStorageIds = storageIds.filter((_, i) => i !== index);

    setPreviews(updatedPreviews);
    setStorageIds(updatedStorageIds);
    onUploadComplete(updatedStorageIds);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-gray-700">
        {label} ({previews.length}/{maxImages})
      </label>

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={preview}
                alt={`Gallery ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition"
                disabled={uploading}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {previews.length < maxImages && (
        <label className="w-full h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-2" />
              <p className="text-sm text-gray-500">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 font-bold">
                Click to add gallery images
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG up to {maxSizeMB}MB each
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
    </div>
  );
};
