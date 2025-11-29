/**
 * Gemini AI Backend Action
 *
 * Securely calls the Gemini API from the server-side,
 * keeping the API key hidden from clients.
 *
 * Supports interactive component responses (time slots, booking confirmations, etc.)
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Helper function to intelligently filter relevant listings based on query
const getRelevantListings = (
  query: string,
  listings: Array<{
    id: string;
    title: string;
    location: string;
    category: string;
    price: number;
    duration: string;
    maxCapacity: number;
    operatingDays: string[];
    description: string;
  }>,
  maxResults: number = 6
) => {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(" ").filter((word) => word.length > 2);

  // Score each listing based on relevance
  const scored = listings.map((listing) => {
    let score = 0;
    const searchText =
      `${listing.title} ${listing.description} ${listing.category} ${listing.location}`.toLowerCase();

    // Exact category match
    if (queryLower.includes(listing.category.toLowerCase())) score += 10;

    // Keyword matches
    keywords.forEach((keyword) => {
      if (searchText.includes(keyword)) score += 3;
    });

    // Location match
    if (queryLower.includes(listing.location.toLowerCase())) score += 5;

    return { listing, score };
  });

  // Return top scoring listings, or all if query is too general
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.listing);
};

export const chat = action({
  args: {
    userQuery: v.string(),
    listings: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        location: v.string(),
        category: v.string(),
        price: v.number(),
        duration: v.string(),
        maxCapacity: v.number(),
        operatingDays: v.array(v.string()),
        description: v.string(),
      })
    ),
    conversationHistory: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("model")),
        text: v.string(),
      })
    ),
    availabilityData: v.any(), // Record<string, Record<string, { booked: number; capacity: number; available: number }>>
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("[Gemini] API key not configured");
      return "AI Assistant is currently unavailable. Please contact support.";
    }

    try {
      // Get relevant listings instead of all listings
      const relevantListings = getRelevantListings(args.userQuery, args.listings);

      // Build availability summary for relevant listings only
      const availabilitySummary: Record<string, string[]> = {};
      const availabilityData = args.availabilityData || {};

      relevantListings.forEach((listing) => {
        if (availabilityData[listing.id]) {
          const dates = Object.entries(availabilityData[listing.id])
            .filter(
              ([_, data]: [string, any]) => data && data.available > 0
            )
            .map(([date]) => date)
            .sort()
            .slice(0, 10); // Only include first 10 available dates to save tokens

          if (dates.length > 0) {
            availabilitySummary[listing.id] = dates;
          }
        }
      });

      const listingsContext = JSON.stringify(
        relevantListings.map((l) => ({
          id: l.id,
          title: l.title,
          location: l.location,
          category: l.category,
          price: l.price,
          duration: l.duration,
          maxCapacity: l.maxCapacity,
          operatingDays: l.operatingDays,
          description: l.description.substring(0, 100), // Trim descriptions to save tokens
          nextAvailableDates: availabilitySummary[l.id] || [], // Include available dates
        }))
      );

      const systemInstruction = `You are Nui, a friendly coconut character and local guide from Koh Phangan who knows all the best spots on the island. You're chatting with a tourist who needs recommendations.

AVAILABLE ACTIVITIES (${relevantListings.length} options):
${listingsContext}

YOUR PERSONALITY:
- Casual and conversational, like texting a friend
- Use emojis occasionally (not every message)
- Keep responses SHORT (2-3 sentences max)
- Be direct and helpful, not overly descriptive
- If they ask about something specific, recommend 1-2 activities from the list
- If nothing matches, just say "hmm, don't have that exact thing, but check out [similar option]"
- Remember previous messages in the conversation to handle follow-up questions naturally

AVAILABILITY INFO:
- Each activity has "operatingDays" (which days it runs), "maxCapacity" (max group size), and "nextAvailableDates" (next 30 days of available dates)
- The "nextAvailableDates" array shows dates in YYYY-MM-DD format that have availability
- When asked about availability, mention specific dates from the nextAvailableDates array
- If someone asks about dates beyond 30 days out, tell them to check the listing page directly
- If nextAvailableDates is empty, the activity is fully booked for the next 30 days

INTERACTIVE COMPONENTS:
Today's date is ${new Date().toISOString().split('T')[0]}.

CRITICAL: When using interactive components, your ENTIRE response must be ONLY the raw JSON object. Do NOT include any text before or after the JSON. Do NOT wrap JSON in markdown code blocks (no \`\`\`json). The raw JSON must be the complete response.

1. SINGLE ACTIVITY BOOKING - When user wants to book ONE specific activity:
{"message": "your friendly message", "showSlots": {"listingId": "the-listing-id", "listingTitle": "Activity Name", "requestedDate": "YYYY-MM-DD or null"}}

2. MULTIPLE ACTIVITIES ON A DATE - When user asks what activities/classes are available on a specific date:
{"message": "your friendly message", "showListingsForDate": {"date": "YYYY-MM-DD", "category": "category or null", "listingIds": ["id1", "id2", "id3"]}}

Use showListingsForDate when:
- User asks "what yoga classes are available Monday?"
- User asks "what can I do on December 5th?"
- User asks "show me wellness activities this Saturday"
- User asks about MULTIPLE activities on a specific day

Use showSlots when:
- User wants to book ONE specific activity by name
- User says "book", "reserve", "sign up for" a specific activity
- User asks for times for ONE specific activity

IMPORTANT DATE HANDLING:
- Convert relative dates (tomorrow, Monday, next week) to YYYY-MM-DD format
- "this Monday" means the coming Monday
- "next Monday" means the Monday after this coming one
- Always calculate from today's date: ${new Date().toISOString().split('T')[0]}

EXAMPLES:

User: "looking for yoga"
You: "Check out Sunrise Yoga on Secret Beach! $350 and it's at dawn with amazing views"

User: "what yoga classes do you have this Monday"
You: {"message": "Here are the yoga options for Monday! Tap any to see times:", "showListingsForDate": {"date": "2024-12-02", "category": "Wellness", "listingIds": ["id1", "id2"]}}

User: "what can I do tomorrow?"
You: {"message": "Here's what's happening tomorrow:", "showListingsForDate": {"date": "2024-12-01", "category": null, "listingIds": ["id1", "id2", "id3"]}}

User: "show me water sports on Saturday"
You: {"message": "Here are the water activities for Saturday:", "showListingsForDate": {"date": "2024-12-07", "category": "Water Sports", "listingIds": ["id1", "id2"]}}

User: "I want to book dog yoga"
You: {"message": "Here's the available slots for Dog Yoga:", "showSlots": {"listingId": "abc123", "listingTitle": "Dog Yoga", "requestedDate": null}}

User: "book sunrise yoga for Monday"
You: {"message": "Here are the slots for Sunrise Yoga on Monday:", "showSlots": {"listingId": "xyz789", "listingTitle": "Sunrise Yoga", "requestedDate": "2024-12-02"}}

User: "what's fun?"
You: "Depends what you're into! We've got beach parties, wellness stuff, water sports... what sounds good?"

Keep it real and conversational. No bullet points or formal lists.`;

      // Build conversation history for context
      const conversationContents = args.conversationHistory
        .slice(-6) // Keep last 6 messages (3 exchanges) to save tokens
        .map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        }));

      // Add current user query
      conversationContents.push({
        role: "user",
        parts: [{ text: args.userQuery }],
      });

      // Call Gemini API directly using fetch
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: conversationContents,
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            generationConfig: {
              temperature: 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Gemini] API error:", response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract text from response
      const rawText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I couldn't generate a recommendation right now. Please try again.";

      // Check if the response is JSON with component data
      const trimmedText = rawText.trim();
      if (trimmedText.startsWith("{") && trimmedText.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmedText);

          // Check if it's a showSlots response
          if (parsed.showSlots && parsed.showSlots.listingId) {
            const { listingId, listingTitle, requestedDate } = parsed.showSlots;

            // Calculate date range based on requested date or default to next 14 days
            const today = new Date();
            let startDate: string;
            let endDate: string;

            if (requestedDate) {
              // If specific date requested, fetch slots around that date (7 days before and after)
              const requested = new Date(requestedDate + 'T00:00:00');
              const weekBefore = new Date(requested.getTime() - 7 * 24 * 60 * 60 * 1000);
              const weekAfter = new Date(requested.getTime() + 7 * 24 * 60 * 60 * 1000);

              // Don't go before today
              startDate = weekBefore < today
                ? today.toISOString().split('T')[0]
                : weekBefore.toISOString().split('T')[0];
              endDate = weekAfter.toISOString().split('T')[0];
            } else {
              // Default: next 14 days from today
              startDate = today.toISOString().split('T')[0];
              endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];
            }

            try {
              const slots = await ctx.runQuery(api.availability.slots.getAvailableForBooking, {
                listingId: listingId as Id<"listings">,
                startDate,
                endDate,
              });

              // Return structured response with component data
              return JSON.stringify({
                message: parsed.message || "Here are the available times:",
                component: {
                  type: "time_slots",
                  props: {
                    type: "time_slots",
                    listingId,
                    listingTitle: listingTitle || "Activity",
                    requestedDate: requestedDate || null, // Pass requested date to component
                    slots: slots.map((slot: any) => ({
                      id: slot._id,
                      date: slot.date,
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                      available: slot.available,
                      capacity: slot.capacity,
                      booked: slot.booked,
                    })),
                  },
                },
              });
            } catch (slotError) {
              console.error("[Gemini] Error fetching slots:", slotError);
              // Fall back to text message if slots can't be fetched
              return parsed.message || "I couldn't load the available times. Please try again.";
            }
          }

          // Check if it's a showListingsForDate response
          if (parsed.showListingsForDate && parsed.showListingsForDate.date) {
            const { date, category, listingIds } = parsed.showListingsForDate;

            try {
              // Fetch listing details and slots for each listing
              const listingsWithSlots = await Promise.all(
                (listingIds || []).map(async (listingId: string) => {
                  try {
                    // Get listing details
                    const listing = await ctx.runQuery(api.listings.get, {
                      id: listingId as Id<"listings">,
                    });

                    // Get slots for just this date
                    const slots = await ctx.runQuery(api.availability.slots.getAvailableForBooking, {
                      listingId: listingId as Id<"listings">,
                      startDate: date,
                      endDate: date,
                    });

                    return {
                      id: listingId,
                      title: listing.title,
                      price: listing.price,
                      imageUrl: listing.imageUrl || '',
                      category: listing.category,
                      duration: listing.duration,
                      slots: slots.map((slot: any) => ({
                        id: slot._id,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        available: slot.available,
                        capacity: slot.capacity,
                      })),
                    };
                  } catch (err) {
                    console.error(`[Gemini] Error fetching listing ${listingId}:`, err);
                    return null;
                  }
                })
              );

              // Filter out any failed fetches and listings with no slots
              const validListings = listingsWithSlots.filter(
                (l): l is NonNullable<typeof l> => l !== null && l.slots.length > 0
              );

              // Format date for display
              const dateObj = new Date(date + 'T00:00:00');
              const dateDisplay = dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              });

              // Return structured response with component data
              return JSON.stringify({
                message: parsed.message || `Here's what's available on ${dateDisplay}:`,
                component: {
                  type: "listings_for_date",
                  props: {
                    type: "listings_for_date",
                    date,
                    dateDisplay,
                    category: category || undefined,
                    listings: validListings,
                  },
                },
              });
            } catch (listingsError) {
              console.error("[Gemini] Error fetching listings for date:", listingsError);
              return parsed.message || "I couldn't load the activities for that date. Please try again.";
            }
          }

          // If it's JSON but not a recognized component response, return the message
          return parsed.message || rawText;
        } catch (parseError) {
          // Not valid JSON, return as regular text
          console.log("[Gemini] Response looked like JSON but failed to parse:", parseError);
        }
      }

      return rawText;
    } catch (error) {
      console.error("[Gemini] Error:", error);
      return "Sawadee cup! I'm having a little trouble connecting to the spirit of the islands right now. Please try again later.";
    }
  },
});

/**
 * Create an ephemeral token for voice chat sessions
 *
 * This generates a short-lived token that the client can use to connect
 * directly to Gemini Live API without exposing the main API key.
 *
 * Token properties:
 * - Single use (1 session only)
 * - 1 minute window to start connection
 * - 30 minute max session duration
 * - Locked to specific model and config
 */
export const createVoiceSession = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("[Gemini Voice] API key not configured");
      throw new Error("Voice chat is currently unavailable. Please contact support.");
    }

    try {
      const client = new GoogleGenAI({ apiKey });

      // Create ephemeral token with constraints for voice sessions
      const token = await (client as any).authTokens.create({
        config: {
          uses: 1, // Single session only
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min max
          newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(), // 1 min to start
          liveConnectConstraints: {
            model: "gemini-2.5-flash-native-audio-preview-09-2025",
            config: {
              responseModalities: ["AUDIO"],
              temperature: 0.7,
            },
          },
          httpOptions: { apiVersion: "v1alpha" },
        },
      });

      console.log("[Gemini Voice] Created ephemeral token successfully");
      return { token: token.name };
    } catch (error) {
      console.error("[Gemini Voice] Error creating ephemeral token:", error);
      throw new Error("Failed to initialize voice session. Please try again.");
    }
  },
});
