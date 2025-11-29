import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

// Add authentication routes
auth.addHttpRoutes(http);

/**
 * Stripe Webhook Endpoint
 * Receives and processes Stripe webhook events
 *
 * To set up in Stripe Dashboard:
 * 1. Go to Developers > Webhooks
 * 2. Add endpoint: https://your-domain.convex.site/stripe/webhook
 * 3. Select events to listen for
 * 4. Copy webhook signing secret to STRIPE_WEBHOOKS_SECRET env var
 */
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get the signature from headers
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No signature provided", { status: 400 });
    }

    // Get the raw body
    const body = await request.text();

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-11-20.acacia",
    });

    try {
      // Verify webhook signature and construct event
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOKS_SECRET!
      );

      console.log(`Received Stripe webhook: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        // ============================================
        // Payment Events
        // ============================================
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          await ctx.runMutation(internal.stripe.webhooks.handlePaymentSuccess, {
            paymentIntentId: paymentIntent.id,
            chargeId: paymentIntent.latest_charge as string,
            paymentMethod: paymentIntent.payment_method as string | undefined,
          });
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object;
          await ctx.runMutation(internal.stripe.webhooks.handlePaymentFailed, {
            paymentIntentId: paymentIntent.id,
            errorMessage: paymentIntent.last_payment_error?.message,
          });
          break;
        }

        // ============================================
        // Connect Account Events
        // ============================================
        case "account.updated": {
          const account = event.data.object;
          await ctx.runMutation(internal.stripe.webhooks.handleAccountUpdate, {
            accountId: account.id,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted || false,
          });
          break;
        }

        // ============================================
        // Refund Events
        // ============================================
        case "charge.refunded": {
          const charge = event.data.object;
          const refund = charge.refunds?.data[0];
          if (refund) {
            await ctx.runMutation(internal.stripe.webhooks.handleRefund, {
              paymentIntentId: charge.payment_intent as string,
              refundAmount: refund.amount,
            });
          }
          break;
        }

        // ============================================
        // Payout Events
        // ============================================
        case "payout.paid": {
          const payout = event.data.object;
          await ctx.runMutation(internal.stripe.webhooks.handlePayoutPaid, {
            payoutId: payout.id,
            amount: payout.amount,
            arrivalDate: payout.arrival_date,
            destination: payout.destination as string,
          });
          break;
        }

        case "payout.failed": {
          const payout = event.data.object;
          await ctx.runMutation(internal.stripe.webhooks.handlePayoutFailed, {
            payoutId: payout.id,
            failureCode: payout.failure_code || undefined,
            failureMessage: payout.failure_message || undefined,
          });
          break;
        }

        // ============================================
        // Transfer Events
        // ============================================
        case "transfer.created": {
          const transfer = event.data.object;
          await ctx.runMutation(internal.stripe.webhooks.handleTransferCreated, {
            transferId: transfer.id,
            amount: transfer.amount,
            destination: transfer.destination as string,
          });
          break;
        }

        // ============================================
        // Application Fee Events
        // ============================================
        case "application_fee.created": {
          const fee = event.data.object;
          await ctx.runMutation(
            internal.stripe.webhooks.handleApplicationFeeCreated,
            {
              feeId: fee.id,
              amount: fee.amount,
              chargeId: fee.charge as string,
            }
          );
          break;
        }

        case "application_fee.refunded": {
          const fee = event.data.object;
          const refund = fee.refunds?.data[0];
          if (refund) {
            await ctx.runMutation(
              internal.stripe.webhooks.handleApplicationFeeRefunded,
              {
                feeId: fee.id,
                amount: refund.amount,
              }
            );
          }
          break;
        }

        // ============================================
        // Dispute Events
        // ============================================
        case "charge.dispute.created": {
          const dispute = event.data.object;
          await ctx.runMutation(internal.stripe.webhooks.handleDisputeCreated, {
            disputeId: dispute.id,
            chargeId: dispute.charge as string,
            amount: dispute.amount,
            reason: dispute.reason,
          });
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Return success response
      return new Response(
        JSON.stringify({ received: true, eventType: event.type }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      console.error("Webhook error:", err.message);
      return new Response(`Webhook Error: ${err.message}`, {
        status: 400,
      });
    }
  }),
});

export default http;
