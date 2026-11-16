package com.example.JotangNote.controller;

import com.example.JotangNote.ai.ChatService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
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

        } catch (HttpClientErrorException e) {
            String message = switch (e.getStatusCode().value()) {
                case 401, 403 -> "AI 服务鉴权失败，请检查服务器 DEEPSEEK_API_KEY 配置";
                case 402 -> "AI 服务余额不足，请检查服务账号";
                case 429 -> "AI 服务请求过于频繁，请稍后重试";
                default -> "AI 服务暂不可用，请检查服务器模型配置";
            };
            return ResponseEntity.status(503).body(Map.of("message", message));
        } catch (IllegalStateException e) {
            if ("DEEPSEEK_API_KEY is not configured".equals(e.getMessage())) {
                return ResponseEntity.status(503).body(Map.of(
                        "message", "AI 服务尚未配置，请设置服务器 DEEPSEEK_API_KEY 环境变量"));
            }
            return ResponseEntity.status(502).body(Map.of("message", "AI 服务响应异常，请稍后重试"));
        } catch (Exception e) {
            // Do not expose upstream responses, credentials or private note bodies.
            return ResponseEntity.status(502).body(Map.of("message", "AI 服务连接失败，请稍后重试"));
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