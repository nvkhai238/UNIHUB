package com.unihub.workshop.module.notification.service;

import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.registration.service.QrCodeService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import jakarta.mail.MessagingException;

import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final DateTimeFormatter EVENT_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy z");
    private static final Duration EMAIL_DEDUP_TTL = Duration.ofDays(7);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final RegistrationRepository registrationRepository;
    private final QrCodeService qrCodeService;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.mail.enabled:true}")
    private boolean mailEnabled;

    @Value("${app.mail.from:noreply@unihub.edu.vn}")
    private String fromAddress;

    @Async("notificationTaskExecutor")
    @Transactional(readOnly = true)
    public void sendRegistrationConfirmation(UUID registrationId) {
        Registration registration = registrationRepository.findById(registrationId)
                .orElse(null);
        if (registration == null || registration.getQrCode() == null) {
            log.warn("Skip registration confirmation email because registration {} is missing or has no QR", registrationId);
            return;
        }

        String dedupKey = "email:registration-confirmed:" + registrationId;
        if (!claimEmailSend(dedupKey)) {
            log.info("Skip duplicate registration confirmation email for registration {}", registrationId);
            return;
        }

        byte[] qrBytes = qrCodeService.generatePng(registration.getQrCode());
        boolean sent = sendWithRetry(
                registration.getUser().getEmail(),
                "[UniHub] Dang ky thanh cong - " + registration.getWorkshop().getTitle(),
                helper -> {
                    helper.setText(buildRegistrationConfirmationHtml(registration), true);
                    helper.addInline("qrCode", new ByteArrayResource(qrBytes), "image/png");
                    helper.addAttachment("unihub-qr-" + registrationId + ".png", new ByteArrayResource(qrBytes), "image/png");
                },
                "registration confirmation"
        );

        if (!sent) {
            releaseEmailSend(dedupKey);
        }
    }

    @Async("notificationTaskExecutor")
    @Transactional(readOnly = true)
    public void sendWorkshopCancellation(UUID registrationId) {
        Registration registration = registrationRepository.findById(registrationId)
                .orElse(null);
        if (registration == null) {
            log.warn("Skip workshop cancellation email because registration {} is missing", registrationId);
            return;
        }

        String dedupKey = "email:workshop-cancelled:" + registrationId;
        if (!claimEmailSend(dedupKey)) {
            log.info("Skip duplicate workshop cancellation email for registration {}", registrationId);
            return;
        }

        boolean sent = sendWithRetry(
                registration.getUser().getEmail(),
                "[UniHub] Thong bao huy workshop - " + registration.getWorkshop().getTitle(),
                helper -> helper.setText(buildWorkshopCancellationHtml(registration), true),
                "workshop cancellation"
        );

        if (!sent) {
            releaseEmailSend(dedupKey);
        }
    }

    private boolean sendWithRetry(
            String recipient,
            String subject,
            MimeMessageCustomizer customizer,
            String purpose
    ) {
        if (!StringUtils.hasText(recipient) || !recipient.contains("@")) {
            log.warn("Skip {} email because recipient address is invalid: {}", purpose, recipient);
            return true;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (!mailEnabled || mailSender == null || !StringUtils.hasText(fromAddress)) {
            log.warn("SMTP is not configured; skip {} email to {}", purpose, recipient);
            return false;
        }

        long backoffMillis = 50L;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                mailSender.send(message -> {
                    MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                    helper.setFrom(fromAddress);
                    helper.setTo(recipient);
                    helper.setSubject(subject);
                    customizer.customize(helper);
                });
                log.info("Sent {} email to {}", purpose, recipient);
                return true;
            } catch (MailException e) {
                log.warn("Could not send {} email to {} on attempt {}", purpose, recipient, attempt, e);
                if (attempt == 3) {
                    return false;
                }
                sleep(backoffMillis);
                backoffMillis *= 2;
            }
        }

        return false;
    }

    private String buildRegistrationConfirmationHtml(Registration registration) {
        String studentName = escape(registration.getUser().getFullName());
        String workshopTitle = escape(registration.getWorkshop().getTitle());
        String startTime = escape(EVENT_TIME_FORMATTER.format(registration.getWorkshop().getStartTime()));
        String room = escape(registration.getWorkshop().getRoom());
        String qrCode = escape(registration.getQrCode());

        return """
                <!doctype html>
                <html lang="vi">
                <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
                  <h2 style="margin:0 0 12px">Dang ky workshop thanh cong</h2>
                  <p>Xin chao %s,</p>
                  <p>Ban da dang ky thanh cong workshop <strong>%s</strong>.</p>
                  <ul>
                    <li>Thoi gian: %s</li>
                    <li>Phong: %s</li>
                  </ul>
                  <p>Vui long dua ma QR nay cho nhan su check-in tai cua phong.</p>
                  <p><img src="cid:qrCode" width="220" height="220" alt="UniHub QR code"></p>
                  <p style="font-size:12px;color:#6b7280">Ma QR: %s</p>
                </body>
                </html>
                """.formatted(studentName, workshopTitle, startTime, room, qrCode);
    }

    private String buildWorkshopCancellationHtml(Registration registration) {
        String studentName = escape(registration.getUser().getFullName());
        String workshopTitle = escape(registration.getWorkshop().getTitle());

        return """
                <!doctype html>
                <html lang="vi">
                <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
                  <h2 style="margin:0 0 12px">Thong bao huy workshop</h2>
                  <p>Xin chao %s,</p>
                  <p>Workshop <strong>%s</strong> da bi huy. Neu workshop co thu phi, he thong se ghi nhan hoan tien theo quy trinh cua ban to chuc.</p>
                  <p>Cam on ban da theo doi UniHub.</p>
                </body>
                </html>
                """.formatted(studentName, workshopTitle);
    }

    private boolean claimEmailSend(String key) {
        try {
            Boolean claimed = redisTemplate.opsForValue().setIfAbsent(key, "1", EMAIL_DEDUP_TTL);
            return !Boolean.FALSE.equals(claimed);
        } catch (RedisConnectionFailureException | RedisSystemException e) {
            log.warn("Redis unavailable while claiming email dedup key {}; sending anyway", key, e);
            return true;
        }
    }

    private void releaseEmailSend(String key) {
        try {
            redisTemplate.delete(key);
        } catch (RedisConnectionFailureException | RedisSystemException e) {
            log.warn("Redis unavailable while releasing email dedup key {}", key, e);
        }
    }

    private String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @FunctionalInterface
    private interface MimeMessageCustomizer {
        void customize(MimeMessageHelper helper) throws MessagingException;
    }
}
