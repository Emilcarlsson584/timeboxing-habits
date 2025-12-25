import React from "react";

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-2xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 ${className}`}
      {...props}
    />
  );
}
