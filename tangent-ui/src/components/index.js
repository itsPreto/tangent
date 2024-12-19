import React from 'react';

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "../utils/utils";

// 1. Updated Slider Component
const Slider = React.forwardRef(({ className, min = 0, max = 100, step = 1, value = [0], onValueChange, ...props }, ref) => {
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={onValueChange}
      {...props}
    >
      {/* Replaced hardcoded bg-secondary with theme variable */}
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
        {/* Replaced hardcoded bg-primary with theme variable */}
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          // Replaced bg-background with theme variable and border-primary with opacity for better contrast
          "block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          "hover:bg-accent hover:border-primary"
        )}
      />
    </SliderPrimitive.Root>
  );
});

Slider.displayName = "Slider";

export { Slider };

// 2. Updated Card Components
export const Card = ({ children, className = '' }) => (
  // Replaced hardcoded bg-white and dark:bg-gray-800 with bg-card and text-card-foreground for theme adaptability
  <div className={`rounded-lg border bg-card text-card-foreground shadow ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '' }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);

export const CardDescription = ({ children, className = '' }) => (
  // Ensures text color adapts based on theme
  <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>
);

// 3. Updated Button Component

export const Button = React.forwardRef(({
  children,
  variant = 'default',
  size = 'default',
  className = '',
  asChild = false,
  ...props
}, ref) => {
  const Comp = asChild ? 'div' : 'button';
  
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline'
  };

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3 text-sm',
    lg: 'h-11 rounded-md px-8 text-lg',
    icon: 'h-10 w-10 p-0'
  };

  return (
    <Comp
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-md text-sm font-medium 
        transition-colors focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-ring focus-visible:ring-offset-2 
        disabled:pointer-events-none disabled:opacity-50 
        ${variants[variant]} 
        ${sizes[size]} 
        ${className}
      `}
      {...props}
    >
      {children}
    </Comp>
  );
});

// 4. Updated ScrollArea Component
export const ScrollArea = ({ children, className = '' }) => (
  <div className={`overflow-auto ${className}`}>{children}</div>
);

// 5. Updated Badge Component
export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-input',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};

// 6. Updated Input Component
export const Input = React.forwardRef(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    // Replaced hardcoded colors with theme variables
    className={`block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
));

// 7. Updated Progress Component
export const Progress = ({ value = 0, className = '' }) => (
  <div className={`relative h-4 w-full overflow-hidden rounded-full bg-secondary ${className}`}>
    {/* Replaced hardcoded bg-primary with theme variable */}
    <div
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
);

// 8. Updated Separator Component
export const Separator = ({ className = '', ...props }) => (
  <div
    className={`my-4 h-px w-full bg-muted ${className}`}
    {...props}
  />
);


const Textarea = React.forwardRef(
  ({ className = '', disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        className={cn(
          'flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };

// 9. Updated Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    // Replaced hardcoded colors with theme variables
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

// 10. Updated Command Components
export const Command = ({ children, className = '' }) => (
  <div className={`flex items-center border rounded-md ${className}`}>
    {children}
  </div>
);

export const CommandInput = ({ className = '', ...props }) => (
  <input
    className={cn(
      'flex h-10 w-full rounded-md bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
);

// 11. Updated DropdownMenu Components
export const DropdownMenu = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  return React.Children.map(children, child =>
    React.cloneElement(child, { open, setOpen })
  );
};

export const DropdownMenuTrigger = ({ children, open, setOpen, asChild }) => {
  const Comp = asChild ? 'div' : 'button';
  return (
    <Comp onClick={() => setOpen(!open)}>
      {children}
    </Comp>
  );
};

export const DropdownMenuContent = ({ children, open, className = '', align = 'start', side = 'bottom' }) => {
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;

    const triggerElement = contentRef.current?.previousElementSibling;
    if (!triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();

    let left = triggerRect.left;
    if (align === 'end') {
      left = triggerRect.right - (contentRef.current?.offsetWidth || 0);
    }

    let top = triggerRect.bottom + 4;
    if (side === 'top') {
      top = triggerRect.top - (contentRef.current?.offsetHeight || 0) - 4;
    }

    setPosition({ top, left });
  }, [open, align, side]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
      }}
      // Replaced hardcoded bg-popover with theme variable
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        className
      )}
    >
      {/* Added max-height and overflow-auto */}
      <div className="max-w-[200px] max-h-[200px] overflow-auto py-1">
        {children}
      </div>
    </div>
  );
};

// Update DropdownMenuItem to handle active state and hover styles better
export const DropdownMenuItem = ({ children, className = '', active = false }) => (
  <button
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      // Replaced hardcoded hover and focus colors with theme variables
      'hover:bg-accent hover:text-accent-foreground',
      'focus:bg-accent focus:text-accent-foreground',
      active && 'bg-accent text-accent-foreground',
      className
    )}
  >
    {children}
  </button>
);

// 12. Updated Dialog Components
export const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Replaced hardcoded bg-black/50 with theme variable bg-background/50 for overlay */}
      <div
        className="absolute inset-0 bg-background/50"
        onClick={() => onOpenChange(false)}
      ></div>
      {children}
    </div>
  );
};

export const DialogContent = ({ children, className = '' }) => (
  <div
    // Replaced hardcoded bg-white and dark:bg-gray-800 with bg-card and text-card-foreground
    className={`relative z-50 w-full max-w-md rounded-lg bg-card text-card-foreground p-6 shadow-lg ${className}`}
  >
    {children}
  </div>
);

export const DialogHeader = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>{children}</div>
);

export const DialogTitle = ({ children, className = '' }) => (
  <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>
);

export const DialogDescription = ({ children, className = '' }) => (
  <div className={`text-sm text-muted-foreground ${className}`}>{children}</div>
);

export const DialogFooter = ({ children, className = '' }) => (
  <div className={`mt-4 flex justify-end space-x-2 ${className}`}>{children}</div>
);

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

// Switch Component
const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Label, Switch };