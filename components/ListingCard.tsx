
import React from 'react';
import { Listing } from '../types';
import { Star, MapPin, Clock, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ListingCardProps {
  listing: Listing;
  onBook: (listing: Listing) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, onBook }) => {
  return (
    <div className="group relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-gray-700">
      {/* Image Section */}
      <Link to={`/listing/${listing.id}`} className="relative aspect-[4/3] overflow-hidden block">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-3 left-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-gray-900 dark:text-white shadow-sm tracking-wide uppercase">
          {listing.category}
        </div>

        <button className="absolute top-3 right-3 p-2 rounded-full bg-black/20 text-white hover:bg-white dark:hover:bg-gray-800 hover:text-red-500 transition-colors backdrop-blur-sm">
            <Heart className="w-4 h-4" />
        </button>
      </Link>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
            <Link to={`/listing/${listing.id}`}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
                    {listing.title}
                </h3>
            </Link>
             <div className="flex items-center gap-1 text-sm font-bold text-gray-900 dark:text-white">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{listing.rating}</span>
            </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            {listing.location}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            {listing.duration}
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4 flex-grow leading-relaxed">
          {listing.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Starting from</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900 dark:text-white">${listing.price}</span>
            </div>
          </div>
          <button
            onClick={(e) => {
               e.stopPropagation();
               onBook(listing);
            }}
            className="px-6 py-2.5 bg-gray-900 dark:bg-teal-600 hover:bg-teal-600 dark:hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-sm active:scale-95"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
};
