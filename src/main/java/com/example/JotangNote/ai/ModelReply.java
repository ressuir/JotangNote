package com.example.JotangNote.ai;

import java.util.List;

public record ModelReply(
        String content,
        List<ToolCall> toolCalls
) {
}