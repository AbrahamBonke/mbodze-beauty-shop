import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Lock } from 'lucide-react';

const ADMIN_EMAIL = 'admin@gmail.com';

export default function Auth() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signIn, signUp } = useAuth();

  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!setupPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }

    if (setupPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (setupPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(ADMIN_EMAIL, setupPassword);
      setError('Admin account created! You can now sign in.');
      setIsFirstTime(false);
      setSetupPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(ADMIN_EMAIL, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">MBODZE'S BEAUTY SHOP</h1>
            <p className="text-gray-500 mt-2">Sales & Stock Management</p>
          </div>

          {!isFirstTime ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-purple-900">
                  <Lock className="w-4 h-4 inline mr-2" />
                  Admin Account: <strong>{ADMIN_EMAIL}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {error && (
                <div className={`text-sm p-3 rounded-lg ${
                  error.includes('created') 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleFirstTimeSetup} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-blue-900">
                  First-time setup: Create a password for the admin account
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Enter a strong password (min. 6 characters)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {error && (
                <div className="text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Setting up...' : 'Set Up Admin Account'}
              </button>
            </form>
          )}

          {!isFirstTime && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsFirstTime(true);
                  setError('');
                  setPassword('');
                }}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                First time? Set up admin account
              </button>
            </div>
          )}

          {isFirstTime && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsFirstTime(false);
                  setError('');
                  setSetupPassword('');
                  setConfirmPassword('');
                }}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                Already have an account? Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
