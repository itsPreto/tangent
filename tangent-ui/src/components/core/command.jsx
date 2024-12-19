import * as React from "react";
import { cn } from "../../utils/utils";
const Command = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
));
Command.displayName = "Command";

const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3">
    <input
      ref={ref}
      type="search"
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none",
        "placeholder:text-muted-foreground disabled:cursor-not-allowed",
        "disabled:opacity-50 focus:ring-0",
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef(({ children, ...props }, ref) => (
  <div
    ref={ref}
    className="py-6 text-center text-sm text-muted-foreground"
    {...props}
  >
    {children}
  </div>
));
CommandEmpty.displayName = "CommandEmpty";

export { Command, CommandInput, CommandList, CommandEmpty };