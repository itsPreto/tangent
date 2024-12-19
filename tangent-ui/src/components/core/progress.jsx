
// Progress.jsx
import * as React from "react"
import { cn } from "../lib/utils"

const Progress = React.forwardRef(({ 
  className,
  value,
  max = 100,
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuemin={0}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
        }}
      />
    </div>
  )
})
Progress.displayName = "Progress"