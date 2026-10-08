package com.example.JotangNote.ai;

import com.example.JotangNote.entity.Note;
import com.example.JotangNote.service.NoteAccessService;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatService {

    /*
     * 防止模型不断调用 Tool，
     * 导致死循环。
     */
    private static final int MAX_TOOL_ROUNDS = 5;


    private final ModelClient modelClient;
    private final NoteAccessService noteAccessService;
    private final JsonMapper jsonMapper;


    /*
     * conversationId
     *     ↓
     * 当前会话的所有历史消息
     */
    private final Map<
            String,
            List<ChatMessage>
            > conversations =
            new ConcurrentHashMap<>();


    public ChatService(
            ModelClient modelClient,
            NoteAccessService noteAccessService,
            JsonMapper jsonMapper) {

        this.modelClient = modelClient;
        this.noteAccessService = noteAccessService;
        this.jsonMapper = jsonMapper;
    }


    public String chat(
            String conversationId,
            Long userId,
            String userMessage) {

        /*
         * 第一次聊天：
         * 创建历史。
         *
         * 后续聊天：
         * 取出之前的历史。
         */
        List<ChatMessage> history =
                conversations.computeIfAbsent(
                        conversationId,
                        id -> newConversation()
                );


        /*
         * 避免同一个会话同时有两个请求
         * 修改同一个 List。
         */
        synchronized (history) {

            /*
             * 保存用户本轮输入。
             */
            history.add(
                    ChatMessage.user(
                            userMessage
                    )
            );


            /*
             * 一轮用户请求中，
             * 模型可能调用多次 Tool。
             */
            for (
                    int round = 0;
                    round < MAX_TOOL_ROUNDS;
                    round++
            ) {

                ModelReply reply =
                        modelClient.chat(
                                List.copyOf(history),
                                tools()
                        );


                List<ToolCall> toolCalls =
                        reply.toolCalls() == null
                                ? List.of()
                                : reply.toolCalls();


                /*
                 * 没有 Tool Call。
                 *
                 * 说明模型已经给出最终回答。
                 */
                if (toolCalls.isEmpty()) {

                    String content =
                            reply.content() == null
                                    ? ""
                                    : reply.content();


                    history.add(
                            ChatMessage.assistant(
                                    content
                            )
                    );


                    return content;
                }


                /*
                 * 模型这次没有直接回答，
                 * 而是要求调用一个或多个 Tool。
                 *
                 * 这条 assistant 消息也必须
                 * 保存进上下文。
                 */
                history.add(
                        ChatMessage
                                .assistantToolCalls(
                                        reply.content(),
                                        toolCalls
                                )
                );


                /*
                 * Java 真正执行 Tool。
                 */
                for (ToolCall toolCall :
                        toolCalls) {

                    System.out.println(
                            "AI requested tool: "
                                    + toolCall.name()
                                    + " arguments="
                                    + toolCall.arguments()
                    );


                    String result =
                            executeTool(
                                    toolCall,
                                    userId
                            );


                    // Note bodies may be private; never log tool results.


                    /*
                     * Tool 返回的数据也进入历史。
                     */
                    history.add(
                            ChatMessage.tool(
                                    toolCall.id(),
                                    result
                            )
                    );
                }


                /*
                 * for 循环继续。
                 *
                 * 下一次调用 DeepSeek 时，
                 * 它就会同时看到：
                 *
                 * assistant 的 tool_calls
                 * +
                 * Java 的 tool result
                 *
                 * 然后生成最终回答。
                 */
            }


            throw new IllegalStateException(
                    "Too many tool calls"
            );
        }
    }


    /*
     * 第一次创建会话时加入 system 消息。
     */
    private List<ChatMessage>
    newConversation() {

        List<ChatMessage> history =
                new ArrayList<>();


        history.add(
                ChatMessage.system(
                        """
                        你是 JotangNote 的 AI 助手。

                        当用户的问题需要知道某篇笔记的真实内容时，
                        请使用 get_note 工具查询笔记。

                        不要自己编造不存在的笔记内容。

                        如果用户要求总结、分析、解释某篇指定 ID 的笔记，
                        应先调用 get_note 获取真实内容。
                        """
                )
        );


        return history;
    }


    /*
     * 告诉 DeepSeek：
     *
     * 目前 JotangNote 给它开放了什么 Tool。
     */
    private List<Map<String, Object>>
    tools() {

        /*
         * noteId 参数定义。
         */
        Map<String, Object> noteId =
                new LinkedHashMap<>();

        noteId.put(
                "type",
                "integer"
        );

        noteId.put(
                "description",
                "需要查询的笔记 ID"
        );


        /*
         * properties
         */
        Map<String, Object> properties =
                new LinkedHashMap<>();

        properties.put(
                "noteId",
                noteId
        );


        /*
         * parameters
         */
        Map<String, Object> parameters =
                new LinkedHashMap<>();

        parameters.put(
                "type",
                "object"
        );

        parameters.put(
                "properties",
                properties
        );

        parameters.put(
                "required",
                List.of("noteId")
        );

        parameters.put(
                "additionalProperties",
                false
        );


        /*
         * function
         */
        Map<String, Object> function =
                new LinkedHashMap<>();

        function.put(
                "name",
                "get_note"
        );

        function.put(
                "description",
                "根据笔记 ID 查询 JotangNote 中的笔记全文"
        );

        function.put(
                "parameters",
                parameters
        );


        /*
         * tool
         */
        Map<String, Object> tool =
                new LinkedHashMap<>();

        tool.put(
                "type",
                "function"
        );

        tool.put(
                "function",
                function
        );


        return List.of(tool);
    }


    /*
     * Tool 分发器。
     *
     * AI 只会返回：
     *
     * name = get_note
     *
     * 真正决定执行哪段 Java 代码的
     * 是这里。
     */
    private String executeTool(
            ToolCall toolCall, Long userId) {

        return switch (
                toolCall.name()
                ) {

            case "get_note" ->
                    getNote(
                            toolCall.arguments(), userId
                    );

            default ->
                    errorJson(
                            "unknown tool: "
                                    + toolCall.name()
                    );
        };
    }


    /*
     * 真正查询 MySQL。
     */
    private String getNote(
            String argumentsJson, Long userId) {

        try {

            /*
             * DeepSeek 返回：
             *
             * {"noteId":2}
             *
             * 转成 Java Map。
             */
            Map<?, ?> arguments =
                    jsonMapper.readValue(
                            argumentsJson,
                            Map.class
                    );


            Object noteIdValue =
                    arguments.get(
                            "noteId"
                    );


            if (noteIdValue == null) {

                return errorJson(
                        "noteId is required"
                );
            }


            Long noteId;

            try {

                noteId =
                        Long.valueOf(
                                noteIdValue
                                        .toString()
                        );

            } catch (
                    NumberFormatException e
            ) {

                return errorJson(
                        "noteId must be an integer"
                );
            }


            /*
             * 这里才是真正调用
             * JotangNote 原本的 Mapper。
             */
            Note note =
                    noteAccessService.findOwned(
                            noteId, userId
                    );


            if (note == null) {

                return errorJson(
                        "note not found or access denied"
                );
            }


            /*
             * 返回给 AI 的数据。
             */
            Map<String, Object> result =
                    new LinkedHashMap<>();


            result.put(
                    "id",
                    note.getId()
            );

            result.put(
                    "title",
                    note.getTitle()
            );

            result.put(
                    "content",
                    note.getContent()
            );

            result.put(
                    "authorId",
                    note.getAuthorId()
            );


            return jsonMapper
                    .writeValueAsString(
                            result
                    );


        } catch (Exception e) {

            return errorJson(
                    "invalid tool arguments: "
                            + e.getMessage()
            );
        }
    }


    private String errorJson(
            String message) {

        try {

            return jsonMapper
                    .writeValueAsString(
                            Map.of(
                                    "error",
                                    message
                            )
                    );

        } catch (Exception e) {

            return """
                    {"error":"tool failed"}
                    """;
        }
    }


    /*
     * 开一个新的 AI 对话时调用。
     */
    public void clear(
            String conversationId) {

        conversations.remove(
                conversationId
        );
    }
}