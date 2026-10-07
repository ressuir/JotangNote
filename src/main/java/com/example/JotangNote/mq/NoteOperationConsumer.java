package com.example.JotangNote.mq;

import com.example.JotangNote.entity.Note;
import com.example.JotangNote.mapper.NoteMapper;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class NoteOperationConsumer {

    private final NoteMapper noteMapper;
    private final StringRedisTemplate redisTemplate;
    private final JsonMapper jsonMapper;

    public NoteOperationConsumer(
            NoteMapper noteMapper,
            StringRedisTemplate redisTemplate,
            JsonMapper jsonMapper) {
        this.noteMapper = noteMapper;
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
    }

    @RabbitListener(queues = RabbitConfig.NOTE_QUEUE)
    public void handle(String json) {

        NoteOperationMessage message =
                jsonMapper.readValue(json, NoteOperationMessage.class);

        System.out.println(
                "MQ received: " + message.type()
                        + " noteId=" + message.noteId()
        );

        switch (message.type()) {

            case "CREATE" -> {
                Note note = new Note();
                note.setTitle(message.title());
                note.setContent(message.content());
                note.setAuthorId(message.userId());

                noteMapper.insert(note);

                System.out.println(
                        "MQ created note id=" + note.getId()
                );
            }

            case "UPDATE" -> {
                Note note = noteMapper.selectById(message.noteId());

                if (note != null) {
                    note.setTitle(message.title());
                    note.setContent(message.content());
                    noteMapper.updateById(note);

                    redisTemplate.delete("note:" + message.noteId());
                }
            }

            case "DELETE" -> {
                noteMapper.deleteById(message.noteId());
                redisTemplate.delete("note:" + message.noteId());
            }
        }
    }
}
