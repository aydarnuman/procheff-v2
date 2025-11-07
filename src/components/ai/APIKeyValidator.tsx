// ============================================================================
// API KEY VALIDATOR COMPONENT
// Claude & Gemini API anahtarlarını test eder
// ============================================================================

'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface APIKeyStatus {
  provider: 'claude' | 'gemini';
  isValid: boolean;
  isLoading: boolean;
  error?: string;
  model?: string;
  rateLimit?: {
    limit: string;
    remaining?: number;
  };
}

export const APIKeyValidator = () => {
  const [claudeStatus, setClaudeStatus] = useState<APIKeyStatus>({
    provider: 'claude',
    isValid: false,
    isLoading: false,
  });

  const [geminiStatus, setGeminiStatus] = useState<APIKeyStatus>({
    provider: 'gemini',
    isValid: false,
    isLoading: false,
  });

  const testClaudeKey = async () => {
    setClaudeStatus({ ...claudeStatus, isLoading: true });
    
    try {
      const response = await fetch('/api/internal/test-api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'claude' }),
      });

      const result = await response.json();

      if (result.success) {
        setClaudeStatus({
          provider: 'claude',
          isValid: true,
          isLoading: false,
          model: result.model,
          rateLimit: result.rateLimit,
        });
        toast.success('Claude API Key Active', {
          description: `Model: ${result.model}`,
        });
      } else {
        setClaudeStatus({
          provider: 'claude',
          isValid: false,
          isLoading: false,
          error: result.error,
        });
        toast.error('Claude API Key Invalid', {
          description: result.error,
        });
      }
    } catch (error) {
      setClaudeStatus({
        provider: 'claude',
        isValid: false,
        isLoading: false,
        error: 'Network error',
      });
      toast.error('Failed to test Claude API key');
    }
  };

  const testGeminiKey = async () => {
    setGeminiStatus({ ...geminiStatus, isLoading: true });
    
    try {
      const response = await fetch('/api/internal/test-api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'gemini' }),
      });

      const result = await response.json();

      if (result.success) {
        setGeminiStatus({
          provider: 'gemini',
          isValid: true,
          isLoading: false,
          model: result.model,
        });
        toast.success('Gemini API Key Active', {
          description: `Model: ${result.model}`,
        });
      } else {
        setGeminiStatus({
          provider: 'gemini',
          isValid: false,
          isLoading: false,
          error: result.error,
        });
        toast.error('Gemini API Key Invalid', {
          description: result.error,
        });
      }
    } catch (error) {
      setGeminiStatus({
        provider: 'gemini',
        isValid: false,
        isLoading: false,
        error: 'Network error',
      });
      toast.error('Failed to test Gemini API key');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        API Key Validation
      </h3>

      {/* Claude */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white text-xl">🧠</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Claude API</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Anthropic Claude Sonnet 4
              </p>
            </div>
          </div>

          <button
            onClick={testClaudeKey}
            disabled={claudeStatus.isLoading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            {claudeStatus.isLoading ? 'Testing...' : 'Test Key'}
          </button>
        </div>

        {claudeStatus.isValid && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <span className="text-lg">✅</span>
              <span className="font-medium">API Key Active</span>
            </div>
            {claudeStatus.model && (
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                Model: {claudeStatus.model}
              </p>
            )}
          </div>
        )}

        {claudeStatus.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <span className="text-lg">❌</span>
              <span className="font-medium">Invalid API Key</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-500 mt-1">
              {claudeStatus.error}
            </p>
          </div>
        )}
      </div>

      {/* Gemini */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <span className="text-white text-xl">💎</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Gemini API</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Google Gemini 2.0 Flash
              </p>
            </div>
          </div>

          <button
            onClick={testGeminiKey}
            disabled={geminiStatus.isLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            {geminiStatus.isLoading ? 'Testing...' : 'Test Key'}
          </button>
        </div>

        {geminiStatus.isValid && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <span className="text-lg">✅</span>
              <span className="font-medium">API Key Active</span>
            </div>
            {geminiStatus.model && (
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                Model: {geminiStatus.model}
              </p>
            )}
          </div>
        )}

        {geminiStatus.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <span className="text-lg">❌</span>
              <span className="font-medium">Invalid API Key</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-500 mt-1">
              {geminiStatus.error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
