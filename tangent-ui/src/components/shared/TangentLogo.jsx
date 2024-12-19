import { useEffect, useState, useRef } from 'react';
import { cn } from '../../utils/utils';

export function TangentLogo() {
    const [isShowingFront, setIsShowingFront] = useState(true);
    const gridRef = useRef(null);

    const COLS = 15;
    const ROWS = 5;
    const cells = Array.from({ length: ROWS * COLS });

    const logoSVG = (
        <svg viewBox="0 0 200 45" className="absolute inset-0">
            {/* Dynamic wave patterns */}
            <path
                d="M 20 22.5 C 40 22.5, 45 12, 65 12 S 90 33, 110 33 S 135 12, 155 12 S 180 22.5, 200 22.5"
                fill="none"
                className="stroke-foreground dark:stroke-foreground"
                strokeWidth="1"
            />

            {/* Fractal-like pattern */}
            <path
                d="M 100 22.5 C 105 22.5, 110 18, 120 18 S 135 27, 145 27 S 155 18, 165 18"
                fill="none"
                className="stroke-cyan-500 dark:stroke-cyan-400"
                strokeWidth="1"
            />
            <path
                d="M 100 22.5 C 95 22.5, 90 27, 80 27 S 65 18, 55 18 S 45 27, 35 27"
                fill="none"
                className="stroke-rose-500 dark:stroke-rose-400"
                strokeWidth="1"
            />

            {/* Geometric accents */}
            {[...Array(8)].map((_, i) => (
                <path
                    key={i}
                    d={`M ${100 + i * 10} 22.5 L ${105 + i * 10} 15 L ${110 + i * 10
                        } 22.5`}
                    fill="none"
                    className="stroke-emerald-500/30 dark:stroke-emerald-400/30"
                    strokeWidth="0.5"
                />
            ))}
            {[...Array(8)].map((_, i) => (
                <path
                    key={i}
                    d={`M ${100 - i * 10} 22.5 L ${95 - i * 10} 30 L ${90 - i * 10
                        } 22.5`}
                    fill="none"
                    className="stroke-purple-500/30 dark:stroke-purple-400/30"
                    strokeWidth="0.5"
                />
            ))}

            {/* Dynamic circles */}
            {[...Array(5)].map((_, i) => (
                <circle
                    key={i}
                    cx={100 + i * 20}
                    cy={22.5 + Math.sin(i * 1.5) * 5}
                    r={1.2 - i * 0.15}
                    className="fill-cyan-500 dark:fill-cyan-400"
                />
            ))}
            {[...Array(5)].map((_, i) => (
                <circle
                    key={i}
                    cx={100 - i * 20}
                    cy={22.5 + Math.cos(i * 1.5) * 5}
                    r={1.2 - i * 0.15}
                    className="fill-rose-500 dark:fill-rose-400"
                />
            ))}

            {/* Central focal point */}
            <path
                d="M 95 22.5 L 105 22.5 M 100 17.5 L 100 27.5"
                className="stroke-foreground dark:stroke-foreground"
                strokeWidth="1.5"
            />
            <circle
                cx="100"
                cy="22.5"
                r="2.5"
                className="fill-foreground dark:fill-foreground"
            />

            {/* Abstract mathematical symbols */}
            <path
                d="M 160 15 A 5 5 0 0 1 170 15 A 5 5 0 0 1 160 15"
                fill="none"
                className="stroke-emerald-500/50 dark:stroke-emerald-400/50"
                strokeWidth="0.75"
            />
            <path
                d="M 30 30 A 5 5 0 0 0 40 30 A 5 5 0 0 0 30 30"
                fill="none"
                className="stroke-purple-500/50 dark:stroke-purple-400/50"
                strokeWidth="0.75"
            />
        </svg>
    );

    // Updated flipCell function
    const flipCell = (cell, delay) => {
        setTimeout(() => {
            if (cell) {
                cell.style.transform = isShowingFront ? 'rotateY(180deg)' : 'rotateY(0deg)';
            }
        }, delay);
    };

    const animateFlip = () => {
        if (!gridRef.current) return;
        const cells = Array.from(gridRef.current.querySelectorAll('.cell'));

        // Organize cells into columns
        const columns = Array.from({ length: COLS }, () => []);

        cells.forEach((cell, index) => {
            const col = index % COLS;
            columns[col].push(cell);
        });

        const delayBetweenColumns = 50; // Adjust the delay as needed

        // Generate the column order
        const middle = Math.floor(COLS / 2);
        let columnOrder = [middle];
        for (let offset = 1; offset <= middle; offset++) {
            if (middle - offset >= 0) columnOrder.push(middle - offset);
            if (middle + offset < COLS) columnOrder.push(middle + offset);
        }

        // If flipping back, reverse the order
        if (!isShowingFront) {
            columnOrder = columnOrder.reverse();
        }

        columnOrder.forEach((colIndex, index) => {
            setTimeout(() => {
                columns[colIndex].forEach((cell) => {
                    flipCell(cell, 0); // No additional delay within the column
                });
            }, index * delayBetweenColumns);
        });

        // Update the state after all flips are done
        setTimeout(() => {
            setIsShowingFront(!isShowingFront);
        }, columnOrder.length * delayBetweenColumns + 500); // +500ms to ensure all animations complete
    };

    useEffect(() => {
        const interval = setInterval(animateFlip, 5000);
        return () => clearInterval(interval);
    }, [isShowingFront]);

    return (
        <div
            className={cn(
                "w-[180px] h-[36px] relative perspective-[1000px] rounded-lg overflow-hidden",
                // Removed bg-card classes to make background transparent
            )}
        >
            <div
                ref={gridRef}
                className={cn(
                    "w-full h-full grid grid-cols-[repeat(15,1fr)] grid-rows-[repeat(5,1fr)]",
                    "relative gap-0"
                )}
            >
                {cells.map((_, i) => {
                    const x = (i % COLS) * (180 / COLS);
                    const y = Math.floor(i / COLS) * (36 / ROWS);

                    return (
                        <div
                            key={i}
                            className="relative [transform-style:preserve-3d] transition-transform duration-1000 ease-in-out cell"
                            style={{
                                border: 'none',
                                backgroundColor: 'transparent',
                            }}
                        >
                            <div
                                className={cn(
                                    "absolute w-full h-full [backface-visibility:hidden] overflow-hidden front"
                                )}
                                style={{
                                    backgroundColor: 'transparent',
                                }}
                            >
                                <div
                                    className="w-[180px] h-[36px] relative"
                                    style={{
                                        transform: `translate(${-x}px, ${-y}px)`,
                                    }}
                                >
                                    {logoSVG}
                                </div>
                            </div>
                            <div
                                className={cn(
                                    "absolute w-full h-full [backface-visibility:hidden] overflow-hidden [transform:rotateY(180deg)] back"
                                )}
                                style={{
                                    backgroundColor: 'transparent',
                                }}
                            >
                                <div
                                    className="absolute w-[180px] h-[36px]"
                                    style={{
                                        transform: `translate(${-x}px, ${-y}px)`,
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "font-sans text-[24px] font-bold w-full h-full ps-4 flex items-center justify-center",
                                            "text-foreground dark:text-foreground"
                                            // Removed bg-clear class
                                        )}
                                    >
                                        TANGENT
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default TangentLogo;
