package com.unihub.workshop.module.notification.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyNotifications(
            @RequestParam(required = false) Boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<Notification> notifications = notificationService.getMyNotifications(unreadOnly, page, size);
        long unreadCount = notificationService.getUnreadCount();

        Map<String, Object> result = Map.of(
                "content", notifications.getContent().stream().map(this::toDto).toList(),
                "totalElements", notifications.getTotalElements(),
                "totalPages", notifications.getTotalPages(),
                "page", notifications.getNumber(),
                "size", notifications.getSize(),
                "unreadCount", unreadCount
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount() {
        return ResponseEntity.ok(ApiResponse.success(notificationService.getUnreadCount()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> markAsRead(@PathVariable UUID id) {
        Notification updated = notificationService.markAsRead(id);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "id", updated.getId(),
                "isRead", updated.isRead(),
                "updatedAt", updated.getUpdatedAt()
        )));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> markAllAsRead(@RequestBody Map<String, String> body) {
        String action = body.get("action");
        int updatedCount = 0;
        if ("mark_all_read".equals(action)) {
            updatedCount = notificationService.markAllAsRead();
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("updatedCount", updatedCount)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable UUID id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteAllNotifications(@RequestBody Map<String, String> body) {
        String action = body.get("action");
        int deletedCount = 0;
        if ("delete_all".equals(action)) {
            deletedCount = notificationService.deleteAllNotifications();
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("deletedCount", deletedCount)));
    }

    private Map<String, Object> toDto(Notification n) {
        return Map.of(
                "id", n.getId(),
                "type", n.getType().name(),
                "title", n.getTitle(),
                "body", n.getBody(),
                "isRead", n.isRead(),
                "createdAt", n.getCreatedAt(),
                "data", n.getData() != null ? n.getData() : Map.of()
        );
    }
}
