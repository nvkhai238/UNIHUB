package com.unihub.workshop.module.notification.adapter;

import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.notification.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmailNotificationAdapter implements NotificationAdapter {

    private final EmailService emailService;

    @Override
    public boolean supports(Notification.NotificationType type) {
        return type == Notification.NotificationType.REGISTRATION_CONFIRMED 
            || type == Notification.NotificationType.WORKSHOP_CANCELLED
            || type == Notification.NotificationType.PAYMENT_SUCCESS;
    }

    @Override
    public void send(Notification notification) {
        if (!emailService.isEmailSendingAvailable()) {
            return;
        }

        try {
            String registrationIdStr = (String) notification.getData().get("registrationId");
            if (registrationIdStr == null) {
                log.warn("Cannot send email for notification {} because registrationId is missing in data", notification.getId());
                return;
            }
            
            UUID registrationId = UUID.fromString(registrationIdStr);
            
            if (notification.getType() == Notification.NotificationType.REGISTRATION_CONFIRMED || notification.getType() == Notification.NotificationType.PAYMENT_SUCCESS) {
                emailService.sendRegistrationConfirmation(registrationId);
            } else if (notification.getType() == Notification.NotificationType.WORKSHOP_CANCELLED) {
                emailService.sendWorkshopCancellation(registrationId);
            }
        } catch (Exception e) {
            log.error("Failed to process email for notification {}", notification.getId(), e);
        }
    }
}
