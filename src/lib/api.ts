import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RAGRequest {
  query: string;
  index_name?: string; // Dataset index to search in
  top_k?: number; // Number of documents to retrieve (default: 3)
  stream?: boolean; // Whether to stream response (default: true)
}

export interface RAGResponse {
  response: string;
  sources?: number;
  dataset?: string;
  mode?: string;
  task_id?: string;
  status?: string;
  message?: string;
}

export interface DatasetInfo {
  index_name: string;
  document_count: number;
  embedding_field: string;
  dimensions: number;
}

export interface DatasetsResponse {
  datasets: DatasetInfo[];
  count: number;
}

class RAGApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120000, // 120 seconds timeout for RAG operations
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async sendMessage(request: RAGRequest): Promise<RAGResponse> {
    try {
      // Fetch available datasets to get a valid index_name
      const datasetsResponse = await this.listDatasets();
      const availableDatasets = datasetsResponse.datasets || [];

      if (availableDatasets.length === 0) {
        throw new Error('No datasets available. Please ensure your RAGLite backend has indexed documents.');
      }

      // Use provided index_name or default to the first available dataset
      const indexName = request.index_name || availableDatasets[0].index_name;

      // Validate that the chosen index exists
      const validDataset = availableDatasets.find((d: DatasetInfo) => d.index_name === indexName);
      if (!validDataset) {
        const availableNames = availableDatasets.map((d: DatasetInfo) => d.index_name).join(', ');
        throw new Error(`Dataset '${indexName}' not found. Available datasets: ${availableNames}`);
      }

      const requestData = {
        query: request.query,
        index_name: indexName,
        top_k: request.top_k || 3,
        stream: request.stream ?? true, // Enable streaming by default
      };

      const response = await this.api.post<RAGResponse>('/rag/generate', requestData);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      
      // Handle different types of errors
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. The RAG service may be processing a complex query. Please try again with a simpler question or wait a moment.');
        }
        if (error.response) {
          // Server responded with error status
          throw new Error(`Server error (${error.response.status}): ${error.response.data?.detail || error.message}`);
        }
        if (error.request) {
          // Network error
          throw new Error('Network error: Unable to connect to the RAG service. Please check if the backend is running.');
        }
      }
      
      throw new Error(`Failed to get response from RAG service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async streamMessage(request: RAGRequest): Promise<ReadableStream<Uint8Array>> {
    try {
      // Fetch available datasets to get a valid index_name
      const datasetsResponse = await this.listDatasets();
      const availableDatasets = datasetsResponse.datasets || [];

      if (availableDatasets.length === 0) {
        throw new Error('No datasets available. Please ensure your RAGLite backend has indexed documents.');
      }

      // Use provided index_name or default to the first available dataset
      const indexName = request.index_name || availableDatasets[0].index_name;

      // Validate that the chosen index exists
      const validDataset = availableDatasets.find((d: DatasetInfo) => d.index_name === indexName);
      if (!validDataset) {
        const availableNames = availableDatasets.map((d: DatasetInfo) => d.index_name).join(', ');
        throw new Error(`Dataset '${indexName}' not found. Available datasets: ${availableNames}`);
      }

      const requestData = {
        query: request.query,
        index_name: indexName,
        top_k: request.top_k || 3,
      };

      console.log('Streaming request data:', requestData);

      // Use fetch with POST and streaming
      const response = await fetch(`${API_BASE_URL}/rag/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      return response.body;
    } catch (error) {
      console.error('Streaming setup error:', error);
      throw new Error(`Failed to setup streaming: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/health', {
        timeout: 5000 // 5 seconds for health check
      });
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async listDatasets(): Promise<DatasetsResponse> {
    try {
      const response = await this.api.get<DatasetsResponse>('/datasets', {
        timeout: 10000 // 10 seconds for dataset listing
      });
      return response.data;
    } catch (error) {
      console.error('Failed to list datasets:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out while fetching datasets. Please check your connection.');
        }
        if (error.response) {
          throw new Error(`Server error (${error.response.status}): ${error.response.data?.detail || error.message}`);
        }
        if (error.request) {
          throw new Error('Network error: Unable to connect to the RAG service. Please check if the backend is running.');
        }
      }
      
      throw new Error('Failed to fetch datasets');
    }
  }
}

export const ragApi = new RAGApiService();