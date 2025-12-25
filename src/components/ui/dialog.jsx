import React from "react";

const DialogContext = React.createContext(null);

export function Dialog({ open, onOpenChange, children }) {
  const [internal, setInternal] = React.useState(false);
  const isOpen = open ?? internal;

  const setOpen = (v) => {
    onOpenChange?.(v);
    if (open === undefined) setInternal(v);
  };

  return <DialogContext.Provider value={{ open: isOpen, setOpen }}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ asChild, children }) {
  const ctx = React.useContext(DialogContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick: () => ctx?.setOpen(true) });
  }
  return (
    <button type="button" onClick={() => ctx?.setOpen(true)}>
      {children}
    </button>
  );
}

export function DialogContent({ className = "", children }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx?.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => ctx?.setOpen(false)} />
      <div className={`relative w-full max-w-lg rounded-2xl border bg-white p-4 shadow ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className = "", ...props }) {
  return <div className={`mb-3 ${className}`} {...props} />;
}
export function DialogTitle({ className = "", ...props }) {
  return <div className={`text-base font-semibold ${className}`} {...props} />;
}
export function DialogFooter({ className = "", ...props }) {
  return <div className={`mt-4 flex justify-end gap-2 ${className}`} {...props} />;
}
