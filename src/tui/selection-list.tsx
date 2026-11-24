import { useState } from "react";
import { Box, Text, useInput } from "ink";

export type SelectionItem = {
    id: string;
    label: string;
    detail?: string;
};

type SelectionListProps = {
    title: string;
    items: readonly SelectionItem[];
    currentID: string;
    emptyText: string;
    closing: boolean;
    error?: string;
    onSelect: (id: string) => boolean;
    onClose: () => void;
    onExit: () => void;
};

export function SelectionList({
    title,
    items,
    currentID,
    emptyText,
    closing,
    error,
    onSelect,
    onClose,
    onExit,
}: SelectionListProps) {
    const [cursor, setCursor] = useState(() =>
        Math.max(0, items.findIndex((item) => item.id === currentID)),
    );

    useInput((value, key) => {
        if (key.ctrl && value === "c") {
            onExit();
        } else if (key.escape) {
            onClose();
        } else if (items.length > 0) {
            if (key.upArrow) {
                setCursor((index) => Math.max(0, index - 1));
            } else if (key.downArrow) {
                setCursor((index) => Math.min(items.length - 1, index + 1));
            } else if (key.return && onSelect(items[cursor].id)) {
                onClose();
            }
        }
    }, { isActive: !closing });

    const pageSize = 8;
    const start = Math.floor(cursor / pageSize) * pageSize;

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold color="cyan">{title}</Text>
            {items.length === 0 && <Text dimColor>{emptyText}</Text>}
            {items.slice(start, start + pageSize).map((item, offset) => {
                const selected = start + offset === cursor;
                return (
                    <Text key={item.id} color={selected ? "cyan" : undefined}>
                        {selected ? "❯ " : "  "}
                        {item.label}
                        {item.id === currentID && "（当前）"}
                        <Text dimColor>  {item.detail ?? item.id}</Text>
                    </Text>
                );
            })}
            {error && <Text color="red">{error}</Text>}
            <Text dimColor>↑ ↓ 选择 · Enter 确认 · Esc 返回 · Ctrl+C 退出</Text>
        </Box>
    );
}
