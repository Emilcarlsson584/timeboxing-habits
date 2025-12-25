import React from "react";

export function Separator({ className = "", ...props }) {
  return <div className={`h-px w-full bg-black/10 ${className}`} {...props} />;
}
