package com.example.JotangNote.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.JotangNote.dto.LoginRequest;
import com.example.JotangNote.dto.RegisterRequest;
import com.example.JotangNote.entity.User;
import com.example.JotangNote.mapper.UserMapper;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DuplicateKeyException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder();

    public AuthController(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (request == null || request.username() == null || request.password() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "username and password are required"));
        }
        String username = request.username().trim();
        int passwordBytes = request.password().getBytes(StandardCharsets.UTF_8).length;
        if (username.length() < 2 || username.length() > 32
                || username.chars().anyMatch(Character::isWhitespace)
                || passwordBytes < 8 || passwordBytes > 72) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "username must be 2-32 non-space characters; password must be 8-72 UTF-8 bytes"));
        }

        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, username)
        );

        if (existing != null) {
            return ResponseEntity.status(409)
                    .body(Map.of("message", "username already exists"));
        }

        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(
                passwordEncoder.encode(request.password())
        );

        try {
            userMapper.insert(user);
        } catch (DuplicateKeyException e) {
            return ResponseEntity.status(409)
                    .body(Map.of("message", "username already exists"));
        }

        return ResponseEntity.ok(
                Map.of(
                        "id", user.getId(),
                        "username", user.getUsername()
                )
        );
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody LoginRequest request,
            HttpSession session,
            HttpServletRequest httpRequest) {

        if (request == null || request.username() == null
                || request.username().isBlank() || request.password() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "username and password are required"));
        }

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.username().trim())
        );

        if (user == null ||
                !passwordEncoder.matches(
                        request.password(),
                        user.getPasswordHash()
                )) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "wrong username or password"));
        }

        httpRequest.changeSessionId();
        session.setAttribute("userId", user.getId());

        return ResponseEntity.ok(
                Map.of(
                        "id", user.getId(),
                        "username", user.getUsername()
                )
        );
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "please login first"));
        }

        User user = userMapper.selectById(userId);

        if (user == null) {
            session.invalidate();
            return ResponseEntity.status(401)
                    .body(Map.of("message", "user not found"));
        }

        return ResponseEntity.ok(
                Map.of(
                        "id", user.getId(),
                        "username", user.getUsername()
                )
        );
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok(Map.of("message", "logged out"));
    }
}
