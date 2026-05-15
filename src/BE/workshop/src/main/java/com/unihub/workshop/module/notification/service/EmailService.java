package com.unihub.workshop.module.notification.service;

import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.registration.service.QrCodeService;
import com.unihub.workshop.module.payment.entity.RefundRequest;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.repository.RefundRequestRepository;
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
    private final PaymentRepository paymentRepository;
    private final RefundRequestRepository refundRequestRepository;
    private final QrCodeService qrCodeService;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.mail.enabled:true}")
    private boolean mailEnabled;

    @Value("${app.mail.from:noreply@unihub.edu.vn}")
    private String fromAddress;

    @Value("${app.mail.admin:noreply@unihub.edu.vn}")
    private String adminAddress;

    @Value("${app.frontend-base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    public boolean isEmailSendingAvailable() {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        return mailEnabled && mailSender != null && StringUtils.hasText(fromAddress);
    }

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

    @Async("notificationTaskExecutor")
    @Transactional(readOnly = true)
    public void sendRefundCompleted(UUID refundRequestId) {
        RefundRequest refundRequest = refundRequestRepository.findById(refundRequestId)
                .orElse(null);
        if (refundRequest == null) {
            log.warn("Skip refund completion email because refund request {} is missing", refundRequestId);
            return;
        }

        String dedupKey = "email:refund-completed:" + refundRequestId + ":" + Boolean.TRUE.equals(refundRequest.getProcessed());
        if (!claimEmailSend(dedupKey)) {
            log.info("Skip duplicate refund completion email for refund request {}", refundRequestId);
            return;
        }

        Registration registration = refundRequest.getRegistration();
        boolean sent = sendWithRetry(
                registration.getUser().getEmail(),
                "[UniHub] Hoan tien thanh cong - " + registration.getWorkshop().getTitle(),
                helper -> helper.setText(buildRefundCompletedHtml(refundRequest), true),
                "refund completion"
        );

        if (!sent) {
            releaseEmailSend(dedupKey);
        }
    }

    @Async("notificationTaskExecutor")
    @Transactional(readOnly = true)
    public void sendWorkshopUpdated(UUID registrationId, String changeSummary) {
        Registration registration = registrationRepository.findById(registrationId)
                .orElse(null);
        if (registration == null) {
            log.warn("Skip workshop update email because registration {} is missing", registrationId);
            return;
        }

        String dedupKey = "email:workshop-updated:" + registrationId + ":" + Integer.toHexString(changeSummary.hashCode());
        if (!claimEmailSend(dedupKey)) {
            log.info("Skip duplicate workshop update email for registration {}", registrationId);
            return;
        }

        boolean sent = sendWithRetry(
                registration.getUser().getEmail(),
                "[UniHub] Workshop cap nhat - " + registration.getWorkshop().getTitle(),
                helper -> helper.setText(buildWorkshopUpdatedHtml(registration, changeSummary), true),
                "workshop update"
        );

        if (!sent) {
            releaseEmailSend(dedupKey);
        }
    }

    public void sendRegistrationOtp(String email, String fullName, String otpCode, int expiresInMinutes) {
        boolean sent = sendWithRetry(
                email,
                "[UniHub] Ma xac thuc dang ky tai khoan",
                helper -> helper.setText(buildRegistrationOtpHtml(fullName, otpCode, expiresInMinutes), true),
                "registration otp"
        );

        if (!sent) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.OTP_SEND_FAILED,
                    "Không thể gửi mã OTP qua email lúc này."
            );
        }
    }

    @Async("notificationTaskExecutor")
    public void sendAdminCsvImportAlert(String subject, String summaryHtml) {
        sendWithRetry(
                adminAddress,
                subject,
                helper -> helper.setText(summaryHtml, true),
                "csv import admin alert"
        );
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
        boolean refundNeeded = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                .map(payment -> payment.getStatus() == PaymentStatus.REFUNDED)
                .orElse(false);
        String refundSection = "";

        if (refundNeeded) {
            String resolvedRefundUrl = resolveRefundFormUrl(registration);
            String safeRefundUrl = escape(resolvedRefundUrl);
            refundSection = """
                  <p>Workshop nay co thu phi. De BTC xu ly hoan tien, vui long dien form sau va gui kem thong tin ngan hang cung minh chung thanh toan:</p>
                  <p><a href="%s">%s</a></p>
                """.formatted(safeRefundUrl, safeRefundUrl);
        }

        return """
                <!doctype html>
                <html lang="vi">
                <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
                  <h2 style="margin:0 0 12px">Thong bao huy workshop</h2>
                  <p>Xin chao %s,</p>
                  <p>Workshop <strong>%s</strong> da bi huy.</p>
                  %s
                  <p>Cam on ban da theo doi UniHub.</p>
                </body>
                </html>
                """.formatted(studentName, workshopTitle, refundSection);
    }

    private String buildRegistrationOtpHtml(String fullName, String otpCode, int expiresInMinutes) {
        String recipientName = escape(fullName);
        String safeOtp = escape(otpCode);

        return """
                <!doctype html>
                <html lang="vi">
                <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
                  <h2 style="margin:0 0 12px">Xac thuc dang ky tai khoan</h2>
                  <p>Xin chao %s,</p>
                  <p>Ban dang tao tai khoan sinh vien tren UniHub Workshop. Ma OTP cua ban la:</p>
                  <p style="margin:20px 0;font-size:28px;font-weight:700;letter-spacing:6px">%s</p>
                  <p>Ma nay co hieu luc trong %d phut.</p>
                  <p style="font-size:12px;color:#6b7280">Neu ban khong thuc hien yeu cau nay, vui long bo qua email.</p>
                </body>
                </html>
                """.formatted(recipientName, safeOtp, expiresInMinutes);
    }

    private String buildWorkshopUpdatedHtml(Registration registration, String changeSummary) {
        String studentName = escape(registration.getUser().getFullName());
        String workshopTitle = escape(registration.getWorkshop().getTitle());
        String startTime = escape(EVENT_TIME_FORMATTER.format(registration.getWorkshop().getStartTime()));
        String room = escape(registration.getWorkshop().getRoom());
        String summary = escape(changeSummary);

        return """
                <!doctype html>
                <html lang="vi">
                <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
                  <h2 style="margin:0 0 12px">Workshop da duoc cap nhat</h2>
                  <p>Xin chao %s,</p>
                  <p>Workshop <strong>%s</strong> vua co thay doi quan trong.</p>
                  <p><strong>Noi dung cap nhat:</strong> %s</p>
                  <ul>
                    <li>Thoi gian hien tai: %s</li>
                    <li>Phong hien tai: %s</li>
                  </ul>
                  <p>Vui long kiem tra lai lich tham du cua ban tren UniHub.</p>
                </body>
                </html>
                """.formatted(studentName, workshopTitle, summary, startTime, room);
    }

    private String buildRefundCompletedHtml(RefundRequest refundRequest) {
        Registration registration = refundRequest.getRegistration();
        String studentName = escape(registration.getUser().getFullName());
        String workshopTitle = escape(registration.getWorkshop().getTitle());
        String amount = escape(String.valueOf(refundRequest.getRegistration()
                .getWorkshop()
                .getPrice()));
        String bankName = escape(refundRequest.getBankName());
        String bankAccountNumber = escape(refundRequest.getBankAccountNumber());

        return """
                <!doctype html>
                <html lang="vi">
                <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
                  <h2 style="margin:0 0 12px">Hoan tien thanh cong</h2>
                  <p>Xin chao %s,</p>
                  <p>BTC da xu ly hoan tien thanh cong cho workshop <strong>%s</strong>.</p>
                  <ul>
                    <li>Tai khoan nhan: %s - %s</li>
                    <li>So tien du kien: %s VND</li>
                  </ul>
                  <p>Neu ban can doi chieu them, vui long lien he BTC.</p>
                </body>
                </html>
                """.formatted(studentName, workshopTitle, bankName, bankAccountNumber, amount);
    }

    private String resolveRefundFormUrl(Registration registration) {
        return trimTrailingSlash(frontendBaseUrl) + "/student/refunds/" + registration.getId();
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "http://localhost:5173";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
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
