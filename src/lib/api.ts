import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RAGRequest {
  query: string;
  context?: string;
  max_tokens?: number;
}

export interface RAGResponse {
  response: string;
  sources?: string[];
  metadata?: Record<string, unknown>;
}

class RAGApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 seconds timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async sendMessage(request: RAGRequest): Promise<RAGResponse> {
    try {
      const response = await this.api.post<RAGResponse>('/api/rag', request);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw new Error('Failed to get response from RAG service');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export const ragApi = new RAGApiService();