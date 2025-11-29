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
When the user wants to BOOK an activity or asks to SEE AVAILABLE TIMES/SLOTS for a specific activity, respond with a JSON object like this:
{"message": "your friendly message here", "showSlots": {"listingId": "the-listing-id", "listingTitle": "Activity Name", "requestedDate": "YYYY-MM-DD or null"}}

IMPORTANT: If the user mentions a specific date (like "December 12th", "next Monday", "tomorrow"), include that date in requestedDate as YYYY-MM-DD format. If no specific date mentioned, use null.

Today's date is ${new Date().toISOString().split('T')[0]}.

ONLY use showSlots when:
- User explicitly wants to book ("I want to book", "can I book", "let me book", "book this")
- User asks for available slots/times ("show me times", "what times are available", "when can I go")
- User is ready to pick a time for a specific activity

Do NOT use showSlots for:
- General questions about availability dates (just mention dates in text)
- Questions about what activities are available (just describe them)
- Price inquiries or other info questions

EXAMPLES:
User: "looking for yoga"
You: "Check out Sunrise Yoga on Secret Beach! $350 and it's at dawn with amazing views"

User: "what time does it start?"
You: "It's at dawn, so around 6am. Perfect way to start the day!"

User: "when is it available?"
You: "Dog Yoga has spots open on Dec 15, Dec 18, Dec 20, and several other dates this month! Takes up to 8 people."

User: "I want to book dog yoga"
You: {"message": "Here's the available slots for Dog Yoga! Pick a time that works for you:", "showSlots": {"listingId": "abc123", "listingTitle": "Dog Yoga", "requestedDate": null}}

User: "can I book dog yoga for December 12th"
You: {"message": "Here are the slots for Dog Yoga on December 12th:", "showSlots": {"listingId": "abc123", "listingTitle": "Dog Yoga", "requestedDate": "2024-12-12"}}

User: "show me available times for sunrise yoga"
You: {"message": "Here are the available times for Sunrise Yoga:", "showSlots": {"listingId": "xyz789", "listingTitle": "Sunrise Yoga on Secret Beach", "requestedDate": null}}

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

          // If it's JSON but not a showSlots response, return the message
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
