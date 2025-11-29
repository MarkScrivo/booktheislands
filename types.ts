
export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'vendor' | 'admin';
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  location: string;
  price: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  category: ActivityCategory;
  vendorName: string;
  vendorId?: string; // ID of the user who created it
  duration: string;
  galleryUrls?: string[];
  videoUrl?: string;
  // Inventory Fields
  maxCapacity: number; 
  operatingDays: string[]; // ['Mon', 'Tue', etc.]
  externalIcalUrl?: string; // URL for syncing FROM Google/Airbnb
  // Map Fields
  latitude?: number;
  longitude?: number;
}

export type TimeSlot = 'morning' | 'afternoon' | 'full_day';

export interface AvailabilityBlock {
  id: string;
  listingId: string;
  date: string; // YYYY-MM-DD
  reason?: string;
  source?: 'manual' | 'ical'; // Track if this was clicked by user or synced
  timeSlot?: TimeSlot; // Specific slot blocked, defaults to full_day
}

export interface Review {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export enum ActivityCategory {
  TRANSPORTATION = 'Transportation',
  WELLNESS = 'Wellness',
  WATER_SPORTS = 'Water Sports',
  CULTURAL = 'Cultural',
  NATURE = 'Nature',
  FOOD = 'Food & Drink',
  ADVENTURE = 'Adventure',
  RELAXATION = 'Relaxation'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  // Interactive component support
  component?: {
    type: 'time_slots' | 'listing_card' | 'quick_actions' | 'booking_confirm';
    props: ChatComponentProps;
  };
}

// Chat component prop types
export type ChatComponentProps =
  | TimeSlotComponentProps
  | ListingCardComponentProps
  | QuickActionsComponentProps
  | BookingConfirmComponentProps;

export interface TimeSlotComponentProps {
  type: 'time_slots';
  listingId: string;
  listingTitle: string;
  requestedDate?: string | null; // YYYY-MM-DD format, auto-select this date if provided
  slots: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    available: number;
    capacity: number;
    booked: number;
  }>;
}

export interface ListingCardComponentProps {
  type: 'listing_card';
  listingId: string;
  title: string;
  price: number;
  imageUrl: string;
  category: string;
  rating?: number;
}

export interface QuickActionsComponentProps {
  type: 'quick_actions';
  actions: Array<{
    label: string;
    value: string;
  }>;
}

export interface BookingConfirmComponentProps {
  type: 'booking_confirm';
  bookingId: string;
  listingTitle: string;
  date: string;
  time: string;
  guests: number;
}

export interface Booking {
  id: string;
  listingId: string;
  listingTitle: string;
  slotId?: string; // NEW - links to specific time slot
  date: string;
  guests: number;
  totalPrice: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  customerName: string;
  customerEmail: string;
  customerId?: string; // Linked to auth user
  vendorId?: string; // Linked to listing owner
  timeSlot?: TimeSlot; // morning, afternoon, or full_day
  // Cancellation info (NEW)
  cancelledAt?: number;
  cancelledBy?: string;
  cancellationReason?: 'weather' | 'emergency' | 'personal' | 'other' | 'customer_request';
  cancellationMessage?: string;
  refundProcessed?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  listingId?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string; // Joined from profiles
  listingTitle?: string; // Joined from listings
}

// ============================================
// CALENDAR SYSTEM TYPES
// ============================================

export interface AvailabilityRule {
  id: string;
  listingId: string;
  vendorId: string;
  ruleType: 'recurring' | 'one-time';
  // Recurring pattern (for recurring rules)
  pattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    daysOfWeek: number[]; // [1,3,5] for Mon/Wed/Fri (1=Mon, 7=Sun)
    startTime: string; // "06:00"
    duration: number; // minutes
  };
  // One-time details (for one-time rules)
  oneTimeDate?: string; // YYYY-MM-DD
  oneTimeStartTime?: string; // "14:00"
  oneTimeDuration?: number; // minutes
  // Capacity and settings
  capacity: number; // Max bookings per slot
  bookingDeadlineHours: number; // Hours before start (e.g., 2)
  generateDaysInAdvance: number | 'indefinite'; // How far ahead to generate
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Slot {
  id: string;
  listingId: string;
  vendorId: string;
  ruleId?: string; // Source rule (if generated from rule)
  // Date and time
  date: string; // YYYY-MM-DD
  startTime: string; // "06:00"
  endTime: string; // "08:00"
  // Capacity tracking
  capacity: number; // Total capacity
  booked: number; // Currently booked
  available: number; // Remaining spots (capacity - booked)
  // Status
  status: 'active' | 'blocked' | 'cancelled' | 'completed';
  bookingDeadline: number; // Unix timestamp when booking closes
  // Cancellation info (if cancelled)
  cancelledAt?: number;
  cancellationReason?: 'weather' | 'emergency' | 'personal' | 'other';
  cancellationMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WaitlistEntry {
  id: string;
  slotId: string;
  listingId: string; // Denormalized for queries
  customerId: string;
  customerEmail: string;
  // Waitlist tracking
  joinedAt: number; // Unix timestamp (FIFO order)
  notified: boolean; // Has customer been notified?
  notifiedAt?: number; // When notification was sent
  status: 'waiting' | 'notified' | 'expired' | 'booked';
  expiresAt?: number; // Notification expiry (24 hours after notification)
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'waitlist_spot_available' | 'booking_cancelled_by_vendor' | 'booking_confirmed' | 'booking_reminder';
  title: string;
  message: string;
  // Related entities
  listingId?: string;
  bookingId?: string;
  slotId?: string;
  waitlistId?: string;
  // Status
  isRead: boolean;
  readAt?: number;
  // Action
  actionUrl?: string;
  actionLabel?: string;
  // Timestamps
  createdAt: number;
  updatedAt: number;
}
