package com.example.JotangNote.ai;

public record ToolCall(
        String id,
        String name,
        String arguments
) {
}