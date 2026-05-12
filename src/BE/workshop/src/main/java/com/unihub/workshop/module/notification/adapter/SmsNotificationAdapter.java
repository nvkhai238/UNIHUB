package com.unihub.workshop.module.notification.adapter;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import com.unihub.workshop.module.notification.entity.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

@Slf4j
@Component
@ConditionalOnProperty(name = "app.notification.sms.enabled", havingValue = "true")
public class SmsNotificationAdapter implements NotificationAdapter {

    @Value("${app.notification.sms.twilio.account-sid}")
    private String accountSid;

    @Value("${app.notification.sms.twilio.auth-token}")
    private String authToken;

    @Value("${app.notification.sms.twilio.from-number}")
    private String fromNumber;

    @PostConstruct
    public void init() {
        if (accountSid != null && !accountSid.isEmpty() && !accountSid.startsWith("${")) {
            Twilio.init(accountSid, authToken);
            log.info("Twilio SMS Adapter initialized.");
        }
    }

    @Override
    public boolean supports(Notification.NotificationType type) {
        // SMS thường tốn phí, nên chỉ dùng cho các thông báo cực kỳ quan trọng
        return type == Notification.NotificationType.REGISTRATION_CONFIRMED
            || type == Notification.NotificationType.WORKSHOP_CANCELLED;
    }

    @Override
    public void send(Notification notification) {
        String userPhone = notification.getUser().getPhone();
        if (userPhone == null || userPhone.isEmpty()) {
            log.warn("User '{}' does not have a phone number. Skipping SMS.", notification.getUser().getEmail());
            return;
        }

        try {
            Message message = Message.creator(
                new PhoneNumber(userPhone),
                new PhoneNumber(fromNumber),
                notification.getTitle() + ": " + notification.getBody()
            ).create();

            log.info("SMS sent successfully to {}. SID: {}", userPhone, message.getSid());
        } catch (Exception e) {
            log.error("Failed to send SMS to {}: {}", userPhone, e.getMessage());
        }
    }
}
