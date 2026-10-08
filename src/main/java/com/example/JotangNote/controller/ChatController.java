package com.example.JotangNote.controller;

import com.example.JotangNote.ai.ChatService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class ChatController {

    private final ChatService chatService;


    public ChatController(
            ChatService chatService) {

        this.chatService = chatService;
    }


    /*
     * 与 AI 聊天。
     */
    @PostMapping("/chat")
    public ResponseEntity<?> chat(
            @RequestBody ChatRequest request,
            HttpSession session) {

        Long userId =
                (Long) session.getAttribute(
                        "userId"
                );


        /*
         * 继续沿用之前的登录 Session。
         */
        if (userId == null) {

            return ResponseEntity
                    .status(401)
                    .body(
                            Map.of(
                                    "message",
                                    "please login first"
                            )
                    );
        }


        if (request.message() == null
                || request.message()
                .isBlank()) {

            return ResponseEntity
                    .badRequest()
                    .body(
                            Map.of(
                                    "message",
                                    "message cannot be empty"
                            )
                    );
        }


        /*
         * 当前实现中：
         *
         * 一个 HTTP Session
         * 对应一个 AI 会话。
         */
        String conversationId =
                userId
                        + ":"
                        + session.getId();


        try {

            String reply =
                    chatService.chat(
                            conversationId,
                            userId,
                            request.message()
                    );


            return ResponseEntity.ok(
                    new ChatResponse(
                            reply
                    )
            );

        } catch (Exception e) {

            e.printStackTrace();

            return ResponseEntity
                    .internalServerError()
                    .body(
                            Map.of(
                                    "message",
                                    e.getMessage()
                                            == null
                                            ? "chat failed"
                                            : e.getMessage()
                            )
                    );
        }
    }


    /*
     * 删除当前 AI 会话历史。
     *
     * 相当于网页里的：
     *
     * “新建对话”
     */
    @DeleteMapping("/chat")
    public ResponseEntity<?> clear(
            HttpSession session) {

        Long userId =
                (Long) session.getAttribute(
                        "userId"
                );


        if (userId == null) {

            return ResponseEntity
                    .status(401)
                    .body(
                            Map.of(
                                    "message",
                                    "please login first"
                            )
                    );
        }


        String conversationId =
                userId
                        + ":"
                        + session.getId();


        chatService.clear(
                conversationId
        );


        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "conversation cleared"
                )
        );
    }


    public record ChatRequest(
            String message
    ) {
    }


    public record ChatResponse(
            String reply
    ) {
    }
}