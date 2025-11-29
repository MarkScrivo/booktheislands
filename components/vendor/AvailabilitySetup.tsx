/**
 * AvailabilitySetup Component
 *
 * Allows vendors to create and manage availability rules for their listings.
 * Supports both recurring patterns (daily/weekly/monthly) and one-time events.
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Calendar, Clock, Users, Trash2, Plus, Save, X, Edit, RefreshCw } from 'lucide-react';

interface AvailabilitySetupProps {
  listingId: Id<"listings">;
}

type RuleType = 'recurring' | 'one-time';
type Frequency = 'daily' | 'weekly' | 'monthly';

export const AvailabilitySetup: React.FC<AvailabilitySetupProps> = ({
  listingId,
}) => {
  // Queries
  const rules = useQuery(api.availability.rules.getByListing, { listingId });

  // Mutations
  const createRule = useMutation(api.availability.rules.create);
  const updateRule = useMutation(api.availability.rules.update);
  const deleteRule = useMutation(api.availability.rules.remove);
  const generateSlots = useMutation(api.availability.slots.generateSlotsFromRule);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<Id<"availabilityRules"> | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState<RuleType>('recurring');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [bookingDeadlineHours, setBookingDeadlineHours] = useState(2);
  const [generateDaysInAdvance, setGenerateDaysInAdvance] = useState<number | 'indefinite'>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekdays = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
  ];

  const handleDayToggle = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleEditRule = (rule: any) => {
    setEditingRuleId(rule._id);
    setRuleName(rule.name);
    setRuleType(rule.ruleType);

    if (rule.ruleType === 'recurring' && rule.pattern) {
      setFrequency(rule.pattern.frequency);
      setDaysOfWeek(rule.pattern.daysOfWeek);
      setStartTime(rule.pattern.startTime);
      setDuration(rule.pattern.duration);
    } else {
      setOneTimeDate(rule.oneTimeDate || '');
      setStartTime(rule.oneTimeStartTime || '09:00');
      setDuration(rule.oneTimeDuration || 60);
    }

    setCapacity(rule.capacity);
    setBookingDeadlineHours(rule.bookingDeadlineHours);
    setGenerateDaysInAdvance(rule.generateDaysInAdvance);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleType('recurring');
    setFrequency('weekly');
    setDaysOfWeek([]);
    setStartTime('09:00');
    setDuration(60);
    setOneTimeDate('');
    setCapacity(10);
    setBookingDeadlineHours(2);
    setGenerateDaysInAdvance(30);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!ruleName.trim()) {
        throw new Error('Please enter a name for this session type');
      }

      let ruleIdToGenerate: Id<"availabilityRules">;

      if (editingRuleId) {
        // Update existing rule
        const updates: any = {
          ruleId: editingRuleId,
          name: ruleName,
          capacity,
          bookingDeadlineHours,
          generateDaysInAdvance,
        };

        if (ruleType === 'recurring') {
          if (daysOfWeek.length === 0) {
            throw new Error('Please select at least one day of the week');
          }
          updates.pattern = {
            frequency,
            daysOfWeek,
            startTime,
            duration,
          };
        } else {
          if (!oneTimeDate) {
            throw new Error('Please select a date for the one-time event');
          }
          updates.oneTimeDate = oneTimeDate;
          updates.oneTimeStartTime = startTime;
          updates.oneTimeDuration = duration;
        }

        await updateRule(updates);
        ruleIdToGenerate = editingRuleId;
      } else {
        // Create new rule
        if (ruleType === 'recurring') {
          if (daysOfWeek.length === 0) {
            throw new Error('Please select at least one day of the week');
          }

          ruleIdToGenerate = await createRule({
            listingId,
            name: ruleName,
            ruleType: 'recurring',
            pattern: {
              frequency,
              daysOfWeek,
              startTime,
              duration,
            },
            capacity,
            bookingDeadlineHours,
            generateDaysInAdvance,
            active: true,
          });
        } else {
          if (!oneTimeDate) {
            throw new Error('Please select a date for the one-time event');
          }

          ruleIdToGenerate = await createRule({
            listingId,
            name: ruleName,
            ruleType: 'one-time',
            oneTimeDate,
            oneTimeStartTime: startTime,
            oneTimeDuration: duration,
            capacity,
            bookingDeadlineHours,
            generateDaysInAdvance: 1,
            active: true,
          });
        }
      }

      // Generate slots immediately
      await generateSlots({ ruleId: ruleIdToGenerate });

      // Reset form
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSlots = async (ruleId: Id<"availabilityRules">) => {
    try {
      await generateSlots({ ruleId });
      alert('Slots generated successfully! Check your calendar.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate slots');
    }
  };

  const handleDelete = async (ruleId: Id<"availabilityRules">) => {
    if (!confirm('Are you sure? This will delete all future slots with no bookings.')) {
      return;
    }

    try {
      await deleteRule({ ruleId });
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const formatSchedule = (rule: any) => {
    if (rule.ruleType === 'recurring' && rule.pattern) {
      const days = rule.pattern.daysOfWeek
        .sort((a: number, b: number) => a - b)
        .map((d: number) => weekdays.find(w => w.value === d)?.label)
        .join(', ');
      const freq = rule.pattern.frequency;
      return `${freq.charAt(0).toUpperCase() + freq.slice(1)}: ${days} at ${rule.pattern.startTime} (${rule.pattern.duration}min)`;
    } else {
      return `One-time: ${rule.oneTimeDate} at ${rule.oneTimeStartTime} (${rule.oneTimeDuration}min)`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Availability Rules</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define when your service is available for booking
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-teal-600 dark:bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 transition"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingRuleId ? 'Edit Session Type' : 'New Session Type'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Rule Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session Name *
            </label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Morning Dog Yoga, Sunset Session"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Rule Type Toggle */}
          {!editingRuleId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRuleType('recurring')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                    ruleType === 'recurring'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Recurring
                </button>
                <button
                  type="button"
                  onClick={() => setRuleType('one-time')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                    ruleType === 'one-time'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  One-Time
                </button>
              </div>
            </div>
          )}

          {/* Recurring Pattern */}
          {ruleType === 'recurring' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Days of Week
                </label>
                <div className="flex gap-2">
                  {weekdays.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleDayToggle(day.value)}
                      className={`flex-1 py-2 px-2 rounded-lg font-medium transition ${
                        daysOfWeek.includes(day.value)
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* One-Time Date */}
          {ruleType === 'one-time' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={oneTimeDate}
                onChange={(e) => setOneTimeDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          )}

          {/* Time and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                min="15"
                step="15"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Capacity
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value))}
              min="1"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Booking Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Booking Deadline (hours before)
            </label>
            <input
              type="number"
              value={bookingDeadlineHours}
              onChange={(e) => setBookingDeadlineHours(parseInt(e.target.value))}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Generate Days in Advance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Generate Slots (days in advance)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={generateDaysInAdvance === 'indefinite' ? 90 : generateDaysInAdvance}
                onChange={(e) => setGenerateDaysInAdvance(parseInt(e.target.value))}
                min="1"
                max="365"
                disabled={generateDaysInAdvance === 'indefinite'}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={generateDaysInAdvance === 'indefinite'}
                  onChange={(e) => setGenerateDaysInAdvance(e.target.checked ? 'indefinite' : 30)}
                  className="rounded"
                />
                Indefinite
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-teal-600 dark:bg-teal-500 text-white py-2 px-4 rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : editingRuleId ? 'Update Rule' : 'Create Rule'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {rules === undefined ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-500 dark:text-gray-400">No availability rules yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Create your first rule to start accepting bookings
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule._id}
              className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{rule.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {formatSchedule(rule)}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Capacity: {rule.capacity}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Deadline: {rule.bookingDeadlineHours}h before
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerateSlots(rule._id)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                    title="Generate slots now"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition"
                    title="Edit rule"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule._id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
