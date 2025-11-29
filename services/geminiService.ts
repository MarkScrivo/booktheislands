import { GoogleGenAI } from "@google/genai";
import { Listing } from "../types";

// Initialize the client once
// In Vite, environment variables must be prefixed with VITE_ and accessed via import.meta.env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper function to intelligently filter relevant listings based on query
const getRelevantListings = (query: string, listings: Listing[], maxResults: number = 6): Listing[] => {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(' ').filter(word => word.length > 2);

  // Score each listing based on relevance
  const scored = listings.map(listing => {
    let score = 0;
    const searchText = `${listing.title} ${listing.description} ${listing.category} ${listing.location}`.toLowerCase();

    // Exact category match
    if (queryLower.includes(listing.category.toLowerCase())) score += 10;

    // Keyword matches
    keywords.forEach(keyword => {
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
    .map(item => item.listing);
};

export const generateTripRecommendations = async (
  userQuery: string,
  availableListings: Listing[],
  conversationHistory: { role: 'user' | 'model', text: string }[] = [],
  availabilityData: Record<string, Record<string, { booked: number; capacity: number; available: number }>> = {}
): Promise<string> => {
  // Check if AI client is initialized
  if (!ai) {
    return "AI Assistant is currently unavailable. Please check that your Gemini API key is set in the environment variables.";
  }

  try {
    // OPTIMIZATION: Only send relevant listings instead of all listings
    const relevantListings = getRelevantListings(userQuery, availableListings);

    // Build availability summary for relevant listings only
    const availabilitySummary: Record<string, string[]> = {};
    relevantListings.forEach(listing => {
      if (availabilityData[listing.id]) {
        const dates = Object.entries(availabilityData[listing.id])
          .filter(([_, data]) => data.available > 0)
          .map(([date]) => date)
          .sort()
          .slice(0, 10); // Only include first 10 available dates to save tokens

        if (dates.length > 0) {
          availabilitySummary[listing.id] = dates;
        }
      }
    });

    const listingsContext = JSON.stringify(
      relevantListings.map(l => ({
        id: l.id,
        title: l.title,
        location: l.location,
        category: l.category,
        price: l.price,
        duration: l.duration,
        maxCapacity: l.maxCapacity,
        operatingDays: l.operatingDays,
        description: l.description.substring(0, 100), // Trim descriptions to save tokens
        nextAvailableDates: availabilitySummary[l.id] || [] // Include available dates
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
You: "Check out Sunrise Yoga on Secret Beach! $350 and it's at dawn with amazing views 🌅"

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

    // Build conversation history for context (exclude initial greeting)
    const conversationContents = conversationHistory
      .filter(msg => msg.role === 'user' || msg.role === 'model')
      .slice(-6) // Keep last 6 messages (3 exchanges) to save tokens
      .map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

    // Add current user query
    conversationContents.push({
      role: 'user',
      parts: [{ text: userQuery }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: conversationContents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "I couldn't generate a recommendation right now. Please try again.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sawadee cup! I'm having a little trouble connecting to the spirit of the islands right now. Please check your API key or try again later.";
  }
};