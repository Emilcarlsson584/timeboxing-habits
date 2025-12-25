import React from "react";

const TabsContext = React.createContext(null);

export function Tabs({ defaultValue, value, onValueChange, children }) {
  const [internal, setInternal] = React.useState(defaultValue);
  const current = value ?? internal;

  const setValue = (v) => {
    if (onValueChange) onValueChange(v);
    if (value === undefined) setInternal(v);
  };

  return <TabsContext.Provider value={{ value: current, setValue }}>{children}</TabsContext.Provider>;
}

export function TabsList({ className = "", ...props }) {
  return (
    <div
      className={`inline-flex w-full gap-2 rounded-2xl border bg-white/5 p-1 ${className}`}
      {...props}
    />
  );
}

export function TabsTrigger({ value, className = "", children, ...props }) {
  const ctx = React.useContext(TabsContext);
  const active = ctx?.value === value;

  return (
    <button
      type="button"
      onClick={() => ctx?.setValue(value)}
      className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${
        active ? "bg-black text-white" : "bg-transparent"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = "", children, ...props }) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div className={`${className}`} {...props}>
      {children}
    </div>
  );
}
