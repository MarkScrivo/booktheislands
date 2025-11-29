import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Loader2, Mail, Lock, User, ArrowRight, Palmtree, Wifi, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

// --- Shared Layout for Auth ---
interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => (
  <div className="min-h-screen flex bg-white dark:bg-gray-900">
    {/* Left Side - Form */}
    <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center lg:text-left">
            <Link to="/" className="inline-flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-xl mb-8">
                <Palmtree className="w-6 h-6" /> Book The Islands
            </Link>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">{title}</h1>
            <p className="text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>

    {/* Right Side - Image */}
    <div className="hidden lg:block w-1/2 bg-gray-900 dark:bg-gray-950 relative overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&q=80&w=2000"
        className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40"
        alt="Thailand Beach"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-teal-900/90 to-transparent dark:from-teal-950/90" />
      <div className="absolute bottom-0 left-0 p-16 text-white">
        <blockquote className="text-2xl font-medium leading-relaxed mb-4">
          "The journey of a thousand miles begins with a single booking."
        </blockquote>
        <p className="opacity-80">— Ancient Traveler</p>
      </div>
    </div>
  </div>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 🎉 Convex Auth: Sign in with password provider
      const result = await signIn('password', { email, password, flow: 'signIn' });

      if (result.signingIn) {
        navigate('/');
      } else {
        setError('Sign in failed. Please check your credentials.');
      }
    } catch (err: any) {
      // Show user-friendly error message instead of technical errors
      const errorMessage = err.message || '';
      if (errorMessage.includes('InvalidSecret') || errorMessage.includes('invalid') || errorMessage.includes('credentials')) {
        setError('Email or password is incorrect. Please try again.');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Enter your details to access your account.">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
             {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
                <Link to="/forgot-password" className="text-sm text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-700 dark:hover:text-teal-300">Forgot?</Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 dark:bg-teal-600 hover:bg-gray-800 dark:hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-gray-200 dark:shadow-teal-900/20 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-bold">
            Sign up for free
          </button>
        </div>
    </AuthLayout>
  );
};

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const upsertProfile = useMutation(api.profiles.upsert);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'customer' | 'vendor'>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 🎉 Convex Auth: Sign up with password provider
      const result = await signIn('password', {
        email,
        password,
        flow: 'signUp',
        name: fullName,
      });

      if (result.signingIn) {
        // Wait a moment for the auth session to be fully established
        await new Promise(resolve => setTimeout(resolve, 500));

        // After successful sign up, update profile with chosen role
        try {
          await upsertProfile({ email, fullName, role });
        } catch (profileErr) {
          console.warn('Profile update warning:', profileErr);
          // Don't fail registration if profile update has issues
        }

        navigate('/');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create an account" subtitle="Start your island journey today.">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name</label>
            <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
                placeholder="John Doe"
              />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
            <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
                placeholder="you@example.com"
              />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
            <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
              />
          </div>

          <div className="pt-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">I want to...</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                  role === 'customer'
                    ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="font-bold">Book Trips</div>
                <div className="text-xs mt-1 opacity-80">I'm a traveler</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('vendor')}
                className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                  role === 'vendor'
                    ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="font-bold">List Tours</div>
                <div className="text-xs mt-1 opacity-80">I'm a guide</div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 dark:bg-teal-600 hover:bg-gray-800 dark:hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-gray-200 dark:shadow-teal-900/20 mt-4 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-bold">
            Sign In
          </button>
        </div>
    </AuthLayout>
  );
};

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Request password reset from Convex Auth
      await signIn('password', { email, flow: 'reset' });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send you a link to reset your password.">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold mb-1">Check your email</p>
            <p className="text-xs opacity-90">We've sent a password reset link to {email}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
            placeholder="name@example.com"
            disabled={success}
          />
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-gray-900 dark:bg-teal-600 hover:bg-gray-800 dark:hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-gray-200 dark:shadow-teal-900/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : success ? 'Email Sent' : 'Send Reset Link'}
        </button>
      </form>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        Remember your password?{' '}
        <button onClick={() => navigate('/login')} className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-bold">
          Sign In
        </button>
      </div>
    </AuthLayout>
  );
};

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const code = searchParams.get('code');
  const email = searchParams.get('email');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!code) {
      setError('Invalid reset link');
      setLoading(false);
      return;
    }

    try {
      // Reset password with Convex Auth
      // Include email to help Password provider identify the account
      await signIn('password', { code, email, newPassword: password, flow: 'reset-verification' });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!code) {
    return (
      <AuthLayout title="Invalid Link" subtitle="This password reset link is invalid or has expired.">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>This reset link is invalid or has expired</span>
        </div>
        <button
          onClick={() => navigate('/forgot-password')}
          className="w-full bg-gray-900 dark:bg-teal-600 hover:bg-gray-800 dark:hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-gray-200 dark:shadow-teal-900/20 active:scale-[0.98]"
        >
          Request New Link
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Enter your new password below.">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold mb-1">Password reset successful!</p>
            <p className="text-xs opacity-90">Redirecting to login...</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
            placeholder="••••••••"
            disabled={success}
            minLength={8}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Confirm Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
            placeholder="••••••••"
            disabled={success}
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-gray-900 dark:bg-teal-600 hover:bg-gray-800 dark:hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-gray-200 dark:shadow-teal-900/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : success ? 'Password Reset!' : 'Reset Password'}
        </button>
      </form>
    </AuthLayout>
  );
};
