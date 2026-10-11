"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function Sheet({ isOpen, onClose, title, description, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  // Close on backdrop click (native dialog clicks outside inner content hit the dialog element)
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleClick}
      aria-labelledby={title ? "sheet-title" : undefined}
      aria-describedby={description ? "sheet-description" : undefined}
      className="m-0 p-0 max-w-none w-full max-h-[90vh] bg-transparent backdrop:bg-black/45 backdrop:backdrop-blur-xs fixed inset-x-0 bottom-0 top-auto rounded-t-2xl sm:rounded-2xl sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg z-50 overflow-hidden shadow-2xl open:animate-in open:fade-in-0 open:slide-in-from-bottom-6 duration-200"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100">
          <div className="space-y-0.5">
            {title && (
              <h2 id="sheet-title" className="text-base font-semibold text-stone-900 font-serif">
                {title}
              </h2>
            )}
            {description && (
              <p id="sheet-description" className="text-xs text-stone-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center -mr-2 text-stone-500 hover:text-stone-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </dialog>
  );
}
