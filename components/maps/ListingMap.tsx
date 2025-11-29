import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as L from 'leaflet';
import { Star, MapPin, ExternalLink } from 'lucide-react';
import { Listing } from '../../types';

// Custom Icon for Map Pins
const createCustomIcon = (isActive: boolean = false) => {
  const bgColor = isActive ? 'bg-orange-500' : 'bg-teal-600';
  const scale = isActive ? 'scale-125' : 'scale-100';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="w-10 h-10 ${bgColor} rounded-full border-3 border-white shadow-xl flex items-center justify-center text-white transform ${scale} transition-all duration-200"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

interface ListingMapProps {
  listings: Listing[];
  onSelect: (listing: Listing) => void;
}

export const ListingMap: React.FC<ListingMapProps> = ({ listings, onSelect }) => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [hoveredListing, setHoveredListing] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  // Update navigate ref when it changes
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Navigate to listing details
  const handleViewDetails = (listing: Listing) => {
    navigate(`/listing/${listing.id}`);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Init Map if not exists
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([9.73, 100.01], 11); // Center on Koh Phangan

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapInstanceRef.current);

      // Fix map sizing issues after initialization
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current.clear();

    // Add Markers
    listings.forEach(l => {
      if (l.latitude && l.longitude) {
        const isActive = hoveredListing === l.id || selectedListing?.id === l.id;
        const marker = L.marker([l.latitude, l.longitude], { icon: createCustomIcon(isActive) })
          .addTo(map);

        // Enhanced popup with better styling
        const popupContent = `
          <div class="map-popup-content p-2 min-w-[220px]" style="font-family: system-ui, -apple-system, sans-serif;">
            <img src="${l.imageUrl}" class="w-full h-32 object-cover rounded-lg mb-3 shadow-md" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'" />
            <h3 class="font-bold text-base text-gray-900 mb-2 line-clamp-2">${l.title}</h3>
            <div class="flex items-center gap-1 text-xs text-gray-600 mb-2">
              <svg class="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>${l.location}</span>
            </div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-1">
                <svg class="w-4 h-4 text-yellow-500 fill-yellow-500" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                <span class="text-sm font-semibold text-gray-900">${l.rating}</span>
                <span class="text-xs text-gray-500">(${l.reviewCount})</span>
              </div>
              <div class="text-xl font-bold text-teal-600">$${l.price}</div>
            </div>
            <button
              onclick="window.viewListingDetails('${l.id}')"
              class="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-md"
            >
              View Details
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 250,
          className: 'custom-popup',
          closeButton: true,
          autoPan: true,
          keepInView: true
        });

        marker.on('click', () => {
          setSelectedListing(l);
          onSelect(l);
          marker.openPopup(); // Ensure popup stays open on click
        });

        marker.on('mouseover', () => {
          setHoveredListing(l.id);
        });

        marker.on('mouseout', (e) => {
          // Don't close hover state if popup is open
          if (!marker.isPopupOpen()) {
            setHoveredListing(null);
          }
        });

        // Keep hover state when popup is open
        marker.on('popupopen', () => {
          setHoveredListing(l.id);
        });

        marker.on('popupclose', () => {
          setHoveredListing(null);
        });

        markersRef.current.set(l.id, marker);
      }
    });

    // Global function for popup button clicks - use navigateRef to access current navigate
    (window as any).viewListingDetails = (listingId: string) => {
      console.log('viewListingDetails called with:', listingId);
      navigateRef.current(`/listing/${listingId}`);
    };

    return () => {
      delete (window as any).viewListingDetails;
    };
  }, [listings, hoveredListing, selectedListing]);

  // Update marker icons when hover state changes
  useEffect(() => {
    markersRef.current.forEach((marker, listingId) => {
      const isActive = hoveredListing === listingId || selectedListing?.id === listingId;
      marker.setIcon(createCustomIcon(isActive));
    });
  }, [hoveredListing, selectedListing]);

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Sidebar with Listing Cards */}
      <div className="absolute top-4 left-4 bottom-4 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            {listings.length} Listings Found
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Click marker or card to view details</p>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {listings.map(listing => (
            <div
              key={listing.id}
              onMouseEnter={() => {
                setHoveredListing(listing.id);
                const marker = markersRef.current.get(listing.id);
                if (marker) {
                  marker.openPopup();
                }
              }}
              onMouseLeave={() => {
                setHoveredListing(null);
              }}
              onClick={() => handleViewDetails(listing)}
              className={`bg-white dark:bg-gray-700 rounded-xl p-3 cursor-pointer transition-all duration-200 border-2 ${
                hoveredListing === listing.id || selectedListing?.id === listing.id
                  ? 'border-teal-500 shadow-lg transform scale-105'
                  : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 hover:shadow-md'
              }`}
            >
              <div className="flex gap-3">
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/80x80?text=No+Image';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">
                    {listing.title}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{listing.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{listing.rating}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({listing.reviewCount})</span>
                    </div>
                    <div className="text-sm font-bold text-teal-600 dark:text-teal-400">
                      ${listing.price}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-600 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{listing.category}</span>
                <ExternalLink className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          ))}

          {listings.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-500">
              <MapPin className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No listings found</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Styles for Map Popups and Scrollbar */}
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
        }
        .custom-popup .leaflet-popup-tip {
          display: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};
