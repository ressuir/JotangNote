package com.example.JotangNote.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.JotangNote.entity.Note;
import com.example.JotangNote.mapper.NoteMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/** All note reads must be scoped to the signed-in user, including AI tools. */
@Service
public class NoteAccessService {
    private final NoteMapper noteMapper;

    public NoteAccessService(NoteMapper noteMapper) {
        this.noteMapper = noteMapper;
    }

    public List<Note> listOwned(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User must be signed in");
        }
        return noteMapper.selectList(new LambdaQueryWrapper<Note>()
                .eq(Note::getAuthorId, userId)
                .orderByDesc(Note::getId));
    }

    public Note findOwned(Long noteId, Long userId) {
        if (noteId == null || userId == null) {
            return null;
        }
        Note note = noteMapper.selectById(noteId);
        return note != null && userId.equals(note.getAuthorId()) ? note : null;
    }
}
