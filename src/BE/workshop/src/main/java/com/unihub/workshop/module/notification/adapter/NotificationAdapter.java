package com.unihub.workshop.module.notification.adapter;

import com.unihub.workshop.module.notification.entity.Notification;

public interface NotificationAdapter {
    /**
     * Determines whether this adapter supports the given notification type.
     */
    boolean supports(Notification.NotificationType type);

    /**
     * Sends the notification using the adapter's specific channel.
     */
    void send(Notification notification);
}
