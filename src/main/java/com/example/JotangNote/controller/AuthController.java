package com.example.JotangNote.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.JotangNote.dto.LoginRequest;
import com.example.JotangNote.dto.RegisterRequest;
import com.example.JotangNote.entity.User;
import com.example.JotangNote.mapper.UserMapper;
import jakarta.servlet.http.HttpSession;
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

        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.username())
        );

        if (existing != null) {
            return ResponseEntity.status(409)
                    .body(Map.of("message", "username already exists"));
        }

        User user = new User();
        user.setUsername(request.username());
        user.setPasswordHash(
                passwordEncoder.encode(request.password())
        );

        userMapper.insert(user);

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
            HttpSession session) {

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, request.username())
        );

        if (user == null ||
                !passwordEncoder.matches(
                        request.password(),
                        user.getPasswordHash()
                )) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "wrong username or password"));
        }

        session.setAttribute("userId", user.getId());

        return ResponseEntity.ok(
                Map.of(
                        "id", user.getId(),
                        "username", user.getUsername()
                )
        );
    }
}
