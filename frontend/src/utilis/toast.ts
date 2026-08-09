// src/utils/toast.ts

import { toast } from 'react-toastify';
import type { Id, ToastOptions } from 'react-toastify';

const defaultOptions: ToastOptions = {
  position: 'top-right',
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,

  className: 'app-toast',
  progressClassName: 'app-toast-progress',
};

interface ToastUpdateOptions extends ToastOptions {
  render?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  isLoading?: boolean;
}

export const ToastNotification = Object.freeze({
  success: (
    message: string,
    options?: ToastOptions,
  ): Id =>
    toast.success(message, {
      ...defaultOptions,
      autoClose: 3000,
      ...options,
    }),

  error: (
    message: string,
    options?: ToastOptions,
  ): Id =>
    toast.error(message, {
      ...defaultOptions,
      autoClose: 4000,
      ...options,
    }),

  info: (
    message: string,
    options?: ToastOptions,
  ): Id =>
    toast.info(message, {
      ...defaultOptions,
      autoClose: 3000,
      ...options,
    }),

  warning: (
    message: string,
    options?: ToastOptions,
  ): Id =>
    toast.warning(message, {
      ...defaultOptions,
      autoClose: 3000,
      ...options,
    }),

  dismiss: (id?: Id): void => {
    toast.dismiss(id);
  },

  loading: (
    message: string,
    options?: ToastOptions,
  ): Id =>
    toast.loading(message, {
      ...defaultOptions,
      autoClose: false,
      ...options,
    }),

  update: (
    id: Id,
    {
      render,
      type,
      isLoading,
      ...options
    }: ToastUpdateOptions,
  ): void => {
    const autoClose =
      options.autoClose !== undefined
        ? options.autoClose
        : isLoading === false
          ? 3000
          : false;

    toast.update(id, {
      ...defaultOptions,
      render,
      type,
      isLoading,
      ...options,
      autoClose,
    });
  },
});