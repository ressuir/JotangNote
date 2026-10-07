package com.example.JotangNote.mq;

public record NoteOperationMessage(
        String type,
        Long noteId,
        String title,
        String content,
        Long userId
) {
}
