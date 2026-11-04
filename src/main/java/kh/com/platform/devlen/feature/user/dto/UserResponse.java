package kh.com.platform.devlen.feature.user.dto;

import kh.com.platform.devlen.feature.user.UserStatus;

import java.time.ZonedDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String displayName,
        String email,
        Boolean emailVerified,
        String avatarUrl,
        UserStatus status,
        ZonedDateTime createdAt,
        ZonedDateTime updatedAt
) {
}
