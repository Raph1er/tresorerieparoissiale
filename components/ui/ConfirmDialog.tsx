"use client";

import React from "react";

interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title = "Confirmer l'action",
    description,
    confirmLabel = "Confirmer",
    cancelLabel = "Annuler",
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-darkgray border border-border dark:border-darkborder shadow-xl">
                <div className="px-6 py-4 border-b border-border dark:border-darkborder">
                    <h3 className="text-lg font-semibold text-dark dark:text-white">{title}</h3>
                </div>

                <div className="p-6">
                    {description ? (
                        <p className="text-sm text-bodytext">{description}</p>
                    ) : null}

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm text-link dark:text-white"
                            disabled={loading}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="rounded-xl bg-error px-4 py-2 text-sm text-white disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? "Suppression..." : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
