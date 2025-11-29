/**
 * Stripe Account Details Component
 *
 * Displays comprehensive Stripe Connect account information for vendors
 * Shows balance, payouts, capabilities, requirements, and account settings
 */

import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  CreditCard,
  Building,
  User,
  Settings,
  ExternalLink,
  RefreshCw,
  Clock,
  TrendingUp,
  Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AccountDetails {
  account: {
    id: string;
    email: string | null;
    country: string;
    defaultCurrency: string;
    type: string;
    businessType: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    created: number;
    capabilities: {
      cardPayments: string;
      transfers: string;
    };
    payoutSchedule: {
      interval: string;
      weekly_anchor?: string;
      monthly_anchor?: number;
      delay_days?: number;
    } | null;
    requirements: {
      currentlyDue: string[];
      eventuallyDue: string[];
      pastDue: string[];
      pendingVerification: string[];
      disabled: string | null;
    };
    individual: {
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      verified: boolean;
    } | null;
  };
  balance: {
    available: { amount: number; currency: string }[];
    pending: { amount: number; currency: string }[];
  };
  recentPayouts: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    arrivalDate: number;
    created: number;
    description: string | null;
    method: string;
    type: string;
  }>;
}

export const StripeAccountDetails: React.FC = () => {
  const [accountInfo, setAccountInfo] = useState<AccountDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDetailsAction = useAction(api.stripe.connect.getDetailedAccountInfo);
  const createDashboardLinkAction = useAction(api.stripe.connect.createDashboardLink);

  const loadAccountDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const details = await getDetailsAction({});
      setAccountInfo(details as AccountDetails);
    } catch (err: any) {
      console.error('Failed to load account details:', err);
      setError(err.message || 'Failed to load account details');
      toast.error('Failed to load account details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const result = await createDashboardLinkAction({});
      window.open(result.url, '_blank');
      toast.success('Opening Stripe Dashboard...');
    } catch (err: any) {
      console.error('Failed to open dashboard:', err);
      toast.error(err.message || 'Failed to open dashboard');
    }
  };

  // Format currency amounts
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Format dates
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get capability status badge
  const getCapabilityBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">Active</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">Pending</span>;
      case 'inactive':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">Inactive</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">{status}</span>;
    }
  };

  // Get payout status badge
  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">Paid</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">Pending</span>;
      case 'in_transit':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">In Transit</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">{status}</span>;
    }
  };

  if (error && !accountInfo) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <XCircle className="w-12 h-12 text-red-600 dark:text-red-400 mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={loadAccountDetails}
            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!accountInfo) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <Building className="w-12 h-12 text-teal-600 dark:text-teal-400 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            View Account Details
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
            Load detailed information about your Stripe Connect account
          </p>
          <button
            onClick={loadAccountDetails}
            disabled={loading}
            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                Load Account Details
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const { account, balance, recentPayouts } = accountInfo;

  return (
    <div className="space-y-6">
      {/* Header with refresh and dashboard buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Stripe Account Details
        </h2>
        <div className="flex gap-2">
          <button
            onClick={loadAccountDetails}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenDashboard}
            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Stripe Dashboard
          </button>
        </div>
      </div>

      {/* Account Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            {account.chargesEnabled ? (
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            )}
            <h3 className="font-bold text-gray-900 dark:text-white">Charges</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {account.chargesEnabled ? 'Enabled - Can accept payments' : 'Disabled - Cannot accept payments'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            {account.payoutsEnabled ? (
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            )}
            <h3 className="font-bold text-gray-900 dark:text-white">Payouts</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {account.payoutsEnabled ? 'Enabled - Can receive payouts' : 'Disabled - Cannot receive payouts'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            {account.detailsSubmitted ? (
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            )}
            <h3 className="font-bold text-gray-900 dark:text-white">Details</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {account.detailsSubmitted ? 'All required details submitted' : 'Additional details required'}
          </p>
        </div>
      </div>

      {/* Balance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Account Balance</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Available</p>
            {balance.available.length > 0 ? (
              balance.available.map((bal, idx) => (
                <p key={idx} className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(bal.amount, bal.currency)}
                </p>
              ))
            ) : (
              <p className="text-2xl font-bold text-gray-400">$0.00</p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Pending</p>
            {balance.pending.length > 0 ? (
              balance.pending.map((bal, idx) => (
                <p key={idx} className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatCurrency(bal.amount, bal.currency)}
                </p>
              ))
            ) : (
              <p className="text-2xl font-bold text-gray-400">$0.00</p>
            )}
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Account Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Account ID</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">{account.id}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Email</p>
            <p className="text-sm text-gray-900 dark:text-white">{account.email || 'Not provided'}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Country</p>
            <p className="text-sm text-gray-900 dark:text-white">{account.country}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Currency</p>
            <p className="text-sm text-gray-900 dark:text-white uppercase">{account.defaultCurrency}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Account Type</p>
            <p className="text-sm text-gray-900 dark:text-white capitalize">{account.type}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Business Type</p>
            <p className="text-sm text-gray-900 dark:text-white capitalize">{account.businessType || 'Not set'}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Created</p>
            <p className="text-sm text-gray-900 dark:text-white">{formatDate(account.created)}</p>
          </div>
        </div>
      </div>

      {/* Individual/Owner Info */}
      {account.individual && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Owner Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Name</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {account.individual.firstName} {account.individual.lastName}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Email</p>
              <p className="text-sm text-gray-900 dark:text-white">{account.individual.email || 'Not provided'}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Verification Status</p>
              <div className="flex items-center gap-2">
                {account.individual.verified ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Pending</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capabilities */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Capabilities</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Card Payments</span>
            {getCapabilityBadge(account.capabilities.cardPayments)}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Transfers</span>
            {getCapabilityBadge(account.capabilities.transfers)}
          </div>
        </div>
      </div>

      {/* Payout Schedule */}
      {account.payoutSchedule && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payout Schedule</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Frequency</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                {account.payoutSchedule.interval}
              </span>
            </div>
            {account.payoutSchedule.weekly_anchor && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Payout Day</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {account.payoutSchedule.weekly_anchor}
                </span>
              </div>
            )}
            {account.payoutSchedule.delay_days !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Delay</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {account.payoutSchedule.delay_days} days
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Requirements */}
      {(account.requirements.currentlyDue.length > 0 ||
        account.requirements.pastDue.length > 0 ||
        account.requirements.pendingVerification.length > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100">Action Required</h3>
          </div>

          {account.requirements.pastDue.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Past Due:</p>
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
                {account.requirements.pastDue.map((req, idx) => (
                  <li key={idx}>{req.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
          )}

          {account.requirements.currentlyDue.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">Currently Due:</p>
              <ul className="list-disc list-inside text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
                {account.requirements.currentlyDue.map((req, idx) => (
                  <li key={idx}>{req.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
          )}

          {account.requirements.pendingVerification.length > 0 && (
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Pending Verification:</p>
              <ul className="list-disc list-inside text-sm text-blue-600 dark:text-blue-400 space-y-1">
                {account.requirements.pendingVerification.map((req, idx) => (
                  <li key={idx}>{req.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recent Payouts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Payouts</h3>
        </div>

        {recentPayouts.length > 0 ? (
          <div className="space-y-3">
            {recentPayouts.map((payout) => (
              <div
                key={payout.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(payout.amount, payout.currency)}
                    </p>
                    {getPayoutStatusBadge(payout.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Arrival: {formatDate(payout.arrivalDate)}
                    </span>
                    <span className="capitalize">{payout.method}</span>
                  </div>
                </div>
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{payout.id}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
            No payouts yet
          </p>
        )}
      </div>
    </div>
  );
};
