package com.unihub.workshop.module.notification.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.notification.repository.NotificationRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<Notification> getMyNotifications(Boolean unreadOnly, int page, int size) {
        User user = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size);
        if (unreadOnly != null && unreadOnly) {
            return notificationRepository.findByUserAndReadOrderByCreatedAtDesc(user, false, pageable);
        }
        return notificationRepository.findByUserOrderByCreatedAtDesc(user, pageable);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount() {
        User user = getCurrentUser();
        return notificationRepository.countByUserAndReadFalse(user);
    }

    @Transactional
    public Notification markAsRead(UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Notification not found"));
        User user = getCurrentUser();
        if (!notification.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your notification");
        }
        notification.setRead(true);
        return notificationRepository.save(notification);
    }

    @Transactional
    public int markAllAsRead() {
        User user = getCurrentUser();
        return notificationRepository.markAllAsRead(user);
    }

    @Transactional
    public void deleteNotification(UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Notification not found"));
        User user = getCurrentUser();
        if (!notification.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your notification");
        }
        notificationRepository.delete(notification);
    }

    @Transactional
    public int deleteAllNotifications() {
        User user = getCurrentUser();
        List<Notification> all = notificationRepository.findByUserOrderByCreatedAtDesc(user, Pageable.unpaged()).getContent();
        notificationRepository.deleteAll(all);
        return all.size();
    }

    @Async("notificationTaskExecutor")
    @Transactional
    public void createNotification(UUID userId, Notification.NotificationType type, String title, String body, Map<String, Object> data) {
        User user = userRepository.findById(userId)
                .orElse(null);
        if (user == null) return;

        Notification notification = Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .body(body)
                .read(false)
                .data(data)
                .build();
        notificationRepository.save(notification);
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
