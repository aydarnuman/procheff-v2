import React from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = "info", onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const color =
    type === "success"
      ? "bg-green-600 border-green-400"
      : type === "error"
      ? "bg-red-600 border-red-400"
      : "bg-blue-600 border-blue-400";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg border text-white text-sm font-medium ${color}`}
      role="alert"
    >
      {message}
      <button
        className="ml-4 text-white/80 hover:text-white text-xs"
        onClick={onClose}
        aria-label="Kapat"
      >
        ✕
      </button>
    </div>
  );
};
