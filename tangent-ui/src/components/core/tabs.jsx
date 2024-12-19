import React, {

} from "react";

import { cn } from "../../utils/utils";

// Keep your existing TabsContext and related components here
const TabsContext = React.createContext();


export const Tabs = ({
    children,
    value: valueProp,
    defaultValue,
    onValueChange,
    className = "",
}) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const value = valueProp !== undefined ? valueProp : internalValue;
    const setValue =
        onValueChange !== undefined ? onValueChange : setInternalValue;

    const contextValue = React.useMemo(
        () => ({ value, setValue }),
        [value, setValue]
    );

    return (
        <TabsContext.Provider value={contextValue}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
};

export const TabsList = ({ children, className = "" }) => (
    <div
        className={`inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ${className}`}
    >
        {children}
    </div>
);

export const TabsTrigger = ({ children, value, className = "" }) => {
    const { value: selectedValue, setValue } = React.useContext(TabsContext);
    const isActive = value === selectedValue;

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive ? "bg-background text-foreground shadow-sm" : "",
                className
            )}
            onClick={() => setValue(value)}
        >
            {children}
        </button>
    );
};

export const TabsContent = ({ children, value, className = "" }) => {
    const { value: selectedValue } = React.useContext(TabsContext);

    if (value !== selectedValue) {
        return null;
    }

    return (
        <div
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
        >
            {children}
        </div>
    );
};
