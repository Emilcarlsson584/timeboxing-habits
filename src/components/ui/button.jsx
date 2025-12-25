import React from "react";

export function Button({ variant, size, className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-sm font-medium shadow-sm hover:opacity-90";
  const styles =
    variant === "outline"
      ? "bg-transparent"
      : variant === "ghost"
      ? "border-transparent bg-transparent shadow-none"
      : variant === "destructive"
      ? "bg-red-600 text-white border-red-600"
      : "bg-black text-white border-black";
  const sizing = size === "icon" ? "h-9 w-9 p-0" : "";
  return <button className={`${base} ${styles} ${sizing} ${className}`} {...props} />;
}
