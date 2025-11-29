/**
 * Email Notifications
 *
 * Functions for sending email notifications to users via Resend.
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

// ============================================
// EMAIL CONFIGURATION
// ============================================

const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const resend = new Resend(process.env.EMAIL_API_KEY);

// ============================================
// SEND EMAIL (helper function)
// ============================================

async function sendEmailHelper(args: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}) {
  console.log(`[Email] Sending to ${args.to}: ${args.subject}`);

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      html: args.htmlBody,
      text: args.textBody,
    });

    if (error) {
      console.error(`[Email] Error sending email:`, error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log(`[Email] Successfully sent email to ${args.to}. ID: ${data?.id}`);
    return { success: true, emailId: data?.id };
  } catch (error) {
    console.error(`[Email] Exception sending email:`, error);
    throw error;
  }
}

// ============================================
// WAITLIST SPOT AVAILABLE EMAIL
// ============================================

export const sendWaitlistSpotAvailable = internalAction({
  args: {
    to: v.string(),
    customerName: v.string(),
    listingTitle: v.string(),
    listingId: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const expiresDate = new Date(args.expiresAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const bookingUrl = `${FRONTEND_URL}/listings/${args.listingId}`;

    const subject = `Spot Available: ${args.listingTitle}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #0d9488; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌴 Great News!</h1>
      <p>A Spot Opened Up on Your Waitlist</p>
    </div>
    <div class="content">
      <p>Hi ${args.customerName},</p>

      <p>Good news! A spot has become available for <strong>${args.listingTitle}</strong> that you were waiting for.</p>

      <div class="details">
        <h3>📅 Booking Details</h3>
        <p><strong>Activity:</strong> ${args.listingTitle}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${args.slotTime}</p>
      </div>

      <div class="warning">
        <p><strong>⏰ Act Fast!</strong></p>
        <p>This opportunity expires on <strong>${expiresDate}</strong>. Book now before someone else takes the spot!</p>
      </div>

      <center>
        <a href="${bookingUrl}" class="button">Book Now</a>
      </center>

      <p>If the button doesn't work, copy this link: <a href="${bookingUrl}">${bookingUrl}</a></p>
    </div>
    <div class="footer">
      <p>You received this email because you joined the waitlist for this activity.</p>
      <p>Book The Islands - Your Island Adventure Marketplace</p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Hi ${args.customerName},

Great news! A spot has become available for ${args.listingTitle}.

Booking Details:
- Activity: ${args.listingTitle}
- Date: ${formattedDate}
- Time: ${args.slotTime}

⏰ Act Fast!
This opportunity expires on ${expiresDate}. Book now before someone else takes the spot!

Book here: ${bookingUrl}

You received this email because you joined the waitlist for this activity.

Book The Islands - Your Island Adventure Marketplace
    `;

    return await sendEmailHelper({
      to: args.to,
      subject,
      htmlBody,
      textBody,
    });
  },
});

// ============================================
// BOOKING CANCELLED EMAIL
// ============================================

export const sendBookingCancelled = internalAction({
  args: {
    to: v.string(),
    customerName: v.string(),
    listingTitle: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    reason: v.string(),
    vendorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    let reasonText = '';
    switch (args.reason) {
      case 'weather':
        reasonText = 'weather conditions';
        break;
      case 'emergency':
        reasonText = 'an emergency';
        break;
      case 'personal':
        reasonText = 'personal reasons';
        break;
      default:
        reasonText = 'unforeseen circumstances';
    }

    const subject = `Booking Cancelled: ${args.listingTitle}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
    .vendor-message { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; font-style: italic; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi ${args.customerName},</p>

      <p>We're sorry to inform you that your booking has been cancelled by the vendor due to ${reasonText}.</p>

      <div class="details">
        <h3>📅 Cancelled Booking</h3>
        <p><strong>Activity:</strong> ${args.listingTitle}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${args.slotTime}</p>
      </div>

      ${
        args.vendorMessage
          ? `<div class="vendor-message">
              <p><strong>Message from vendor:</strong></p>
              <p>${args.vendorMessage}</p>
            </div>`
          : ''
      }

      <div class="info-box">
        <p><strong>💰 Full Refund Issued</strong></p>
        <p>Your payment has been automatically refunded. You should see it in your account within 5-10 business days depending on your payment method.</p>
      </div>

      <p>We apologize for any inconvenience. Feel free to explore other amazing activities on Koh Phangan!</p>

      <center>
        <a href="${FRONTEND_URL}/explore" style="display: inline-block; background: #0d9488; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Browse Activities</a>
      </center>
    </div>
    <div class="footer">
      <p>Book The Islands - Your Island Adventure Marketplace</p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Hi ${args.customerName},

We're sorry to inform you that your booking has been cancelled by the vendor due to ${reasonText}.

Cancelled Booking:
- Activity: ${args.listingTitle}
- Date: ${formattedDate}
- Time: ${args.slotTime}

${args.vendorMessage ? `Message from vendor:\n${args.vendorMessage}\n\n` : ''}

💰 Full Refund Issued
Your payment has been automatically refunded. You should see it in your account within 5-10 business days.

We apologize for any inconvenience. Browse more activities: ${FRONTEND_URL}/explore

Book The Islands - Your Island Adventure Marketplace
    `;

    return await sendEmailHelper({
      to: args.to,
      subject,
      htmlBody,
      textBody,
    });
  },
});

// ============================================
// BOOKING CONFIRMED EMAIL
// ============================================

export const sendBookingConfirmed = internalAction({
  args: {
    to: v.string(),
    customerName: v.string(),
    listingTitle: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    guests: v.number(),
    totalPrice: v.number(),
    bookingId: v.string(),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const bookingUrl = `${FRONTEND_URL}/bookings/${args.bookingId}`;

    const subject = `Booking Confirmed: ${args.listingTitle}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #0d9488; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Booking Confirmed!</h1>
      <p>Get Ready for Your Adventure</p>
    </div>
    <div class="content">
      <p>Hi ${args.customerName},</p>

      <p>Your booking is confirmed! We're excited for you to experience <strong>${args.listingTitle}</strong>.</p>

      <div class="details">
        <h3>📅 Your Booking</h3>
        <p><strong>Activity:</strong> ${args.listingTitle}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${args.slotTime}</p>
        <p><strong>Guests:</strong> ${args.guests}</p>
        <p><strong>Total:</strong> ฿${args.totalPrice.toLocaleString()}</p>
      </div>

      <center>
        <a href="${bookingUrl}" class="button">View Booking Details</a>
      </center>

      <p><strong>What's Next?</strong></p>
      <ul>
        <li>We'll send you a reminder 24 hours before your activity</li>
        <li>Check your booking details for meeting point and instructions</li>
        <li>Contact the vendor if you have any questions</li>
      </ul>
    </div>
    <div class="footer">
      <p>Book The Islands - Your Island Adventure Marketplace</p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Hi ${args.customerName},

Your booking is confirmed! Get ready for ${args.listingTitle}.

Your Booking:
- Activity: ${args.listingTitle}
- Date: ${formattedDate}
- Time: ${args.slotTime}
- Guests: ${args.guests}
- Total: ฿${args.totalPrice.toLocaleString()}

View details: ${bookingUrl}

What's Next?
- We'll send you a reminder 24 hours before
- Check booking details for meeting point
- Contact the vendor with any questions

Book The Islands - Your Island Adventure Marketplace
    `;

    return await sendEmailHelper({
      to: args.to,
      subject,
      htmlBody,
      textBody,
    });
  },
});

// ============================================
// NEW SALE EMAIL (for vendors)
// ============================================

export const sendNewSale = internalAction({
  args: {
    to: v.string(),
    vendorName: v.string(),
    customerName: v.string(),
    listingTitle: v.string(),
    slotDate: v.string(),
    slotTime: v.string(),
    guests: v.number(),
    totalPrice: v.number(),
    vendorEarnings: v.number(),
    platformFee: v.number(),
    bookingId: v.string(),
  },
  handler: async (ctx, args) => {
    const formattedDate = new Date(args.slotDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const bookingUrl = `${FRONTEND_URL}/#/vendor/bookings`;

    const subject = `🎉 New Booking: ${args.listingTitle}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .earnings { background: #d1fae5; border-left: 4px solid #059669; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .earnings-amount { font-size: 32px; font-weight: bold; color: #059669; margin: 10px 0; }
    .button { display: inline-block; background: #0d9488; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .breakdown { font-size: 14px; color: #6b7280; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations!</h1>
      <p>You Have a New Booking</p>
    </div>
    <div class="content">
      <p>Hi ${args.vendorName},</p>

      <p>Great news! You just received a new booking for <strong>${args.listingTitle}</strong>.</p>

      <div class="earnings">
        <p style="margin: 0; font-size: 14px; color: #065f46; font-weight: 600;">Your Earnings</p>
        <div class="earnings-amount">฿${args.vendorEarnings.toLocaleString()}</div>
        <div class="breakdown">
          Total: ฿${args.totalPrice.toLocaleString()} | Platform Fee: ฿${args.platformFee.toLocaleString()}
        </div>
      </div>

      <div class="details">
        <h3>📅 Booking Details</h3>
        <p><strong>Customer:</strong> ${args.customerName}</p>
        <p><strong>Activity:</strong> ${args.listingTitle}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${args.slotTime}</p>
        <p><strong>Guests:</strong> ${args.guests}</p>
      </div>

      <center>
        <a href="${bookingUrl}" class="button">View Booking</a>
      </center>

      <p><strong>What's Next?</strong></p>
      <ul>
        <li>The customer has been notified and will receive a reminder 24 hours before</li>
        <li>Make sure you're prepared for the activity</li>
        <li>Payouts are processed after the activity is completed</li>
      </ul>

      <p>Keep up the great work! 🌴</p>
    </div>
    <div class="footer">
      <p>Book The Islands - Vendor Dashboard</p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Hi ${args.vendorName},

Great news! You just received a new booking.

Your Earnings: ฿${args.vendorEarnings.toLocaleString()}
(Total: ฿${args.totalPrice.toLocaleString()} | Platform Fee: ฿${args.platformFee.toLocaleString()})

Booking Details:
- Customer: ${args.customerName}
- Activity: ${args.listingTitle}
- Date: ${formattedDate}
- Time: ${args.slotTime}
- Guests: ${args.guests}

View booking: ${bookingUrl}

What's Next?
- Customer will receive a reminder 24 hours before
- Make sure you're prepared for the activity
- Payouts are processed after completion

Keep up the great work! 🌴

Book The Islands - Vendor Dashboard
    `;

    return await sendEmailHelper({
      to: args.to,
      subject,
      htmlBody,
      textBody,
    });
  },
});
