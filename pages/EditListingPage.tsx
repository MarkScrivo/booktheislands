import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { ImageUpload } from '../components/ImageUpload';
import { VideoUpload } from '../components/VideoUpload';
import { GalleryUpload } from '../components/GalleryUpload';
import { Loader2, Save } from 'lucide-react';
import { useQuery } from 'convex/react';
import { Id } from '../convex/_generated/dataModel';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Water Sports',
  'Wellness',
  'Nature',
  'Adventure',
  'Cultural',
  'Transportation',
  'Food & Drink',
  'Relaxation'
] as const;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface EditListingPageProps {
  listingId?: string;
}

export const EditListingPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get('id');

  const updateListing = useMutation(api.listings.update);

  // Only query if we have a valid listingId
  const listing = useQuery(
    api.listings.get,
    listingId ? { id: listingId as Id<"listings"> } : "skip"
  );

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Water Sports' as typeof CATEGORIES[number],
    price: '',
    location: '',
    duration: '',
    maxCapacity: '',
    operatingDays: [] as string[],
    latitude: '',
    longitude: '',
  });

  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [galleryStorageIds, setGalleryStorageIds] = useState<Id<"_storage">[]>([]);
  const [videoStorageId, setVideoStorageId] = useState<Id<"_storage"> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load listing data when available
  useEffect(() => {
    if (listing && listing !== undefined) {
      setFormData({
        title: listing.title,
        description: listing.description,
        category: listing.category as typeof CATEGORIES[number],
        price: listing.price.toString(),
        location: listing.location,
        duration: listing.duration || '',
        maxCapacity: listing.maxCapacity.toString(),
        operatingDays: listing.operatingDays,
        latitude: listing.latitude?.toString() || '',
        longitude: listing.longitude?.toString() || '',
      });
    }
  }, [listing]);

  // Redirect if no listing ID
  useEffect(() => {
    if (!listingId) {
      navigate('/vendor');
    }
  }, [listingId, navigate]);

  // Redirect non-vendors
  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== 'vendor')) {
      toast.error('You must be a vendor to edit listings');
      navigate('/');
    }
  }, [user, profile, authLoading, navigate]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';

    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = 'Valid price is required';
    }

    const capacity = parseInt(formData.maxCapacity);
    if (!formData.maxCapacity || isNaN(capacity) || capacity <= 0) {
      newErrors.maxCapacity = 'Valid capacity is required';
    }

    if (formData.operatingDays.length === 0) {
      newErrors.operatingDays = 'Select at least one operating day';
    }

    // Image is optional for edit (can keep existing)
    // if (!imageStorageId) {
    //   newErrors.image = 'Please upload a listing image';
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !listingId) return;

    setSubmitting(true);
    try {
      await updateListing({
        id: listingId as Id<"listings">,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        price: parseFloat(formData.price),
        location: formData.location.trim(),
        duration: formData.duration.trim() || undefined,
        maxCapacity: parseInt(formData.maxCapacity),
        operatingDays: formData.operatingDays,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        imageStorageId: imageStorageId || undefined,
        galleryStorageIds: galleryStorageIds.length > 0 ? galleryStorageIds : undefined,
        videoStorageId: videoStorageId || undefined,
      });

      toast.success('Listing updated successfully!');
      navigate('/vendor');
    } catch (error: any) {
      console.error('Failed to update listing:', error);
      toast.error(error.message || 'Failed to update listing');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      operatingDays: prev.operatingDays.includes(day)
        ? prev.operatingDays.filter(d => d !== day)
        : [...prev.operatingDays, day]
    }));
  };

  // If no listing ID, show nothing (useEffect will redirect)
  if (!listingId) {
    return null;
  }

  // Show loading while auth or listing data loads
  if (authLoading || listing === undefined) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // If listing query failed or returned null
  if (!listing) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-red-600">Listing not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Edit Listing</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Update your listing information</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="e.g., Sunrise Yoga on the Beach"
              />
              {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Describe your activity in detail..."
              />
              {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as typeof CATEGORIES[number] })}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Price and Capacity Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Price (THB/person) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="500"
                />
                {errors.price && <p className="text-red-600 text-sm mt-1">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Max Capacity *
                </label>
                <input
                  type="number"
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="10"
                />
                {errors.maxCapacity && <p className="text-red-600 text-sm mt-1">{errors.maxCapacity}</p>}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Location *
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="e.g., Haad Rin Beach, Koh Phangan"
              />
              {errors.location && <p className="text-red-600 text-sm mt-1">{errors.location}</p>}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Duration (optional)
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="e.g., 2 hours, Full day, 3 days"
              />
            </div>

            {/* Operating Days */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Operating Days *
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-4 py-2 rounded-lg font-bold transition ${
                      formData.operatingDays.includes(day)
                        ? 'bg-teal-600 dark:bg-teal-500 text-white hover:bg-teal-700 dark:hover:bg-teal-600'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {errors.operatingDays && <p className="text-red-600 text-sm mt-1">{errors.operatingDays}</p>}
            </div>

            {/* Coordinates (optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Latitude (optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="9.7489"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Longitude (optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="100.0011"
                />
              </div>
            </div>

            {/* Image Upload */}
            <ImageUpload
              label="Main Listing Image"
              onUploadComplete={(storageId) => setImageStorageId(storageId)}
              onRemove={() => setImageStorageId(null)}
              currentImageUrl={listing?.imageUrl}
              maxSizeMB={10}
            />
            {errors.image && <p className="text-red-600 text-sm mt-1">{errors.image}</p>}

            {/* Gallery Upload */}
            <GalleryUpload
              label="Gallery Images (optional)"
              onUploadComplete={(storageIds) => setGalleryStorageIds(storageIds)}
              currentImageUrls={listing?.galleryUrls}
              maxImages={5}
              maxSizeMB={10}
            />

            {/* Video Upload */}
            <VideoUpload
              label="Listing Video (optional)"
              onUploadComplete={(storageId) => setVideoStorageId(storageId)}
              onRemove={() => setVideoStorageId(null)}
              currentVideoUrl={listing?.videoUrl}
              maxSizeMB={100}
            />

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/vendor')}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
