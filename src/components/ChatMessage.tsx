import React from 'react';
import { Message } from '@/lib/chat-store';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatMetrics = (metrics: Message['performanceMetrics']) => {
    if (!metrics) return null;
    
    const parts = [];
    if (metrics.timeToFirstToken) parts.push(`TTFT: ${formatTime(metrics.timeToFirstToken)}`);
    if (metrics.totalResponseTime) parts.push(`Total: ${formatTime(metrics.totalResponseTime)}`);
    if (metrics.tokenCount) parts.push(`${metrics.tokenCount} tokens`);
    if (metrics.model) parts.push(metrics.model);
    if (metrics.dataset) parts.push(metrics.dataset);
    
    return parts.join(' • ');
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white ml-12'
            : 'bg-gray-100 text-gray-900 mr-12 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs mt-2 opacity-70 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        {!isUser && message.performanceMetrics && (
          <div className="text-xs mt-1 opacity-60 text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-1">
            {formatMetrics(message.performanceMetrics)}
          </div>
        )}
      </div>
    </div>
  );
}