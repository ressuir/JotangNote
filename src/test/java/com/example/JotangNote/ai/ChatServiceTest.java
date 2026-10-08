package com.example.JotangNote.ai;

import com.example.JotangNote.service.NoteAccessService;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChatServiceTest {

    @Test
    void getNoteToolMustUseTheAuthenticatedUserId() throws Exception {
        ModelClient modelClient = mock(ModelClient.class);
        NoteAccessService access = mock(NoteAccessService.class);
        JsonMapper mapper = mock(JsonMapper.class);
        ChatService service = new ChatService(modelClient, access, mapper);

        when(modelClient.chat(anyList(), anyList()))
                .thenReturn(new ModelReply(null,
                        List.of(new ToolCall("call-1", "get_note", "{\"noteId\":42}"))))
                .thenReturn(new ModelReply("没有权限读取该笔记", List.of()));
        when(mapper.readValue("{\"noteId\":42}", Map.class))
                .thenReturn(Map.of("noteId", 42));
        when(mapper.writeValueAsString(any()))
                .thenReturn("{\"error\":\"note not found or access denied\"}");

        String reply = service.chat("user2-session", 2L, "请总结42号笔记");

        assertEquals("没有权限读取该笔记", reply);
        verify(access).findOwned(42L, 2L);
        verify(access, never()).findOwned(42L, 1L);
    }
}
