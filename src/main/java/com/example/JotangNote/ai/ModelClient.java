package com.example.JotangNote.ai;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class ModelClient {

    private static final String BASE_URL =
            "https://api.deepseek.com";

    private static final String MODEL =
            "deepseek-flash";

    private final JsonMapper jsonMapper;


    public ModelClient(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }


    public ModelReply chat(
            List<ChatMessage> messages,
            List<Map<String, Object>> tools) {

        String apiKey =
                System.getenv("DEEPSEEK_API_KEY");

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "DEEPSEEK_API_KEY is not configured"
            );
        }


        /*
         * 把我们自己定义的 ChatMessage
         * 转换成 DeepSeek API 需要的 JSON 结构。
         */
        List<Map<String, Object>> apiMessages =
                new ArrayList<>();

        for (ChatMessage message : messages) {
            apiMessages.add(
                    toApiMessage(message)
            );
        }


        /*
         * 构造整个请求体。
         */
        Map<String, Object> request =
                new LinkedHashMap<>();

        request.put(
                "model",
                MODEL
        );

        request.put(
                "messages",
                apiMessages
        );

        request.put(
                "tools",
                tools
        );

        /*
         * 让模型自行决定：
         *
         * 是直接回答
         * 还是调用 get_note
         */
        request.put(
                "tool_choice",
                "auto"
        );


        /*
         * 关闭 thinking。
         *
         * 这样我们不需要另外维护
         * reasoning_content。
         */
        request.put(
                "thinking",
                Map.of(
                        "type",
                        "disabled"
                )
        );


        RestClient client =
                RestClient.builder()
                        .baseUrl(BASE_URL)
                        .defaultHeader(
                                "Authorization",
                                "Bearer " + apiKey
                        )
                        .build();


        String responseJson =
                client.post()
                        .uri("/chat/completions")
                        .contentType(
                                MediaType.APPLICATION_JSON
                        )
                        .body(request)
                        .retrieve()
                        .body(String.class);


        if (responseJson == null
                || responseJson.isBlank()) {

            throw new IllegalStateException(
                    "DeepSeek returned empty response"
            );
        }


        return parseResponse(responseJson);
    }


    /*
     * 把我们的 ChatMessage
     * 转成 DeepSeek messages 中的一项。
     */
    private Map<String, Object> toApiMessage(
            ChatMessage message) {

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put(
                "role",
                message.role()
        );


        switch (message.role()) {

            case "system", "user" -> {

                result.put(
                        "content",
                        message.content()
                );
            }


            case "assistant" -> {

                /*
                 * 普通 assistant 回复。
                 */
                if (message.toolCalls() == null
                        || message.toolCalls().isEmpty()) {

                    result.put(
                            "content",
                            message.content()
                    );
                }

                /*
                 * assistant 请求调用 Tool。
                 */
                else {

                    result.put(
                            "content",
                            message.content()
                    );

                    List<Map<String, Object>>
                            apiToolCalls =
                            new ArrayList<>();

                    for (ToolCall toolCall :
                            message.toolCalls()) {

                        Map<String, Object>
                                function =
                                new LinkedHashMap<>();

                        function.put(
                                "name",
                                toolCall.name()
                        );

                        function.put(
                                "arguments",
                                toolCall.arguments()
                        );


                        Map<String, Object>
                                call =
                                new LinkedHashMap<>();

                        call.put(
                                "id",
                                toolCall.id()
                        );

                        call.put(
                                "type",
                                "function"
                        );

                        call.put(
                                "function",
                                function
                        );


                        apiToolCalls.add(call);
                    }


                    result.put(
                            "tool_calls",
                            apiToolCalls
                    );
                }
            }


            case "tool" -> {

                result.put(
                        "tool_call_id",
                        message.toolCallId()
                );

                result.put(
                        "content",
                        message.content()
                );
            }


            default ->
                    throw new IllegalArgumentException(
                            "Unknown message role: "
                                    + message.role()
                    );
        }


        return result;
    }


    /*
     * 解析 DeepSeek 返回的 JSON。
     */
    @SuppressWarnings("unchecked")
    private ModelReply parseResponse(
            String responseJson) {

        try {

            Map<String, Object> root =
                    jsonMapper.readValue(
                            responseJson,
                            Map.class
                    );


            Object choicesObject =
                    root.get("choices");

            if (!(choicesObject instanceof List<?> choices)
                    || choices.isEmpty()) {

                throw new IllegalStateException(
                        "DeepSeek response has no choices"
                );
            }


            Map<String, Object> choice =
                    (Map<String, Object>)
                            choices.get(0);


            Map<String, Object> message =
                    (Map<String, Object>)
                            choice.get("message");


            if (message == null) {

                throw new IllegalStateException(
                        "DeepSeek response has no message"
                );
            }


            String content =
                    message.get("content") == null
                            ? null
                            : message.get("content")
                            .toString();


            List<ToolCall> resultToolCalls =
                    new ArrayList<>();


            Object toolCallsObject =
                    message.get("tool_calls");


            if (toolCallsObject
                    instanceof List<?> toolCalls) {

                for (Object object : toolCalls) {

                    Map<String, Object>
                            toolCallMap =
                            (Map<String, Object>) object;


                    String id =
                            String.valueOf(
                                    toolCallMap.get("id")
                            );


                    Map<String, Object>
                            function =
                            (Map<String, Object>)
                                    toolCallMap.get(
                                            "function"
                                    );


                    if (function == null) {
                        continue;
                    }


                    String name =
                            String.valueOf(
                                    function.get("name")
                            );


                    String arguments =
                            String.valueOf(
                                    function.get(
                                            "arguments"
                                    )
                            );


                    resultToolCalls.add(
                            new ToolCall(
                                    id,
                                    name,
                                    arguments
                            )
                    );
                }
            }


            return new ModelReply(
                    content,
                    resultToolCalls
            );


        } catch (Exception e) {

            throw new IllegalStateException(
                    "Failed to parse DeepSeek response",
                    e
            );
        }
    }
}