-- JotangNote local development schema (MySQL 8+)
-- Run: mysql -u <database-admin-user> -p < sql/schema.sql
CREATE DATABASE IF NOT EXISTS jotang_note
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jotang_note;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notes (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    author_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_notes_author_id (author_id),
    CONSTRAINT fk_notes_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB;
