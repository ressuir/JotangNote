package com.example.JotangNote.service;

import com.example.JotangNote.entity.Note;
import com.example.JotangNote.mapper.NoteMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NoteAccessServiceTest {
    private final NoteMapper mapper = mock(NoteMapper.class);
    private final NoteAccessService access = new NoteAccessService(mapper);

    @Test
    void ownerCanReadTheirNote() {
        Note note = new Note();
        note.setId(42L);
        note.setAuthorId(1L);
        when(mapper.selectById(42L)).thenReturn(note);

        assertSame(note, access.findOwned(42L, 1L));
    }

    @Test
    void anotherUserCannotReadTheirNote() {
        Note note = new Note();
        note.setId(42L);
        note.setAuthorId(1L);
        when(mapper.selectById(42L)).thenReturn(note);

        assertNull(access.findOwned(42L, 2L));
    }

    @Test
    void missingOrAnonymousNoteCannotBeRead() {
        assertNull(access.findOwned(42L, null));
        assertNull(access.findOwned(null, 1L));
        assertNull(access.findOwned(99L, 1L));
        verify(mapper, never()).selectById(42L);
        verify(mapper).selectById(99L);
    }
}
