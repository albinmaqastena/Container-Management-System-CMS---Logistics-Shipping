// src/components/common/UI/ToastNotifications.tsx

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const ToastNotifications = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      limit={4}
    />
  );
};

export default ToastNotifications;