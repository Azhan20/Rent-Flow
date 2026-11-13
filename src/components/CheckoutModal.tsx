import React, { useState } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  Building2, 
  Receipt,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { useAuth } from '../context/AuthContext';
import { SubscriptionTier } from '../types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  onSubscriptionSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  planName,
  billingCycle,
  onSubscriptionSuccess,
}) => {
  const { currentOrg, switchOrganization } = useRentFlow();
  const { user } = useAuth();

  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvc, setCvc] = useState('888');
  const [billingZip, setBillingZip] = useState('78744');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Pricing Matrix
  const planDetails: Record<string, { tier: SubscriptionTier; priceMonthly: number; priceYearly: number; maxUnits: number; features: string[] }> = {
    Starter: {
      tier: 'STARTER',
      priceMonthly: 79,
      priceYearly: 63,
      maxUnits: 25,
      features: [
        'Up to 25 Equipment Units',
        'Single Depot / Yard Location',
        'Standard Check-out & Return Inspections',
        'Electronic Invoicing & Deposit Escrow',
      ],
    },
    Growth: {
      tier: 'GROWTH',
      priceMonthly: 189,
      priceYearly: 149,
      maxUnits: 100,
      features: [
        'Up to 100 Equipment Units',
        'Up to 5 Regional Depots & Yard Hubs',
        'Gemini AI Operations Dispatcher',
        'Google Maps Fleet GPS Telematics',
        'Predictive Maintenance Wear Triggers',
        'White-Label Customer Storefront',
      ],
    },
    Enterprise: {
      tier: 'ENTERPRISE',
      priceMonthly: 399,
      priceYearly: 319,
      maxUnits: 1000,
      features: [
        'Unlimited Equipment Fleet',
        'Unlimited Depots & Yards',
        'Dedicated Cloud SQL Database Instance',
        'Full REST API & Custom ERP Webhooks',
        'Custom Safety & Pre-Start Form Builder',
        'Dedicated Account Manager & 24/7 Phone SLA',
      ],
    },
    Free: {
      tier: 'STARTER',
      priceMonthly: 0,
      priceYearly: 0,
      maxUnits: 5,
      features: [
        'Up to 5 Equipment Units',
        'Single Yard Location',
        'Basic Booking Schedule',
      ],
    },
  };

  const selectedConfig = planDetails[planName] || planDetails.Growth;
  const unitPrice = billingCycle === 'yearly' ? selectedConfig.priceYearly : selectedConfig.priceMonthly;
  const totalPrice = billingCycle === 'yearly' ? unitPrice * 12 : unitPrice;
  const isFree = unitPrice === 0;

  const handleConfirmSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);

    try {
      // Secure processing simulation
      await new Promise((resolve) => setTimeout(resolve, 1400));

      // Update current organization plan tier
      currentOrg.planTier = selectedConfig.tier;
      setConfirmed(true);

      setTimeout(() => {
        setIsProcessing(false);
        onSubscriptionSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setIsProcessing(false);
      setError(err?.message || 'Payment processing failed. Please check your billing details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          aria-label="Close checkout modal"
        >
          ✕
        </button>

        {!confirmed ? (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Confirm Subscription: {planName} Plan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Subscribing organization: <strong>{currentOrg.name}</strong> ({user?.email})
                </p>
              </div>
            </div>

            {/* Plan Breakdown Card */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-4 mb-5 text-xs">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{planName} Tier</span>
                <div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">${unitPrice}</span>
                  <span className="text-slate-500 text-[11px]">/month billed {billingCycle}</span>
                </div>
              </div>

              {billingCycle === 'yearly' && !isFree && (
                <div className="text-[11px] font-semibold text-emerald-600 mb-3">
                  ✓ Billed annually as ${totalPrice}/year (Includes 20% discount)
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-blue-200/60 dark:border-blue-900/60 text-slate-700 dark:text-slate-300">
                {selectedConfig.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Payment Details Form */}
            {!isFree ? (
              <form onSubmit={handleConfirmSubscription} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Card Number *
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Expiration (MM/YY) *
                    </label>
                    <input
                      type="text"
                      required
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CVC / CVV *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    256-Bit SSL Encrypted & PCI DSS Level 1 Certified
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Auto-Renews</span>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all text-sm mt-3"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Authorizing Subscription...</span>
                    </>
                  ) : (
                    <>
                      <span>Authorize ${totalPrice} & Activate {planName}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Activating the Free Starter plan will update your organization's limits. No credit card is required.
                </p>
                <button
                  type="button"
                  onClick={handleConfirmSubscription}
                  disabled={isProcessing}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Activate Free Plan</span>}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Confirmation Success State */
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Subscription Successfully Activated!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {currentOrg.name} has been upgraded to the <strong>{planName}</strong> plan. Your fleet limits and AI capabilities are now active.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
