import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Star, Calendar, CheckCircle, TrendingUp,
  MessageSquare, Loader2, ImageIcon
} from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { Listing, Review, ActivityCategory } from '../types';
import { Id } from '../convex/_generated/dataModel';

interface ListingDetailsPageProps {
  onBook: (listing: Listing) => void;
}

export const ListingDetailsPage: React.FC<ListingDetailsPageProps> = ({ onBook }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // 🎉 Convex automatically fetches and keeps data in sync!
  const convexListing = useQuery(api.listings.get, id ? { id: id as Id<"listings"> } : "skip");
  const convexReviews = useQuery(api.reviews.getByListing, id ? { listingId: id as Id<"listings"> } : "skip");
  const createReviewMutation = useMutation(api.reviews.create);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Convert Convex listing to our Listing type
  const listing: Listing | null = convexListing ? {
    id: convexListing._id,
    title: convexListing.title,
    description: convexListing.description,
    location: convexListing.location,
    price: convexListing.price,
    rating: convexListing.rating,
    reviewCount: convexListing.reviewCount,
    imageUrl: convexListing.imageUrl,
    category: convexListing.category as ActivityCategory,
    vendorName: convexListing.vendorName,
    vendorId: convexListing.vendorId || undefined,
    duration: convexListing.duration,
    galleryUrls: convexListing.galleryUrls,
    videoUrl: convexListing.videoUrl,
    maxCapacity: convexListing.maxCapacity,
    operatingDays: convexListing.operatingDays,
    latitude: convexListing.latitude,
    longitude: convexListing.longitude,
  } : null;

  // Convert Convex reviews to our Review type
  const reviews: Review[] = (convexReviews || []).map(review => ({
    id: review._id,
    listingId: review.listingId,
    userId: review.userId,
    userName: review.userName,
    rating: review.rating,
    comment: review.comment,
    createdAt: new Date(review.createdAt).toISOString(),
  }));

  const isLoading = convexListing === undefined;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setIsSubmittingReview(true);
    try {
      await createReviewMutation({
        listingId: id as Id<"listings">,
        rating,
        comment,
      });
      setComment('');
      setRating(5);
      // Reviews will auto-update via Convex reactivity! 🎉
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleContactVendor = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (listing && listing.vendorId) {
      navigate('/inbox', { state: { recipientId: listing.vendorId } });
    }
  };

  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11)
      ? `https://www.youtube.com/embed/${match[2]}?origin=${window.location.origin}&rel=0`
      : null;
  };

  const isYoutubeUrl = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="h-screen flex items-center justify-center">
        Listing not found
      </div>
    );
  }

  const embedUrl = isYoutubeUrl(listing.videoUrl || '') ? getYouTubeEmbedUrl(listing.videoUrl || '') : null;
  const scheduleDisplay = listing.operatingDays.length === 7 ? "Daily" : listing.operatingDays.join(', ');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header & Title */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 mb-4 text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Search
          </Link>
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">{listing.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" /> {listing.location}
                </span>
                <span className="flex items-center gap-1.5 text-gray-900 dark:text-white font-medium">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> {listing.rating}{' '}
                  <span className="text-gray-500 dark:text-gray-400 font-normal">({listing.reviewCount} reviews)</span>
                </span>
                <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-xs font-semibold uppercase tracking-wide">
                  {listing.category}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Image */}
        <div className="relative w-full h-[60vh] rounded-3xl overflow-hidden mb-4">
          <img src={listing.imageUrl} className="w-full h-full object-cover" alt={listing.title} />
        </div>

        {/* Gallery Grid */}
        {listing.galleryUrls && listing.galleryUrls.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
            {listing.galleryUrls.map((url, idx) => (
              <div key={idx} className="relative group cursor-pointer aspect-square rounded-xl overflow-hidden">
                <img src={url} className="w-full h-full object-cover" alt={`Gallery ${idx + 1}`} />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Content */}
          <div className="lg:col-span-2 space-y-10">
            <div className="prose prose-lg max-w-none text-gray-600 dark:text-gray-400">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">About this activity</h2>
              <p className="leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8 border-y border-gray-100 dark:border-gray-800">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold">Hosted By</span>
                <p className="font-medium text-gray-900 dark:text-white">{listing.vendorName}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold">Duration</span>
                <p className="font-medium text-gray-900 dark:text-white">{listing.duration}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold">Max Guests</span>
                <p className="font-medium text-gray-900 dark:text-white">{listing.maxCapacity}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold">Schedule</span>
                <p className="font-medium text-gray-900 dark:text-white">{scheduleDisplay}</p>
              </div>
            </div>

            {listing.videoUrl && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Video Tour</h2>
                <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title="Excursion Video"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <video controls className="w-full h-full">
                      <source src={listing.videoUrl} />
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Guest Reviews</h2>
                <div className="flex items-center gap-2">
                  <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{listing.rating}</span>
                  <span className="text-gray-500 dark:text-gray-400">/ 5.0</span>
                </div>
              </div>

              {user && (
                <form onSubmit={handleSubmitReview} className="mb-10 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Write a Review</h3>
                  <div className="mb-4 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} type="button" onClick={() => setRating(s)} className="transition-transform hover:scale-110">
                        <Star className={`w-8 h-8 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-600'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience with other travelers..."
                    className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm mb-4 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    rows={3}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-6 py-3 bg-gray-900 dark:bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-600 dark:hover:bg-teal-500 transition-colors disabled:opacity-50 shadow-lg"
                  >
                    {isSubmittingReview ? 'Posting...' : 'Post Review'}
                  </button>
                </form>
              )}

              <div className="space-y-8">
                {reviews.length > 0 ? reviews.map(review => (
                  <div key={review.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0">
                      {review.userName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{review.userName}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[...Array(review.rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">• {review.createdAt}</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{review.comment}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-2xl border-dashed border-2 border-gray-200 dark:border-gray-700">
                    <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No reviews yet. Be the first to share your thoughts!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 md:p-8 border border-gray-100 dark:border-gray-700">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-sm text-gray-400 dark:text-gray-500 line-through font-medium">${listing.price + 15}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">${listing.price}</span>
                    <span className="text-gray-500 dark:text-gray-400 font-medium">/ person</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold bg-red-50 text-red-600 px-3 py-1.5 rounded-full uppercase tracking-wide">
                  <TrendingUp className="w-3 h-3" /> Best Price
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl">
                  <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" /> <span>Free cancellation (24h)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" /> <span>Instant Confirmation</span>
                </div>
              </div>

              <button
                onClick={() => onBook(listing)}
                className="w-full py-4 bg-gray-900 dark:bg-teal-600 hover:bg-teal-600 dark:hover:bg-teal-500 text-white font-bold text-lg rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 active:scale-[0.98]"
              >
                Check Availability
              </button>

              {user?.id !== listing.vendorId && (
                <button
                  onClick={handleContactVendor}
                  className="w-full mt-4 py-3 text-gray-600 dark:text-gray-400 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Ask Vendor a Question
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
