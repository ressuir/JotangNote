package com.example.JotangNote.controller;

import com.example.JotangNote.entity.Note;
import com.example.JotangNote.mapper.NoteMapper;
import com.example.JotangNote.mq.NoteOperationMessage;
import com.example.JotangNote.mq.RabbitConfig;
import com.example.JotangNote.service.NoteAccessService;
import jakarta.servlet.http.HttpSession;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteMapper noteMapper;
    private final NoteAccessService noteAccessService;
    private final StringRedisTemplate redisTemplate;
    private final JsonMapper jsonMapper;
    private final RabbitTemplate rabbitTemplate;

    public NoteController(
            NoteMapper noteMapper,
            NoteAccessService noteAccessService,
            StringRedisTemplate redisTemplate,
            JsonMapper jsonMapper,
            RabbitTemplate rabbitTemplate) {

        this.noteMapper = noteMapper;
        this.noteAccessService = noteAccessService;
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
        this.rabbitTemplate = rabbitTemplate;
    }

    @GetMapping
    public ResponseEntity<?> list(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "please login first"));
        }
        return ResponseEntity.ok(noteAccessService.listOwned(userId));
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Note note,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "please login first"));
        }

        if (!validNote(note)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "title or content is invalid"));
        }

        NoteOperationMessage message =
                new NoteOperationMessage(
                        "CREATE",
                        null,
                        note.getTitle(),
                        note.getContent(),
                        userId
                );

        rabbitTemplate.convertAndSend(
                RabbitConfig.NOTE_QUEUE,
                jsonMapper.writeValueAsString(message)
        );

        return ResponseEntity.accepted()
                .body(Map.of("message", "create operation queued"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "please login first"));
        }

        // Scope cache entries by identity. Never consult the former global "note:{id}" key.
        String key = "note:" + userId + ":" + id;
        // Cache failure must not bypass authorization or make a readable note unavailable.
        try {
            String cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                Note cachedNote = jsonMapper.readValue(cached, Note.class);
                if (userId.equals(cachedNote.getAuthorId())) {
                    return ResponseEntity.ok(cachedNote);
                }
                redisTemplate.delete(key);
            }
        } catch (Exception cacheFailure) {
            System.err.println("Redis read failed, falling back to MySQL: "
                    + cacheFailure.getClass().getSimpleName());
        }

        Note note = noteAccessService.findOwned(id, userId);
        if (note == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            redisTemplate.opsForValue().set(
                    key, jsonMapper.writeValueAsString(note), Duration.ofMinutes(10));
        } catch (Exception cacheFailure) {
            System.err.println("Redis write failed: "
                    + cacheFailure.getClass().getSimpleName());
        }
        return ResponseEntity.ok(note);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestBody Note newNote,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "please login first"));
        }

        if (!validNote(newNote)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "title or content is invalid"));
        }

        Note oldNote = noteAccessService.findOwned(id, userId);
        if (oldNote == null) {
            return ResponseEntity.notFound().build();
        }

        NoteOperationMessage message =
                new NoteOperationMessage(
                        "UPDATE",
                        id,
                        newNote.getTitle(),
                        newNote.getContent(),
                        userId
                );

        rabbitTemplate.convertAndSend(
                RabbitConfig.NOTE_QUEUE,
                jsonMapper.writeValueAsString(message)
        );

        return ResponseEntity.accepted()
                .body(Map.of("message", "update operation queued"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "please login first"));
        }

        Note note = noteAccessService.findOwned(id, userId);
        if (note == null) {
            return ResponseEntity.notFound().build();
        }

        NoteOperationMessage message =
                new NoteOperationMessage(
                        "DELETE",
                        id,
                        null,
                        null,
                        userId
                );

        rabbitTemplate.convertAndSend(
                RabbitConfig.NOTE_QUEUE,
                jsonMapper.writeValueAsString(message)
        );

        return ResponseEntity.accepted()
                .body(Map.of("message", "delete operation queued"));
    }
    private static boolean validNote(Note note) {
        return note != null && note.getTitle() != null
                && !note.getTitle().isBlank() && note.getTitle().length() <= 200
                && note.getContent() != null && note.getContent().length() <= 100_000;
    }
}

