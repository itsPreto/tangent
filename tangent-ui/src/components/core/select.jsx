import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from 'lucide-react';
import { cn } from "../../utils/utils";
const SelectContext = React.createContext();

export const Select = ({ children, value, onValueChange, disabled = false }) => {
    const [open, setOpen] = useState(false);
    const selectRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handleChange = (newValue) => {
        onValueChange?.(newValue);
        setOpen(false);
    };

    return (
        <SelectContext.Provider value={{ value, onValueChange: handleChange, open, setOpen, disabled }}>
            <div ref={selectRef} className="relative">
                {React.Children.map(children, (child) => {
                    if (!React.isValidElement(child)) return child;

                    if (child.type.displayName === 'SelectTrigger') {
                        return React.cloneElement(child, {
                            open,
                            setOpen,
                            disabled,
                        });
                    }

                    if (child.type.displayName === 'SelectContent') {
                        return React.cloneElement(child, {
                            open,
                            children: React.Children.map(child.props.children, (childItem) => {
                                if (!React.isValidElement(childItem)) return childItem;

                                if (childItem.type.displayName === 'SelectItem') {
                                    return React.cloneElement(childItem, {
                                        onChange: handleChange,
                                        currentValue: value,
                                    });
                                }

                                return childItem;
                            }),
                        });
                    }

                    return child;
                })}
            </div>
        </SelectContext.Provider>
    );
};

export const SelectTrigger = ({ children, className = '', 'aria-label': ariaLabel }) => {
    const { open, setOpen, disabled } = React.useContext(SelectContext);
    return (
        <button
            type="button"
            onClick={() => !disabled && setOpen(!open)}
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "hover:bg-accent/50",
                className
            )}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={ariaLabel}
        >
            {children}
            <ChevronDown className={cn(
                "ml-2 h-4 w-4 opacity-50 transition-transform duration-200",
                open && "rotate-180"
            )} />
        </button>
    );
}

export const SelectContent = ({
    children,
    open,
    className = ''
}) => {
    if (!open) return null;

    return (
        <div
            className={cn(
                "absolute z-50 min-w-[8rem] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
                "animate-in fade-in-0 zoom-in-95",
                "mt-1",
                className
            )}
            role="listbox"
        >
            <div className="max-h-[200px] overflow-auto p-1 scrollbar-thin scrollbar-thumb-accent">
                {children}
            </div>
        </div>
    );
};

export const SelectItem = ({ children, value, className = '', disabled = false, onChange }) => {
    const { onValueChange, value: currentValue } = React.useContext(SelectContext);
    return (
        <button
            type="button"
            onClick={() => !disabled && onValueChange?.(value)}
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                currentValue === value && "bg-accent text-accent-foreground",
                className
            )}
            role="option"
            aria-selected={currentValue === value}
            data-disabled={disabled}
        >
            {children}
        </button>
    );
}

export const SelectValue = ({
    children,
    value,
    placeholder,
    className = ''
}) => {
    if (!children && !value) {
        return (
            <span className={cn("text-muted-foreground", className)}>
                {placeholder}
            </span>
        );
    }

    return (
        <span className={cn("text-sm", className)}>
            {children || value}
        </span>
    );
};

Select.displayName = 'Select';
SelectTrigger.displayName = 'SelectTrigger';
SelectContent.displayName = 'SelectContent';
SelectItem.displayName = 'SelectItem';
SelectValue.displayName = 'SelectValue';
