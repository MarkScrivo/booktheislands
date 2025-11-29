/**
 * Vendor Onboarding Component
 *
 * Handles Stripe Connect Express account onboarding for vendors
 * Shows current status and provides button to start/continue onboarding
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, CreditCard, Building, RefreshCw, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface VendorOnboardingProps {
  onComplete?: () => void;
}

export const VendorOnboarding: React.FC<VendorOnboardingProps> = ({ onComplete }) => {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isLoadingLink, setIsLoadingLink] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get account status
  const accountStatus = useQuery(api.stripe.connect.getAccountStatus);

  // Actions
  const createAccountAction = useAction(api.stripe.connect.createConnectAccount);
  const createLinkAction = useAction(api.stripe.connect.createAccountLink);
  const checkCapabilitiesAction = useAction(api.stripe.connect.checkAccountCapabilities);
  const resetAccountMutation = useMutation(api.stripe.connect.resetStripeAccount);

  // Check detailed capabilities when we have an account
  const [capabilities, setCapabilities] = useState<{
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchCapabilities = async () => {
      if (accountStatus?.accountId && !accountStatus.onboardingComplete) {
        try {
          const caps = await checkCapabilitiesAction({ accountId: accountStatus.accountId });
          setCapabilities(caps);

          // Show success message if onboarding just completed
          if (caps.chargesEnabled && caps.payoutsEnabled) {
            toast.success('🎉 Payment setup complete! Your account is ready to receive payments.');
          }
        } catch (error) {
          console.error('Failed to check capabilities:', error);
        }
      }
    };

    if (accountStatus?.hasAccount && !accountStatus.onboardingComplete) {
      // Check immediately when component loads (user may have just returned from Stripe)
      fetchCapabilities();
      // Poll every 10 seconds if onboarding not complete
      const interval = setInterval(fetchCapabilities, 10000);
      return () => clearInterval(interval);
    }
  }, [accountStatus, checkCapabilitiesAction]);

  // Trigger callback when onboarding completes
  useEffect(() => {
    if (accountStatus?.onboardingComplete && onComplete) {
      onComplete();
    }
  }, [accountStatus?.onboardingComplete, onComplete]);

  const handleStartOnboarding = async () => {
    setIsCreatingAccount(true);

    try {
      // Create Connect account if doesn't exist
      let accountId = accountStatus?.accountId;

      if (!accountStatus?.hasAccount) {
        const result = await createAccountAction({});
        accountId = result.accountId;
        toast.success('Stripe account created!');
      }

      if (!accountId) {
        throw new Error('Failed to get account ID');
      }

      // Generate onboarding link
      setIsLoadingLink(true);
      const linkResult = await createLinkAction({ accountId });

      // Open Stripe onboarding in new window
      window.open(linkResult.url, '_blank', 'width=800,height=900');

      toast.success('Onboarding link opened! Complete the form in the new window.');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Failed to start onboarding');
    } finally {
      setIsCreatingAccount(false);
      setIsLoadingLink(false);
    }
  };

  const handleContinueOnboarding = async () => {
    if (!accountStatus?.accountId) return;

    setIsLoadingLink(true);

    try {
      const linkResult = await createLinkAction({ accountId: accountStatus.accountId });
      window.open(linkResult.url, '_blank', 'width=800,height=900');
      toast.success('Onboarding link opened!');
    } catch (error: any) {
      console.error('Link error:', error);
      toast.error(error.message || 'Failed to generate link');
    } finally {
      setIsLoadingLink(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!accountStatus?.accountId) return;

    setIsRefreshing(true);

    try {
      const caps = await checkCapabilitiesAction({ accountId: accountStatus.accountId });
      setCapabilities(caps);

      if (caps.chargesEnabled && caps.payoutsEnabled) {
        toast.success('Setup complete! Your account is ready to receive payments.');
      } else {
        toast.success('Status updated');
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast.error(error.message || 'Failed to refresh status');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetAccount = async () => {
    if (!confirm('This will delete your current Stripe account connection and allow you to create a new one. Continue?')) {
      return;
    }

    try {
      await resetAccountMutation({});
      toast.success('Account reset! You can now create a new Stripe account.');
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error(error.message || 'Failed to reset account');
    }
  };

  // Loading state
  if (accountStatus === undefined) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  // Onboarding complete
  if (accountStatus.onboardingComplete) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-1">
              Payment Setup Complete!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
              Your Stripe account is fully set up and ready to receive payments. You can now accept bookings!
            </p>
            {accountStatus.commissionRate !== undefined && (
              <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">Platform Commission</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {accountStatus.commissionRate}%
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  You keep {100 - accountStatus.commissionRate}% of each booking
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Has account but onboarding incomplete
  if (accountStatus.hasAccount) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100 mb-1">
              Complete Your Payment Setup
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
              You've started the onboarding process but haven't finished yet. Complete your Stripe setup to start receiving payments.
            </p>

            {capabilities && (
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {capabilities.detailsSubmitted ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-yellow-400 dark:border-yellow-500 rounded-full" />
                  )}
                  <span className="text-yellow-800 dark:text-yellow-200">
                    Account details {capabilities.detailsSubmitted ? 'submitted' : 'pending'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {capabilities.chargesEnabled ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-yellow-400 dark:border-yellow-500 rounded-full" />
                  )}
                  <span className="text-yellow-800 dark:text-yellow-200">
                    Charges {capabilities.chargesEnabled ? 'enabled' : 'pending approval'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {capabilities.payoutsEnabled ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-yellow-400 dark:border-yellow-500 rounded-full" />
                  )}
                  <span className="text-yellow-800 dark:text-yellow-200">
                    Payouts {capabilities.payoutsEnabled ? 'enabled' : 'pending approval'}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleContinueOnboarding}
                  disabled={isLoadingLink}
                  className="flex-1 px-4 py-2.5 bg-yellow-600 dark:bg-yellow-500 hover:bg-yellow-700 dark:hover:bg-yellow-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoadingLink ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Link...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-5 h-5" />
                      Continue Setup
                    </>
                  )}
                </button>

                <button
                  onClick={handleRefreshStatus}
                  disabled={isRefreshing}
                  className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  title="Refresh status"
                >
                  {isRefreshing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                </button>
              </div>

              <button
                onClick={handleResetAccount}
                className="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Stripe Account (Start Over)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No account yet - show start onboarding
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-6 h-6 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Set Up Payments
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Connect your bank account with Stripe to start receiving payments from bookings. This is a quick and secure process handled by Stripe.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Building className="w-4 h-4" />
              What you'll need:
            </h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-teal-600 dark:bg-teal-400" />
                Thai National ID or Passport
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-teal-600 dark:bg-teal-400" />
                Bank account details (Thai bank)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-teal-600 dark:bg-teal-400" />
                Business information (if applicable)
              </li>
            </ul>
          </div>

          <button
            onClick={handleStartOnboarding}
            disabled={isCreatingAccount || isLoadingLink}
            className="w-full px-4 py-2.5 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreatingAccount || isLoadingLink ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isCreatingAccount ? 'Creating Account...' : 'Generating Link...'}
              </>
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                Start Setup with Stripe
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
            Your data is secure and handled by Stripe, a trusted payment processor
          </p>
        </div>
      </div>
    </div>
  );
};
