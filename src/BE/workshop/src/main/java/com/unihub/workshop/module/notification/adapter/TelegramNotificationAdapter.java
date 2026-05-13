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
        // Cho phép Telegram gửi tất cả các loại thông báo để đảm bảo không bỏ sót
        return true;
    }

    @Override
    public void send(Notification notification) {
        String telegramId = notification.getUser().getTelegramId();
        String userEmail = notification.getUser().getEmail();
        
        log.info("Notification process for user: {}. TelegramID from DB: {}", userEmail, telegramId);

        if (telegramId == null || telegramId.isEmpty()) {
            log.warn("User '{}' does not have a telegramId. Skipping Telegram notification.", userEmail);
            return;
        }

        if (botToken == null || botToken.isEmpty() || botToken.startsWith("${")) {
            log.warn("Telegram bot-token is not configured.");
            return;
        }

        try {
            String title = (notification.getTitle() != null && !notification.getTitle().trim().isEmpty()) 
                           ? notification.getTitle() : "UniHub Notification";
            String bodyText = (notification.getBody() != null && !notification.getBody().trim().isEmpty()) 
                              ? notification.getBody() : "Ban co thong bao moi tu he thong.";
            
            String url = "https://api.telegram.org/bot" + botToken.trim() + "/sendMessage";
            
            Map<String, String> payload = new HashMap<>();
            payload.put("chat_id", telegramId);
            payload.put("text", "🔔 *" + title + "*\n\n" + bodyText);
            payload.put("parse_mode", "Markdown");

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            org.springframework.http.HttpEntity<Map<String, String>> entity = new org.springframework.http.HttpEntity<>(payload, headers);

            log.info("Sending JSON to Telegram. URL: {}, Payload: {}", url, payload);
            restTemplate.postForObject(url, entity, String.class);
            log.info("Telegram notification sent successfully to {}.", telegramId);
        } catch (Exception e) {
            log.error("Failed to send Telegram notification to {}: {}", telegramId, e.getMessage());
            if (e instanceof org.springframework.web.client.HttpStatusCodeException) {
                log.error("Telegram API Response: {}", ((org.springframework.web.client.HttpStatusCodeException) e).getResponseBodyAsString());
            }
        }
    }
}
