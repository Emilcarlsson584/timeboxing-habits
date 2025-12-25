import React from "react";

const SelectContext = React.createContext(null);

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className = "", children, ...props }) {
  const ctx = React.useContext(SelectContext);
  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(!ctx?.open)}
      className={`flex w-full items-center justify-between rounded-2xl border bg-transparent px-3 py-2 text-sm ${className}`}
      {...props}
    >
      {children}
      <span className="ml-2 opacity-60">▾</span>
    </button>
  );
}

export function SelectValue({ placeholder = "Välj...", ...props }) {
  const ctx = React.useContext(SelectContext);
  return <span {...props}>{ctx?.value ?? placeholder}</span>;
}

export function SelectContent({ className = "", children, ...props }) {
  const ctx = React.useContext(SelectContext);
  if (!ctx?.open) return null;
  return (
    <div
      className={`absolute z-50 mt-2 w-full rounded-2xl border bg-white p-1 text-sm shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, className = "", children, ...props }) {
  const ctx = React.useContext(SelectContext);
  return (
    <button
      type="button"
      onClick={() => {
        ctx?.onValueChange?.(value);
        ctx?.setOpen(false);
      }}
      className={`w-full rounded-xl px-3 py-2 text-left hover:bg-black/5 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
