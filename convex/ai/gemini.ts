/**
 * Gemini AI Backend Action
 *
 * Securely calls the Gemini API from the server-side,
 * keeping the API key hidden from clients.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

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

EXAMPLES:
User: "looking for yoga"
You: "Check out Sunrise Yoga on Secret Beach! $350 and it's at dawn with amazing views"

User: "what time does it start?"
You: "It's at dawn, so around 6am. Perfect way to start the day!"

User: "when is it available?"
You: "Dog Yoga has spots open on Dec 15, Dec 18, Dec 20, and several other dates this month! Takes up to 8 people."

User: "is it available this Monday?"
You: "Yep! Dec 18 is open. Want me to find something else too?"

User: "what about in February?"
You: "I only have availability for the next 30 days. Check the Dog Yoga listing page to see February dates!"

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
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I couldn't generate a recommendation right now. Please try again.";

      return text;
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
