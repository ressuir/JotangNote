package com.example.JotangNote.controller;

import com.example.JotangNote.entity.Note;
import com.example.JotangNote.mapper.NoteMapper;
import com.example.JotangNote.mq.NoteOperationMessage;
import com.example.JotangNote.mq.RabbitConfig;
import jakarta.servlet.http.HttpSession;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteMapper noteMapper;
    private final StringRedisTemplate redisTemplate;
    private final JsonMapper jsonMapper;
    private final RabbitTemplate rabbitTemplate;

    public NoteController(
            NoteMapper noteMapper,
            StringRedisTemplate redisTemplate,
            JsonMapper jsonMapper,
            RabbitTemplate rabbitTemplate) {

        this.noteMapper = noteMapper;
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
        this.rabbitTemplate = rabbitTemplate;
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
    public ResponseEntity<Note> get(@PathVariable Long id) {

        String key = "note:" + id;

        String cached =
                redisTemplate.opsForValue().get(key);

        if (cached != null) {
            System.out.println("Redis hit: " + key);

            return ResponseEntity.ok(
                    jsonMapper.readValue(cached, Note.class)
            );
        }

        System.out.println("Redis miss: " + key);

        Note note = noteMapper.selectById(id);

        if (note == null) {
            return ResponseEntity.notFound().build();
        }

        redisTemplate.opsForValue().set(
                key,
                jsonMapper.writeValueAsString(note),
                Duration.ofMinutes(10)
        );

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

        Note oldNote = noteMapper.selectById(id);

        if (oldNote == null) {
            return ResponseEntity.notFound().build();
        }

        if (!oldNote.getAuthorId().equals(userId)) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "this note is not yours"));
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

        Note note = noteMapper.selectById(id);

        if (note == null) {
            return ResponseEntity.notFound().build();
        }

        if (!note.getAuthorId().equals(userId)) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "this note is not yours"));
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
}
