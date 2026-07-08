// src/contexts/ContainerContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { containerService } from '../services/container.service';
import {
  Container,
  CreateContainerData,
  UpdateContainerData,
  PaginationParams,
  PaginatedResponse, // ✅ Shto këtë import
} from '../types';
import { toast } from 'react-toastify';

interface ContainerContextType {
  containers: Container[];
  activeContainers: Container[];
  archivedContainers: Container[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  fetchContainers: (params?: PaginationParams) => Promise<void>;
  fetchActiveContainers: (params?: PaginationParams) => Promise<void>;
  fetchArchivedContainers: (params?: PaginationParams) => Promise<void>;
  fetchDeletedContainers: (params?: PaginationParams) => Promise<void>;
  getContainer: (id: string) => Promise<Container>;
  createContainer: (data: CreateContainerData) => Promise<Container>;
  updateContainer: (id: string, data: UpdateContainerData) => Promise<Container>;
  updateContainerStatus: (id: string, status: string) => Promise<Container>;
  softDeleteContainer: (id: string) => Promise<void>;
  restoreContainer: (id: string) => Promise<Container>;
  permanentDeleteContainer: (id: string) => Promise<void>;
  searchContainers: (query: string, params?: PaginationParams) => Promise<PaginatedResponse<Container>>; // ✅ Përditësuar
  clearError: () => void;
}

// ✅ Krijimi i context-it
const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

// ✅ Hook i personalizuar për përdorimin e context-it
export const useContainers = () => {
  const context = useContext(ContainerContext);
  if (!context) {
    throw new Error('useContainers must be used within a ContainerProvider');
  }
  return context;
};

interface ContainerProviderProps {
  children: ReactNode;
}

// ✅ Provider komponenti
export const ContainerProvider: React.FC<ContainerProviderProps> = ({ children }) => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [activeContainers, setActiveContainers] = useState<Container[]>([]);
  const [archivedContainers, setArchivedContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0,
    hasMore: false,
  });

  const handleError = (error: any) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    setError(message);
    toast.error(message);
  };

  const fetchContainers = async (params?: PaginationParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await containerService.getAll(params);
      setContainers(response.data);
      setPagination({
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.hasMore,
      });
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveContainers = async (params?: PaginationParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await containerService.getActive(params);
      setActiveContainers(response.data);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedContainers = async (params?: PaginationParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await containerService.getArchived(params);
      setArchivedContainers(response.data);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedContainers = async (params?: PaginationParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await containerService.getDeleted(params);
      setContainers(response.data);
      setPagination({
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.hasMore,
      });
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const getContainer = async (id: string): Promise<Container> => {
    setLoading(true);
    setError(null);
    try {
      const container = await containerService.getById(id);
      return container;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createContainer = async (data: CreateContainerData): Promise<Container> => {
    setLoading(true);
    setError(null);
    try {
      const container = await containerService.create(data);
      await fetchActiveContainers();
      toast.success('Container created successfully!');
      return container;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateContainer = async (id: string, data: UpdateContainerData): Promise<Container> => {
    setLoading(true);
    setError(null);
    try {
      const container = await containerService.update(id, data);
      await fetchContainers();
      await fetchActiveContainers();
      await fetchArchivedContainers();
      toast.success('Container updated successfully!');
      return container;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateContainerStatus = async (id: string, status: string): Promise<Container> => {
    setLoading(true);
    setError(null);
    try {
      const container = await containerService.updateStatus(id, status);
      await fetchContainers();
      await fetchActiveContainers();
      await fetchArchivedContainers();
      toast.success(`Container status updated to ${status}`);
      return container;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const softDeleteContainer = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await containerService.softDelete(id);
      await fetchContainers();
      await fetchActiveContainers();
      await fetchArchivedContainers();
      toast.success('Container moved to trash');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const restoreContainer = async (id: string): Promise<Container> => {
    setLoading(true);
    setError(null);
    try {
      const container = await containerService.restore(id);
      await fetchContainers();
      await fetchActiveContainers();
      await fetchArchivedContainers();
      toast.success('Container restored successfully!');
      return container;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const permanentDeleteContainer = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await containerService.permanentDelete(id);
      await fetchContainers();
      toast.success('Container permanently deleted');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ✅ searchContainers - tashmë brenda objektit
  const searchContainers = async (query: string, params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
    setLoading(true);
    setError(null);
    try {
      const results = await containerService.search(query, params);
      return results;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  // Load initial data
  useEffect(() => {
    fetchActiveContainers();
    fetchArchivedContainers();
  }, []);

  const value: ContainerContextType = {
    containers,
    activeContainers,
    archivedContainers,
    loading,
    error,
    pagination,
    fetchContainers,
    fetchActiveContainers,
    fetchArchivedContainers,
    fetchDeletedContainers,
    getContainer,
    createContainer,
    updateContainer,
    updateContainerStatus,
    softDeleteContainer,
    restoreContainer,
    permanentDeleteContainer,
    searchContainers,
    clearError,
  };

  return <ContainerContext.Provider value={value}>{children}</ContainerContext.Provider>;
};

export { ContainerContext };