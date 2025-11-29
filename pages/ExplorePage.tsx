import React, { useState } from 'react';
import { Search, LayoutDashboard, Map, Loader2 } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Listing, ActivityCategory } from '../types';
import { ListingCard } from '../components/ListingCard';
import { AIAssistant } from '../components/AIAssistant';
import { ListingMap } from '../components/maps/ListingMap';

interface ExplorePageProps {
  onBook: (listing: Listing) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ onBook }) => {
  // 🎉 Convex automatically fetches and keeps data in sync!
  // No useState, no useEffect, no loading state needed!
  const convexListings = useQuery(api.listings.list);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Convert Convex listings to our Listing type
  const listings: Listing[] = (convexListings || []).map(listing => ({
    id: listing._id,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    price: listing.price,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    imageUrl: listing.imageUrl,
    category: listing.category as ActivityCategory,
    vendorName: listing.vendorName,
    vendorId: listing.vendorId || undefined,
    duration: listing.duration,
    galleryUrls: listing.galleryUrls,
    videoUrl: listing.videoUrl,
    maxCapacity: listing.maxCapacity,
    operatingDays: listing.operatingDays,
    latitude: listing.latitude,
    longitude: listing.longitude,
  }));

  const isLoading = convexListings === undefined;

  const filteredListings = listings.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || l.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero / Search Section */}
      <div className="text-center mb-12 space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
          Book The <span className="text-teal-600 dark:text-teal-400">Islands</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Discover unforgettable island experiences, from hidden beaches to jungle adventures.
        </p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mt-8 max-w-2xl mx-auto">
          <div className="relative w-full">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search for 'kayaking' or 'thong sala'..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex bg-white dark:bg-gray-800 p-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 rounded-full transition-all ${
                viewMode === 'grid' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-3 rounded-full transition-all ${
                viewMode === 'map' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Map className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 justify-center no-scrollbar">
          {['All', ...Object.values(ActivityCategory)].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-gray-900 dark:bg-teal-600 text-white shadow-lg transform scale-105'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredListings.map(l => (
                <ListingCard key={l.id} listing={l} onBook={onBook} />
              ))}
              {filteredListings.length === 0 && (
                <div className="col-span-full text-center py-20 text-gray-400 dark:text-gray-500">
                  No activities found matching your criteria.
                </div>
              )}
            </div>
          ) : (
            <div className="h-[700px] rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 relative">
              <ListingMap listings={filteredListings} onSelect={() => {}} />
            </div>
          )}
        </>
      )}

      <AIAssistant listings={listings} />
    </div>
  );
};
