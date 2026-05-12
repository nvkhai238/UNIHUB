package com.unihub.workshop.module.notification.adapter;

import com.unihub.workshop.module.notification.entity.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@ConditionalOnProperty(name = "app.notification.telegram.enabled", havingValue = "true")
public class TelegramNotificationAdapter implements NotificationAdapter {

    @Value("${app.notification.telegram.bot-token}")
    private String botToken;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public boolean supports(Notification.NotificationType type) {
        return type == Notification.NotificationType.REGISTRATION_CONFIRMED
            || type == Notification.NotificationType.REGISTRATION_CANCELLED
            || type == Notification.NotificationType.WORKSHOP_CANCELLED
            || type == Notification.NotificationType.PAYMENT_SUCCESS;
    }

    @Override
    public void send(Notification notification) {
        String telegramId = notification.getUser().getTelegramId();
        if (telegramId == null || telegramId.isEmpty()) {
            log.warn("User '{}' does not have a telegramId. Skipping Telegram notification.", notification.getUser().getEmail());
            return;
        }

        if (botToken == null || botToken.isEmpty() || botToken.startsWith("${")) {
            log.warn("Telegram bot-token is not configured.");
            return;
        }

        try {
            String url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
            Map<String, String> body = new HashMap<>();
            body.put("chat_id", telegramId);
            body.put("text", "*" + notification.getTitle() + "*\n\n" + notification.getBody());
            body.put("parse_mode", "Markdown");

            restTemplate.postForObject(url, body, String.class);
            log.info("Telegram notification sent successfully to {}.", telegramId);
        } catch (Exception e) {
            log.error("Failed to send Telegram notification to {}: {}", telegramId, e.getMessage());
        }
    }
}
