/**
 * Platform Setup Page
 *
 * One-time setup page to initialize platform settings
 * This should be run once after deploying to set the default commission rate
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, Settings, AlertCircle } from 'lucide-react';

export const SetupPage: React.FC = () => {
  const [commissionRate, setCommissionRate] = useState(10);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  // Check if already initialized
  const platformSettings = useQuery(api.stripe.connect.getPlatformSettings);
  const initializeMutation = useMutation(api.stripe.connect.initializePlatformSettings);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      await initializeMutation({ defaultCommissionRate: commissionRate });
      setSuccess(true);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  // If already initialized
  if (platformSettings && platformSettings.defaultCommissionRate !== undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Platform Already Configured
          </h1>

          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your platform is already set up with a default commission rate of{' '}
            <strong>{platformSettings.defaultCommissionRate}%</strong>
          </p>

          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Setup Complete!
          </h1>

          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Platform settings initialized successfully.
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting to homepage...
          </p>
        </div>
      </div>
    );
  }

  // Loading state while checking settings
  if (platformSettings === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // Setup form
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Settings className="w-8 h-8 text-teal-600 dark:text-teal-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          Platform Setup
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
          Initialize your marketplace platform settings
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-200 text-sm">Setup Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Default Commission Rate (%)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              This is the percentage the platform takes from each booking. You can customize this per vendor later.
            </p>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={commissionRate}
              onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
              disabled={isInitializing}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Example: 10% means platform earns $10 from a $100 booking
            </p>
          </div>

          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
            <h3 className="font-bold text-teal-900 dark:text-teal-200 text-sm mb-2">
              Commission Breakdown
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>Booking Amount:</span>
                <span className="font-bold">$100.00</span>
              </div>
              <div className="flex justify-between text-teal-700 dark:text-teal-300">
                <span>Platform Fee ({commissionRate}%):</span>
                <span className="font-bold">${(100 * (commissionRate / 100)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 pt-2 border-t border-teal-200 dark:border-teal-700">
                <span>Vendor Receives:</span>
                <span className="font-bold">${(100 * (1 - commissionRate / 100)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleInitialize}
            disabled={isInitializing || commissionRate < 0 || commissionRate > 100}
            className="w-full px-6 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isInitializing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Settings className="w-5 h-5" />
                Initialize Platform
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            This only needs to be done once. You can change commission rates per vendor later in the admin dashboard.
          </p>
        </div>
      </div>
    </div>
  );
};
