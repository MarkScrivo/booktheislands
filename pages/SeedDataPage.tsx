import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Loader2, Check, X, Database } from 'lucide-react';

export const SeedDataPage = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const seedListings = useMutation(api.seedData.seedListings);
  const getSeedStatus = useMutation(api.seedData.getSeedStatus);
  const clearListings = useMutation(api.seedData.clearListings);
  const fixOrphanedUsers = useMutation(api.fixOrphanedUsers.fixOrphanedUsers);

  const handleSeed = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const result = await seedListings();
      setStatus(result.success ? 'success' : 'error');
      setMessage(result.message);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to seed data');
    }
  };

  const handleCheckStatus = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const stats = await getSeedStatus();
      setStatus('success');
      setMessage(
        `Database Status:\n` +
        `- Listings: ${stats.listings}\n` +
        `- Bookings: ${stats.bookings}\n` +
        `- Reviews: ${stats.reviews}\n` +
        `- Messages: ${stats.messages}\n` +
        `- Profiles: ${stats.profiles}\n` +
        `- Is Seeded: ${stats.isSeeded ? 'Yes' : 'No'}`
      );
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to get status');
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to delete all listings? This cannot be undone.')) {
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const result = await clearListings();
      setStatus('success');
      setMessage(result.message);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to clear data');
    }
  };

  const handleFixOrphanedUsers = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const result = await fixOrphanedUsers();
      setStatus('success');
      setMessage(`Fixed ${result.fixed} orphaned users out of ${result.total} total users`);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to fix orphaned users');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-8 h-8 text-teal-600" />
            <h1 className="text-3xl font-bold text-gray-900">Convex Data Seeding</h1>
          </div>

          <p className="text-gray-600 mb-8">
            This page helps you populate your Convex database with sample data for testing.
          </p>

          <div className="space-y-4">
            {/* Seed Button */}
            <button
              onClick={handleSeed}
              disabled={status === 'loading'}
              className="w-full bg-teal-600 text-white py-3 px-6 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  Seed Sample Listings
                </>
              )}
            </button>

            {/* Check Status Button */}
            <button
              onClick={handleCheckStatus}
              disabled={status === 'loading'}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  Check Database Status
                </>
              )}
            </button>

            {/* Fix Orphaned Users Button */}
            <button
              onClick={handleFixOrphanedUsers}
              disabled={status === 'loading'}
              className="w-full bg-yellow-600 text-white py-3 px-6 rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Fix Orphaned Users
                </>
              )}
            </button>

            {/* Clear Button */}
            <button
              onClick={handleClear}
              disabled={status === 'loading'}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <X className="w-5 h-5" />
                  Clear All Listings
                </>
              )}
            </button>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
                status === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : status === 'error'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              {status === 'success' && <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
              {status === 'error' && <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
              <div
                className={`flex-1 whitespace-pre-wrap ${
                  status === 'success'
                    ? 'text-green-800'
                    : status === 'error'
                    ? 'text-red-800'
                    : 'text-blue-800'
                }`}
              >
                {message}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              <li>Click "Check Database Status" to see current data</li>
              <li>Click "Seed Sample Listings" to add 5 sample listings</li>
              <li>The seed will skip if listings already exist</li>
              <li>Use "Clear All Listings" to remove all listings (careful!)</li>
            </ol>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
            <p className="text-sm text-teal-800">
              <strong>Note:</strong> This page uses Convex mutations to populate your database.
              Once seeded, go to the <a href="/#/" className="underline">Explore page</a> to see the listings!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
