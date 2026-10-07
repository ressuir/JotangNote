package com.example.JotangNote.mq;

import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String NOTE_QUEUE = "note.operations";

    @Bean
    public Queue noteQueue() {
        return new Queue(NOTE_QUEUE, true);
    }
}
